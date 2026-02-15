import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserOrganization } from '@/hooks/useUserOrganization';

export interface ClientNote {
  id: string;
  client_id: string;
  organization_id: string | null;
  content: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useClientNotes(clientId: string) {
  return useQuery({
    queryKey: ['client-notes', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_notes')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ClientNote[];
    },
    enabled: !!clientId,
  });
}

export function useCreateClientNote() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: organizationId } = useUserOrganization();

  return useMutation({
    mutationFn: async (data: { client_id: string; content: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: result, error } = await supabase
        .from('client_notes')
        .insert({ ...data, organization_id: organizationId || null, created_by: user?.id || null })
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['client-notes', variables.client_id] });
      toast({ title: 'Note ajoutée' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteClientNote() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, clientId }: { id: string; clientId: string }) => {
      const { error } = await supabase.from('client_notes').delete().eq('id', id);
      if (error) throw error;
      return clientId;
    },
    onSuccess: (clientId) => {
      queryClient.invalidateQueries({ queryKey: ['client-notes', clientId] });
      toast({ title: 'Note supprimée' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });
}
