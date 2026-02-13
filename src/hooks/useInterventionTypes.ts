import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUserOrganization } from "./useUserOrganization";

export interface InterventionType {
  id: string;
  name: string;
  label: string;
  color: string;
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
  });
}

export function useCreateInterventionType() {
  const queryClient = useQueryClient();
  const { data: organizationId } = useUserOrganization();

  return useMutation({
    mutationFn: async ({ name, label, color }: { name: string; label: string; color: string }) => {
      if (!organizationId) throw new Error("No organization found");
      const { data, error } = await supabase
        .from("intervention_types")
        .insert({ name, label, color, organization_id: organizationId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["intervention-types"] });
      toast.success("Type d'intervention créé");
    },
    onError: (error: Error) => {
      toast.error("Erreur lors de la création: " + error.message);
    },
  });
}

export function useUpdateInterventionType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name, label, color }: { id: string; name: string; label: string; color: string }) => {
      const { data, error } = await supabase
        .from("intervention_types")
        .update({ name, label, color })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["intervention-types"] });
      toast.success("Type d'intervention mis à jour");
    },
    onError: (error: Error) => {
      toast.error("Erreur lors de la mise à jour: " + error.message);
    },
  });
}

export function useDeleteInterventionType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("intervention_types")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["intervention-types"] });
      toast.success("Type d'intervention supprimé");
    },
    onError: (error: Error) => {
      toast.error("Erreur lors de la suppression: " + error.message);
    },
  });
}
