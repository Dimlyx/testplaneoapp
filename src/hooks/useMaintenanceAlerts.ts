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
  equipment_id: string | null;
  alert_date: string;
  recurrence: AlertRecurrence;
  recurrence_months: number;
  status: AlertStatus;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
  clients?: {
    id: string;
    name: string;
  } | null;
}

export interface CreateMaintenanceAlertData {
  title: string;
  description?: string;
  client_id?: string;
  alert_date: string;
  recurrence?: AlertRecurrence;
}

export interface UpdateMaintenanceAlertData {
  id: string;
  title?: string;
  description?: string;
  client_id?: string | null;
  alert_date?: string;
  recurrence?: AlertRecurrence;
  status?: AlertStatus;
}

export function useMaintenanceAlerts() {
  return useQuery({
    queryKey: ['maintenance-alerts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maintenance_alerts')
        .select(`
          *,
          clients (id, name)
        `)
        .order('alert_date', { ascending: true });

      if (error) throw error;
      return data as MaintenanceAlert[];
    },
  });
}

export function usePendingAlerts() {
  return useQuery({
    queryKey: ['pending-alerts'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('maintenance_alerts')
        .select(`
          *,
          clients (id, name)
        `)
        .eq('status', 'pending')
        .lte('alert_date', today)
        .order('alert_date', { ascending: true });

      if (error) throw error;
      return data as MaintenanceAlert[];
    },
  });
}

export function useUpcomingAlerts(days: number = 30) {
  return useQuery({
    queryKey: ['upcoming-alerts', days],
    queryFn: async () => {
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + days);
      
      const { data, error } = await supabase
        .from('maintenance_alerts')
        .select(`
          *,
          clients (id, name)
        `)
        .in('status', ['pending', 'acknowledged'])
        .gte('alert_date', today.toISOString().split('T')[0])
        .lte('alert_date', futureDate.toISOString().split('T')[0])
        .order('alert_date', { ascending: true });

      if (error) throw error;
      return data as MaintenanceAlert[];
    },
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
          alert_date: data.alert_date,
          recurrence: data.recurrence || 'once',
          organization_id: organizationId,
        })
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
