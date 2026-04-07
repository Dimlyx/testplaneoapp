import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface CustomStatus {
  id: string;
  organization_id: string;
  name: string;
  label: string;
  color: string;
  status_order: number;
  created_at: string;
  updated_at: string;
}

export function useCustomStatuses() {
  return useQuery({
    queryKey: ['custom-intervention-statuses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_intervention_statuses')
        .select('*')
        .order('status_order', { ascending: true });
      if (error) throw error;
      return (data || []) as CustomStatus[];
    },
    staleTime: 5 * 60 * 1000, // 5 min
  });
}

export function useCreateCustomStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (status: { name: string; label: string; color: string; status_order: number; organization_id: string }) => {
      const { data, error } = await supabase
        .from('custom_intervention_statuses')
        .insert(status)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-intervention-statuses'] });
      toast({ title: 'Statut créé', description: 'Le statut personnalisé a été ajouté.' });
    },
    onError: (error: any) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateCustomStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; label?: string; color?: string; status_order?: number }) => {
      const { error } = await supabase
        .from('custom_intervention_statuses')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-intervention-statuses'] });
      toast({ title: 'Statut modifié', description: 'Le statut a été mis à jour.' });
    },
    onError: (error: any) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteCustomStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('custom_intervention_statuses')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-intervention-statuses'] });
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
      toast({ title: 'Statut supprimé', description: 'Le statut personnalisé a été supprimé.' });
    },
    onError: (error: any) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });
}
