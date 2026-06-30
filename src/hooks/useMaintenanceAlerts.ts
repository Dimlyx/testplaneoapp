import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserOrganization } from '@/hooks/useUserOrganization';

export type AlertRecurrence = 'once' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type AlertStatus = 'pending' | 'acknowledged' | 'completed' | 'dismissed';

export interface MaintenanceAlert {
  id: string;
  title: string;
  description: string | null;
  client_id: string | null;
  contract_id: string | null;
  equipment_id: string | null;
  alert_date: string;
  recurrence: AlertRecurrence;
  recurrence_months: number;
  day_of_month: number | null;
  status: AlertStatus;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
  clients?: {
    id: string;
    name: string;
  } | null;
  client_maintenance_contracts?: {
    id: string;
    name: string;
  } | null;
}

export interface CreateMaintenanceAlertData {
  title: string;
  description?: string;
  client_id?: string;
  contract_id?: string | null;
  alert_date: string;
  recurrence?: AlertRecurrence;
  recurrence_months?: number;
  day_of_month?: number | null;
}

export interface UpdateMaintenanceAlertData {
  id: string;
  title?: string;
  description?: string;
  client_id?: string | null;
  contract_id?: string | null;
  alert_date?: string;
  recurrence?: AlertRecurrence;
  recurrence_months?: number;
  day_of_month?: number | null;
  status?: AlertStatus;
}

export function useMaintenanceAlerts() {
  const { data: organizationId } = useUserOrganization();
  return useQuery({
    queryKey: ['maintenance-alerts', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('maintenance_alerts')
        .select(`
          *,
          clients (id, name),
          client_maintenance_contracts (id, name)
        `)
        .eq('organization_id', organizationId)
        .order('alert_date', { ascending: true });

      if (error) throw error;
      return data as MaintenanceAlert[];
    },
    enabled: !!organizationId,
  });
}

export function usePendingAlerts() {
  const { data: organizationId } = useUserOrganization();
  return useQuery({
    queryKey: ['pending-alerts', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('maintenance_alerts')
        .select(`
          *,
          clients (id, name)
        `)
        .eq('organization_id', organizationId)
        .eq('status', 'pending')
        .lte('alert_date', today)
        .order('alert_date', { ascending: true });

      if (error) throw error;
      return data as MaintenanceAlert[];
    },
    enabled: !!organizationId,
  });
}

export function useUpcomingAlerts(days: number = 30) {
  const { data: organizationId } = useUserOrganization();
  return useQuery({
    queryKey: ['upcoming-alerts', days, organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + days);
      
      const { data, error } = await supabase
        .from('maintenance_alerts')
        .select(`
          *,
          clients (id, name)
        `)
        .eq('organization_id', organizationId)
        .in('status', ['pending', 'acknowledged'])
        .gte('alert_date', today.toISOString().split('T')[0])
        .lte('alert_date', futureDate.toISOString().split('T')[0])
        .order('alert_date', { ascending: true });

      if (error) throw error;
      return data as MaintenanceAlert[];
    },
    enabled: !!organizationId,
  });
}

export function useCreateMaintenanceAlert() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: organizationId } = useUserOrganization();

  return useMutation({
    mutationFn: async (data: CreateMaintenanceAlertData) => {
      const { data: result, error } = await supabase
        .from('maintenance_alerts')
        .insert({
          title: data.title,
          description: data.description || null,
          client_id: data.client_id || null,
          contract_id: data.contract_id || null,
          alert_date: data.alert_date,
          recurrence: data.recurrence || 'once',
          recurrence_months: data.recurrence_months ?? 0,
          day_of_month: data.day_of_month ?? null,
          organization_id: organizationId,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['pending-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-alerts'] });
      toast({
        title: 'Alerte créée',
        description: 'L\'alerte de maintenance a été créée avec succès.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: 'Impossible de créer l\'alerte: ' + error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateMaintenanceAlert() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateMaintenanceAlertData) => {
      const { data: result, error } = await supabase
        .from('maintenance_alerts')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['pending-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-alerts'] });
      toast({
        title: 'Alerte mise à jour',
        description: 'L\'alerte a été mise à jour avec succès.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: 'Impossible de mettre à jour l\'alerte: ' + error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteMaintenanceAlert() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('maintenance_alerts')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['pending-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-alerts'] });
      toast({
        title: 'Alerte supprimée',
        description: 'L\'alerte a été supprimée avec succès.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer l\'alerte: ' + error.message,
        variant: 'destructive',
      });
    },
  });
}
