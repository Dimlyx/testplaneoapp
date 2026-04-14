import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useUserOrganization } from "./useUserOrganization";

export interface InterventionType {
  id: string;
  name: string;
  label: string;
  color: string;
  track_journey: boolean;
  allow_loop: boolean;
  created_at: string;
}

export function useInterventionTypes() {
  return useQuery({
    queryKey: ["intervention-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intervention_types")
        .select("*")
        .order("label", { ascending: true });

      if (error) throw error;
      return data as InterventionType[];
    },
    staleTime: 5 * 60 * 1000, // 5 min
  });
}

export function useCreateInterventionType() {
  const queryClient = useQueryClient();
  const { data: organizationId } = useUserOrganization();

  return useMutation({
    mutationFn: async ({ name, label, color, track_journey = true, allow_loop = false }: { name: string; label: string; color: string; track_journey?: boolean; allow_loop?: boolean }) => {
      if (!organizationId) throw new Error("No organization found");
      const { data, error } = await supabase
        .from("intervention_types")
        .insert({ name, label, color, track_journey, allow_loop, organization_id: organizationId } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["intervention-types"] });
      toast({ title: "Type d'intervention créé" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur lors de la création", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateInterventionType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name, label, color, track_journey, allow_loop }: { id: string; name: string; label: string; color: string; track_journey: boolean; allow_loop: boolean }) => {
      const { error } = await supabase
        .from("intervention_types")
        .update({ name, label, color, track_journey, allow_loop } as any)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["intervention-types"] });
      toast({ title: "Type d'intervention mis à jour" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur lors de la mise à jour", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteInterventionType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // First delete related workflow steps to avoid FK constraint violation
      const { error: stepsError } = await supabase
        .from("intervention_workflow_steps")
        .delete()
        .eq("intervention_type_id", id);

      if (stepsError) throw stepsError;

      const { error } = await supabase
        .from("intervention_types")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["intervention-types"] });
      queryClient.invalidateQueries({ queryKey: ["workflow-steps"] });
      queryClient.invalidateQueries({ queryKey: ["interventions"] });
      queryClient.invalidateQueries({ queryKey: ["technician-interventions"] });
      toast({ title: "Type d'intervention supprimé" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur lors de la suppression", description: error.message, variant: "destructive" });
    },
  });
}
