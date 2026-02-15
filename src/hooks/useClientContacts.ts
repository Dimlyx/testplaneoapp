import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserOrganization } from '@/hooks/useUserOrganization';

export interface ClientContact {
  id: string;
  client_id: string;
  organization_id: string | null;
  full_name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export function useClientContacts(clientId: string) {
  return useQuery({
    queryKey: ['client-contacts', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_contacts')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as ClientContact[];
    },
    enabled: !!clientId,
  });
}

export function useCreateClientContact() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: organizationId } = useUserOrganization();

  return useMutation({
    mutationFn: async (data: { client_id: string; full_name: string; role?: string; email?: string; phone?: string }) => {
      const { data: result, error } = await supabase
        .from('client_contacts')
        .insert({ ...data, organization_id: organizationId || null })
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['client-contacts', variables.client_id] });
      toast({ title: 'Interlocuteur ajouté' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteClientContact() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, clientId }: { id: string; clientId: string }) => {
      const { error } = await supabase.from('client_contacts').delete().eq('id', id);
      if (error) throw error;
      return clientId;
    },
    onSuccess: (clientId) => {
      queryClient.invalidateQueries({ queryKey: ['client-contacts', clientId] });
      toast({ title: 'Interlocuteur supprimé' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });
}
