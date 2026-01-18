import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Equipment {
  id: string;
  client_id: string;
  brand: string;
  model: string;
  equipment_type: string;
  serial_number: string | null;
  installation_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  clients?: {
    id: string;
    name: string;
  };
}

export interface CreateEquipmentData {
  client_id: string;
  brand: string;
  model: string;
  equipment_type: string;
  serial_number?: string;
  installation_date?: string;
  notes?: string;
}

export interface UpdateEquipmentData extends Partial<CreateEquipmentData> {
  id: string;
}

export function useEquipment() {
  return useQuery({
    queryKey: ['equipment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment')
        .select(`
          *,
          clients (id, name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Equipment[];
    },
  });
}

export function useClientEquipment(clientId: string) {
  return useQuery({
    queryKey: ['client-equipment', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .eq('client_id', clientId)
        .order('brand', { ascending: true });

      if (error) throw error;
      return data as Equipment[];
    },
  });
}

export function useCreateEquipment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateEquipmentData) => {
      const { data: result, error } = await supabase
        .from('equipment')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      queryClient.invalidateQueries({ queryKey: ['client-equipment'] });
      toast({
        title: 'Équipement créé',
        description: 'L\'équipement a été créé avec succès.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateEquipment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateEquipmentData) => {
      const { data: result, error } = await supabase
        .from('equipment')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      queryClient.invalidateQueries({ queryKey: ['client-equipment'] });
      toast({
        title: 'Équipement mis à jour',
        description: 'L\'équipement a été mis à jour avec succès.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteEquipment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('equipment')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      queryClient.invalidateQueries({ queryKey: ['client-equipment'] });
      toast({
        title: 'Équipement supprimé',
        description: 'L\'équipement a été supprimé avec succès.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}