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
  created_at: string;
}

export function useStepCompletions(interventionId: string) {
  return useQuery({
    queryKey: ["step-completions", interventionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intervention_step_completions")
        .select("*")
        .eq("intervention_id", interventionId);

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
    }: {
      interventionId: string;
      stepId: string;
      comment?: string;
      photoUrl?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("intervention_step_completions")
        .upsert(
          {
            intervention_id: interventionId,
            step_id: stepId,
            completed_at: new Date().toISOString(),
            completed_by: user?.id || null,
            comment: comment || null,
            photo_url: photoUrl || null,
          },
          { onConflict: "intervention_id,step_id" }
        )
        .select()
        .single();

      if (error) {
        // If upsert fails due to no unique constraint, try insert then update
        const { data: existing } = await supabase
          .from("intervention_step_completions")
          .select("id")
          .eq("intervention_id", interventionId)
          .eq("step_id", stepId)
          .maybeSingle();

        if (existing) {
          const { error: updateError } = await supabase
            .from("intervention_step_completions")
            .update({
              completed_at: new Date().toISOString(),
              completed_by: user?.id || null,
              comment: comment || null,
              photo_url: photoUrl || null,
            })
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
            });
          if (insertError) throw insertError;
        }
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
    }: {
      interventionId: string;
      stepId: string;
    }) => {
      const { error } = await supabase
        .from("intervention_step_completions")
        .delete()
        .eq("intervention_id", interventionId)
        .eq("step_id", stepId);

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
