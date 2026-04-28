import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { addMutation } from "@/lib/offline-db";
import { precachePhotos, extractPhotoUrls } from "@/lib/photo-precache";
import { isReallyOnline } from "@/lib/network-status";
import { withTimeout } from "@/lib/supabase-with-timeout";

// Hard cap so the "Suivant" button never appears stuck on a flaky network.
// The mutation is fire-and-forget anyway, but we still want the background
// sync to bail quickly and queue the mutation locally.
const STEP_SYNC_TIMEOUT_MS = 4000;

export interface StepCompletion {
  id: string;
  intervention_id: string;
  step_id: string;
  completed_at: string | null;
  completed_by: string | null;
  photo_url: string | null;
  comment: string | null;
  checklist_data: { id: string; label: string; checked: boolean }[] | null;
  multiple_choice_data: { id: string; label: string; selected: boolean }[] | null;
  created_at: string;
  loop_index: number;
}

export function useStepCompletions(interventionId: string) {
  return useQuery({
    queryKey: ["step-completions", interventionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intervention_step_completions")
        .select("*")
        .eq("intervention_id", interventionId)
        .order("loop_index", { ascending: true });

      if (error) throw error;
      const completions = data as unknown as StepCompletion[];

      // Warm the Service Worker cache so step photos remain viewable
      // if the technician later goes offline (airplane mode, dead zone).
      try {
        const allUrls = completions.flatMap((c) => extractPhotoUrls(c.photo_url));
        if (allUrls.length > 0) precachePhotos(allUrls);
      } catch {
        /* precaching is best-effort */
      }

      return completions;
    },
    enabled: !!interventionId,
    refetchOnWindowFocus: () => navigator.onLine,
  });
}

interface CompleteStepParams {
  interventionId: string;
  stepId: string;
  comment?: string;
  photoUrl?: string;
  loopIndex?: number;
  checklistData?: { id: string; label: string; checked: boolean }[];
  multipleChoiceData?: { id: string; label: string; selected: boolean }[];
}

export function useCompleteStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CompleteStepParams) => {
      const {
        interventionId, stepId, comment, photoUrl,
        loopIndex = 0, checklistData, multipleChoiceData,
      } = params;

      // 1. Optimistic update — patch cache immediately
      const tempId = crypto.randomUUID();
      const now = new Date().toISOString();
      
      queryClient.setQueryData<StepCompletion[]>(
        ["step-completions", interventionId],
        (old = []) => {
          const existing = old.find(
            (c) => c.step_id === stepId && c.loop_index === loopIndex
          );
          if (existing) {
            return old.map((c) =>
              c.step_id === stepId && c.loop_index === loopIndex
                ? { ...c, completed_at: now, comment: comment || null, photo_url: photoUrl || null, checklist_data: checklistData || null, multiple_choice_data: multipleChoiceData || null }
                : c
            );
          }
          return [
            ...old,
            {
              id: tempId,
              intervention_id: interventionId,
              step_id: stepId,
              completed_at: now,
              completed_by: null,
              photo_url: photoUrl || null,
              comment: comment || null,
              checklist_data: checklistData || null,
              multiple_choice_data: multipleChoiceData || null,
              created_at: now,
              loop_index: loopIndex,
            },
          ];
        }
      );

      // 2. If offline, queue and return
      if (!navigator.onLine) {
        await addMutation({
          type: 'complete_step',
          payload: { interventionId, stepId, comment, photoUrl, loopIndex, checklistData, multipleChoiceData },
        });
        return;
      }

      // 3. Online: fire-and-forget background sync
      const syncToServer = async () => {
        const { data: { user } } = await supabase.auth.getUser();

        const { data: existing } = await supabase
          .from("intervention_step_completions")
          .select("id")
          .eq("intervention_id", interventionId)
          .eq("step_id", stepId)
          .eq("loop_index", loopIndex)
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from("intervention_step_completions")
            .update({
              completed_at: now,
              completed_by: user?.id || null,
              comment: comment || null,
              photo_url: photoUrl || null,
              checklist_data: checklistData || null,
              multiple_choice_data: multipleChoiceData || null,
            } as any)
            .eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("intervention_step_completions")
            .insert({
              intervention_id: interventionId,
              step_id: stepId,
              completed_at: now,
              completed_by: user?.id || null,
              comment: comment || null,
              photo_url: photoUrl || null,
              loop_index: loopIndex,
              checklist_data: checklistData || null,
              multiple_choice_data: multipleChoiceData || null,
            } as any);
          if (error) throw error;
        }

        // Refresh from server
        queryClient.invalidateQueries({ queryKey: ["step-completions", interventionId] });
      };

      syncToServer().catch(async (err) => {
        console.warn("Step completion background sync failed, queuing:", err?.message);
        await addMutation({
          type: 'complete_step',
          payload: { interventionId, stepId, comment, photoUrl, loopIndex, checklistData, multipleChoiceData },
        }).catch(() => {});
      });
    },
    onSuccess: () => {
      toast({ title: "Étape validée" });
    },
    onError: (error: Error) => {
      if (!navigator.onLine) {
        toast({ title: "Étape enregistrée localement", description: "Sera synchronisée au retour de la connexion" });
      } else {
        toast({ title: "Erreur", description: error.message, variant: "destructive" });
      }
    },
  });
}

