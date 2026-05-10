import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isReallyOnline } from "@/lib/network-status";
import { precachePhotos, extractPhotoUrls } from "@/lib/photo-precache";
import { saveInterventionOffline } from "@/lib/offline-db";
import type { Intervention } from "@/hooks/useInterventions";

/**
 * Background pre-cache of every "active" intervention (to_plan, planned,
 * in_progress) so a technician who opens the app in the morning with a good
 * connection has all the data needed for the day, even if the network drops
 * later (basement, dead zone, airplane mode).
 *
 * Strategy:
 * 1. Filter interventions to active statuses.
 * 2. For each, fire the same Supabase REST calls that the detail screen
 *    will later make. These transit the Service Worker, which has a
 *    NetworkFirst cache configured for /rest/v1/* (24h TTL).
 * 3. Hydrate React Query so opening the screen feels instant (no spinner)
 *    while online too.
 * 4. Warm the SW storage cache with every photo URL referenced by step
 *    completions, attachments, and equipment photos.
 *
 * Best-effort: silently no-ops on failure or when offline. Throttled
 * concurrency to avoid hammering the network.
 */

const ACTIVE_STATUSES: ReadonlySet<Intervention["status"]> = new Set([
  "to_plan",
  "planned",
  "in_progress",
]);

const CONCURRENCY = 3;
const SAFETY_CAP = 80;

type PrefetchTask = () => Promise<void>;

async function runWithConcurrency(tasks: PrefetchTask[], limit: number) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (cursor < tasks.length) {
      const idx = cursor++;
      try {
        await tasks[idx]();
      } catch {
        /* best-effort */
      }
    }
  });
  await Promise.all(workers);
}

export function usePrecacheActiveInterventions(interventions: Intervention[]) {
  const queryClient = useQueryClient();
  // Track which intervention IDs have already been warmed in this session,
  // so re-renders / list refetches don't re-trigger the whole sweep.
  const warmedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isReallyOnline()) return;
    if (interventions.length === 0) return;

    const active = interventions
      .filter((i) => ACTIVE_STATUSES.has(i.status))
      .filter((i) => !warmedRef.current.has(i.id))
      .slice(0, SAFETY_CAP);

    if (active.length === 0) return;

    let cancelled = false;

    const tasks: PrefetchTask[] = active.map((intervention) => async () => {
      if (cancelled || !isReallyOnline()) return;
      const id = intervention.id;

      // Persist the summary to IndexedDB so the list view also works
      // offline if the technician kills the app between morning sync and
      // afternoon use.
      try {
        await saveInterventionOffline(intervention);
      } catch {
        /* ignore */
      }

      // Run the four detail endpoints in parallel for this intervention.
      // Each one populates both React Query and the SW NetworkFirst cache.
      const photoUrls: string[] = [];

      await Promise.all([
        // Step completions (also collects photo URLs to warm)
        queryClient
          .prefetchQuery({
            queryKey: ["step-completions", id],
            queryFn: async () => {
              const { data, error } = await supabase
                .from("intervention_step_completions")
                .select("*")
                .eq("intervention_id", id)
                .order("loop_index", { ascending: true });
              if (error) throw error;
              for (const row of data || []) {
                photoUrls.push(...extractPhotoUrls((row as any).photo_url));
              }
              return data;
            },
          })
          .catch(() => {}),

        // Equipment attached to the intervention
        queryClient
          .prefetchQuery({
            queryKey: ["intervention-equipment", id],
            queryFn: async () => {
              const { data, error } = await supabase
                .from("intervention_equipment")
                .select(
                  `*, equipment (id, brand, model, equipment_type, serial_number)`,
                )
                .eq("intervention_id", id)
                .order("created_at", { ascending: true });
              if (error) throw error;
              return data;
            },
          })
          .catch(() => {}),

        // Standalone intervention photos
        queryClient
          .prefetchQuery({
            queryKey: ["intervention-photos", id],
            queryFn: async () => {
              const { data, error } = await supabase
                .from("intervention_photos")
                .select("*")
                .eq("intervention_id", id)
                .order("created_at", { ascending: true });
              if (error) throw error;
              for (const row of data || []) {
                if ((row as any).photo_url) photoUrls.push((row as any).photo_url);
              }
              return data;
            },
          })
          .catch(() => {}),

        // Attachments (PDFs, etc.)
        queryClient
          .prefetchQuery({
            queryKey: ["intervention-attachments", id],
            queryFn: async () => {
              const { data, error } = await supabase
                .from("intervention_attachments")
                .select("*")
                .eq("intervention_id", id)
                .order("created_at", { ascending: false });
              if (error) throw error;
              for (const row of data || []) {
                if ((row as any).file_url) photoUrls.push((row as any).file_url);
              }
              return data;
            },
          })
          .catch(() => {}),
      ]);

      if (cancelled) return;

      // Warm the SW storage cache with every photo / attachment URL.
      if (photoUrls.length > 0) {
        precachePhotos(photoUrls);
      }

      warmedRef.current.add(id);
    });

    runWithConcurrency(tasks, CONCURRENCY);

    return () => {
      cancelled = true;
    };
    // We deliberately depend on the joined IDs string so an unrelated
    // re-render of the parent doesn't restart the sweep, but a real
    // change in the active set does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    interventions
      .filter((i) => ACTIVE_STATUSES.has(i.status))
      .map((i) => i.id)
      .join(","),
  ]);
}
