import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useUserOrganization } from "./useUserOrganization";

export interface WorkflowStep {
  id: string;
  intervention_type_id: string;
  organization_id: string | null;
  name: string;
  label: string;
  description: string | null;
  is_mandatory: boolean;
  step_order: number;
  requires_photo: boolean;
  requires_comment: boolean;
  requires_signature: boolean;
  is_loop_trigger: boolean;
  loop_yes_step_id: string | null;
  loop_no_step_id: string | null;
  checklist_items: { id: string; label: string }[];
  multiple_choice_items: { id: string; label: string }[];
  created_at: string;
  updated_at: string;
}

export interface CreateWorkflowStepInput {
  intervention_type_id: string;
  name: string;
  label: string;
  description?: string;
  is_mandatory?: boolean;
  step_order?: number;
  requires_photo?: boolean;
  requires_comment?: boolean;
  requires_signature?: boolean;
  is_loop_trigger?: boolean;
  loop_yes_step_id?: string | null;
  loop_no_step_id?: string | null;
  checklist_items?: { id: string; label: string }[];
  multiple_choice_items?: { id: string; label: string }[];
}

export interface UpdateWorkflowStepInput {
  id: string;
  name?: string;
  label?: string;
  description?: string;
  is_mandatory?: boolean;
  step_order?: number;
  requires_photo?: boolean;
  requires_comment?: boolean;
  requires_signature?: boolean;
  is_loop_trigger?: boolean;
  loop_yes_step_id?: string | null;
  loop_no_step_id?: string | null;
  checklist_items?: { id: string; label: string }[];
  multiple_choice_items?: { id: string; label: string }[];
}

export function useWorkflowSteps(interventionTypeId?: string) {
  const { data: organizationId } = useUserOrganization();

  return useQuery({
    queryKey: ["workflow-steps", interventionTypeId, organizationId],
    queryFn: async () => {
      let query = supabase
        .from("intervention_workflow_steps")
        .select("*")
        .order("step_order", { ascending: true });

      if (interventionTypeId) {
        query = query.eq("intervention_type_id", interventionTypeId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as unknown as WorkflowStep[];
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000, // 5 min
  });
}

export function useWorkflowStepsByType() {
  const { data: organizationId } = useUserOrganization();

  return useQuery({
    queryKey: ["workflow-steps-by-type", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intervention_workflow_steps")
        .select("*")
        .order("step_order", { ascending: true });

      if (error) throw error;

      // Group by intervention type
      const grouped: Record<string, WorkflowStep[]> = {};
      (data as unknown as WorkflowStep[]).forEach((step) => {
        if (!grouped[step.intervention_type_id]) {
          grouped[step.intervention_type_id] = [];
        }
        grouped[step.intervention_type_id].push(step);
      });

      return grouped;
    },
    enabled: !!organizationId,
  });
}

export function useCreateWorkflowStep() {
  const queryClient = useQueryClient();
  const { data: organizationId } = useUserOrganization();

  return useMutation({
    mutationFn: async (input: CreateWorkflowStepInput) => {
      if (!organizationId) throw new Error("No organization found");

      const { data, error } = await supabase
        .from("intervention_workflow_steps")
        .insert({
          ...input,
          organization_id: organizationId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["workflow-steps"] });
      queryClient.invalidateQueries({ queryKey: ["workflow-steps-by-type"] });
      toast({ title: "Étape créée avec succès" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur lors de la création", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateWorkflowStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateWorkflowStepInput) => {
      const { data, error } = await supabase
        .from("intervention_workflow_steps")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow-steps"] });
      queryClient.invalidateQueries({ queryKey: ["workflow-steps-by-type"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur lors de la mise à jour", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteWorkflowStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("intervention_workflow_steps")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow-steps"] });
      queryClient.invalidateQueries({ queryKey: ["workflow-steps-by-type"] });
      toast({ title: "Étape supprimée" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur lors de la suppression", description: error.message, variant: "destructive" });
    },
  });
}

export function useReorderWorkflowSteps() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (steps: { id: string; step_order: number }[]) => {
      const promises = steps.map((step) =>
        supabase
          .from("intervention_workflow_steps")
          .update({ step_order: step.step_order })
          .eq("id", step.id)
      );

      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow-steps"] });
      queryClient.invalidateQueries({ queryKey: ["workflow-steps-by-type"] });
      toast({ title: "Ordre des étapes mis à jour" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur lors de la réorganisation", description: error.message, variant: "destructive" });
    },
  });
}