export function useSaveDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CompleteStepParams) => {
      const {
        interventionId, stepId, comment, photoUrl,
        loopIndex = 0, checklistData, multipleChoiceData,
      } = params;

      // 1. Optimistic update
      const tempId = crypto.randomUUID();
      const now = new Date().toISOString();
      
      queryClient.setQueryData<StepCompletion[]>(
        ["step-completions", interventionId],
        (old = []) => {
          const existing = old.find(
            (c) => c.step_id === stepId && c.loop_index === loopIndex
          );
          if (existing) {
            return old.map((c) =>
              c.step_id === stepId && c.loop_index === loopIndex
                ? { ...c, comment: comment || null, photo_url: photoUrl || null, checklist_data: checklistData || null, multiple_choice_data: multipleChoiceData || null }
                : c
            );
          }
          return [
            ...old,
            {
              id: tempId,
              intervention_id: interventionId,
              step_id: stepId,
              completed_at: null,
              completed_by: null,
              photo_url: photoUrl || null,
              comment: comment || null,
              checklist_data: checklistData || null,
              multiple_choice_data: multipleChoiceData || null,
              created_at: now,
              loop_index: loopIndex,
            },
          ];
        }
      );

      // 2. If offline, queue
      if (!navigator.onLine) {
        await addMutation({
          type: 'save_draft_step',
          payload: { interventionId, stepId, comment, photoUrl, loopIndex, checklistData, multipleChoiceData },
        });
        return;
      }

      // 3. Background sync
      const syncToServer = async () => {
        const { data: { user } } = await supabase.auth.getUser();

        const { data: existing } = await supabase
          .from("intervention_step_completions")
          .select("id, completed_at")
          .eq("intervention_id", interventionId)
          .eq("step_id", stepId)
          .eq("loop_index", loopIndex)
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from("intervention_step_completions")
            .update({
              comment: comment || null,
              photo_url: photoUrl || null,
              checklist_data: checklistData || null,
              multiple_choice_data: multipleChoiceData || null,
            } as any)
            .eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("intervention_step_completions")
            .insert({
              intervention_id: interventionId,
              step_id: stepId,
              completed_at: null,
              completed_by: user?.id || null,
              comment: comment || null,
              photo_url: photoUrl || null,
              loop_index: loopIndex,
              checklist_data: checklistData || null,
              multiple_choice_data: multipleChoiceData || null,
            } as any);
          if (error) throw error;
        }

        queryClient.invalidateQueries({ queryKey: ["step-completions", interventionId] });
      };

      syncToServer().catch(async (err) => {
        console.warn("Draft save background sync failed, queuing:", err?.message);
        await addMutation({
          type: 'save_draft_step',
          payload: { interventionId, stepId, comment, photoUrl, loopIndex, checklistData, multipleChoiceData },
        }).catch(() => {});
      });
    },
    onSuccess: (_, variables) => {
      // Silent for drafts
    },
  });
}

export function useUncompleteStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      interventionId,
      stepId,
      loopIndex,
    }: {
      interventionId: string;
      stepId: string;
      loopIndex?: number;
    }) => {
      // 1. Optimistic: remove from cache
      queryClient.setQueryData<StepCompletion[]>(
        ["step-completions", interventionId],
        (old = []) => old.filter(
          (c) => !(c.step_id === stepId && (loopIndex === undefined || c.loop_index === loopIndex))
        )
      );

      // 2. If offline, queue
      if (!navigator.onLine) {
        await addMutation({
          type: 'uncomplete_step',
          payload: { interventionId, stepId, loopIndex },
        });
        return;
      }

      // 3. Background sync
      const syncToServer = async () => {
        let query = supabase
          .from("intervention_step_completions")
          .delete()
          .eq("intervention_id", interventionId)
          .eq("step_id", stepId);

        if (loopIndex !== undefined) {
          query = query.eq("loop_index", loopIndex);
        }

        const { error } = await query;
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ["step-completions", interventionId] });
      };

      syncToServer().catch(async (err) => {
        console.warn("Uncomplete step background sync failed, queuing:", err?.message);
        await addMutation({
          type: 'uncomplete_step',
          payload: { interventionId, stepId, loopIndex },
        }).catch(() => {});
      });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });
}
