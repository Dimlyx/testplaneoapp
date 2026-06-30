import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserOrganization } from '@/hooks/useUserOrganization';

export type ContractPeriod = 'day' | 'week' | 'month' | 'year';

export interface ClientContract {
  id: string;
  client_id: string;
  organization_id: string;
  name: string;
  contract_type: string | null;
  start_date: string | null;
  end_date: string | null;
  visits_per_period: number | null;
  visits_period: ContractPeriod;
  notes: string | null;
  file_url: string | null;
  file_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  clients?: { id: string; name: string; client_type?: string; city?: string | null } | null;
}

export interface UpsertClientContractData {
  id?: string;
  client_id: string;
  name: string;
  contract_type?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  visits_per_period?: number | null;
  visits_period?: ContractPeriod;
  notes?: string | null;
  file_url?: string | null;
  file_name?: string | null;
  is_active?: boolean;
}

async function syncClientFlag(clientId: string) {
  const { count } = await supabase
    .from('client_maintenance_contracts')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .eq('is_active', true);
  await supabase
    .from('clients')
    .update({ has_maintenance_contract: (count ?? 0) > 0 })
    .eq('id', clientId);
}

export function useClientContracts(clientId?: string) {
  return useQuery({
    queryKey: ['client-contracts', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('client_maintenance_contracts')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as ClientContract[];
    },
    enabled: !!clientId,
  });
}

export function useAllContracts() {
  const { data: organizationId } = useUserOrganization();
  return useQuery({
    queryKey: ['all-contracts', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('client_maintenance_contracts')
        .select('*, clients(id, name, client_type, city)')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as ClientContract[];
    },
    enabled: !!organizationId,
  });
}

export function useUpsertClientContract() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: organizationId } = useUserOrganization();

  return useMutation({
    mutationFn: async (input: UpsertClientContractData) => {
      const { id, ...rest } = input;
      if (id) {
        const { data, error } = await supabase
          .from('client_maintenance_contracts')
          .update(rest)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        await syncClientFlag(input.client_id);
        return data as ClientContract;
      } else {
        const { data, error } = await supabase
          .from('client_maintenance_contracts')
          .insert({ ...rest, organization_id: organizationId } as any)
          .select()
          .single();
        if (error) throw error;
        await syncClientFlag(input.client_id);
        return data as ClientContract;
      }
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['client-contracts', vars.client_id] });
      queryClient.invalidateQueries({ queryKey: ['all-contracts'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client', vars.client_id] });
      toast({ title: vars.id ? 'Contrat mis à jour' : 'Contrat créé' });
    },
    onError: (error: any) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteClientContract() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, client_id }: { id: string; client_id: string }) => {
      const { error } = await supabase
        .from('client_maintenance_contracts')
        .delete()
        .eq('id', id);
      if (error) throw error;
      await syncClientFlag(client_id);
      return { id, client_id };
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['client-contracts', res.client_id] });
      queryClient.invalidateQueries({ queryKey: ['all-contracts'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client', res.client_id] });
      toast({ title: 'Contrat supprimé' });
    },
    onError: (error: any) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });
}
