import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { precachePhotos, extractPhotoUrls } from "@/lib/photo-precache";
import { isReallyOnline } from "@/lib/network-status";

/**
 * Bulk-warm the Service Worker cache with every step photo referenced
 * by the technician's visible interventions.
 *
 * Triggered as soon as the intervention list is loaded (e.g. when the
 * technician opens the app in the morning) so that all photos remain
 * viewable later, even if the device drops offline during the day.
 *
 * Best-effort: silently no-ops on failure or when offline.
 */
export function usePrecacheInterventionPhotos(interventionIds: string[]) {
  useEffect(() => {
    if (!isReallyOnline()) return;
    if (interventionIds.length === 0) return;

    let cancelled = false;
    const ids = [...new Set(interventionIds)].slice(0, 200); // safety cap

    (async () => {
      try {
        const { data, error } = await supabase
          .from("intervention_step_completions")
          .select("photo_url")
          .in("intervention_id", ids)
          .not("photo_url", "is", null);

        if (cancelled || error || !data) return;
        const urls = data.flatMap((row: any) => extractPhotoUrls(row.photo_url));
        if (urls.length > 0) precachePhotos(urls);
      } catch {
        /* best-effort */
      }
    })();

    return () => {
      cancelled = true;
    };
    // Re-run when the set of intervention IDs changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interventionIds.join(",")]);
}
