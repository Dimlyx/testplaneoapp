import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface StepCompletion {
  id: string;
  intervention_id: string;
  step_id: string;
  completed_at: string | null;
  completed_by: string | null;
  photo_url: string | null;
  comment: string | null;
  checklist_data: { id: string; label: string; checked: boolean }[] | null;
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
      return data as StepCompletion[];
    },
    enabled: !!interventionId,
  });
}

export function useCompleteStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      interventionId,
      stepId,
      comment,
      photoUrl,
      loopIndex = 0,
    }: {
      interventionId: string;
      stepId: string;
      comment?: string;
      photoUrl?: string;
      loopIndex?: number;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      // Check if a completion already exists for this step+loop combo
      const { data: existing } = await supabase
        .from("intervention_step_completions")
        .select("id")
        .eq("intervention_id", interventionId)
        .eq("step_id", stepId)
        .eq("loop_index", loopIndex)
        .maybeSingle();

      if (existing) {
        const { error: updateError } = await supabase
          .from("intervention_step_completions")
          .update({
            completed_at: new Date().toISOString(),
            completed_by: user?.id || null,
            comment: comment || null,
            photo_url: photoUrl || null,
            checklist_data: checklistData || null,
          } as any)
          .eq("id", existing.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("intervention_step_completions")
          .insert({
            intervention_id: interventionId,
            step_id: stepId,
            completed_at: new Date().toISOString(),
            completed_by: user?.id || null,
            comment: comment || null,
            photo_url: photoUrl || null,
            loop_index: loopIndex,
          });
        if (insertError) throw insertError;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["step-completions", variables.interventionId] });
      toast.success("Étape validée");
    },
    onError: (error: Error) => {
      toast.error("Erreur: " + error.message);
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
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["step-completions", variables.interventionId] });
    },
    onError: (error: Error) => {
      toast.error("Erreur: " + error.message);
    },
  });
}
