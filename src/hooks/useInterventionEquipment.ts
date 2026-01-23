import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type EquipmentStatus = 'not_working' | 'needs_intervention' | 'working';

export interface InterventionEquipment {
  id: string;
  intervention_id: string;
  equipment_id: string;
  technical_comments: string | null;
  equipment_functional: boolean | null;
  equipment_status: EquipmentStatus | null;
  created_at: string;
  updated_at: string;
  equipment?: {
    id: string;
    brand: string;
    model: string;
    equipment_type: string;
    serial_number: string | null;
  };
}

export interface ClientEquipment {
  id: string;
  brand: string;
  model: string;
  equipment_type: string;
  serial_number: string | null;
  client_id: string;
}

// Hook to fetch all equipment for a client
export function useClientEquipment(clientId: string) {
  return useQuery({
    queryKey: ['client-equipment', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .eq('client_id', clientId)
        .order('equipment_type', { ascending: true });

      if (error) throw error;
      return data as ClientEquipment[];
    },
    enabled: !!clientId,
  });
}

// Hook to fetch equipment linked to an intervention
export function useInterventionEquipment(interventionId: string) {
  return useQuery({
    queryKey: ['intervention-equipment', interventionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('intervention_equipment')
        .select(`
          *,
          equipment (id, brand, model, equipment_type, serial_number)
        `)
        .eq('intervention_id', interventionId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as InterventionEquipment[];
    },
    enabled: !!interventionId,
  });
}

// Hook to add equipment to intervention
export function useAddInterventionEquipment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      interventionId, 
      equipmentId 
    }: { 
      interventionId: string; 
      equipmentId: string;
    }) => {
      const { data, error } = await supabase
        .from('intervention_equipment')
        .insert({
          intervention_id: interventionId,
          equipment_id: equipmentId,
        })
        .select(`
          *,
          equipment (id, brand, model, equipment_type, serial_number)
        `)
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['intervention-equipment', variables.interventionId] });
      toast({
        title: 'Équipement ajouté',
        description: 'L\'équipement a été ajouté à l\'intervention.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur',
        description: error.message.includes('duplicate') 
          ? 'Cet équipement est déjà dans l\'intervention.'
          : error.message,
        variant: 'destructive',
      });
    },
  });
}

// Hook to update intervention equipment
export function useUpdateInterventionEquipment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      id,
      interventionId,
      technical_comments,
      equipment_status,
    }: { 
      id: string;
      interventionId: string;
      technical_comments?: string;
      equipment_status?: EquipmentStatus;
    }) => {
      const { data, error } = await supabase
        .from('intervention_equipment')
        .update({
          technical_comments,
          equipment_status,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { ...data, interventionId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['intervention-equipment', data.interventionId] });
      toast({
        title: 'Équipement mis à jour',
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

// Hook to remove equipment from intervention
export function useRemoveInterventionEquipment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      id, 
      interventionId 
    }: { 
      id: string; 
      interventionId: string;
    }) => {
      const { error } = await supabase
        .from('intervention_equipment')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return interventionId;
    },
    onSuccess: (interventionId) => {
      queryClient.invalidateQueries({ queryKey: ['intervention-equipment', interventionId] });
      toast({
        title: 'Équipement retiré',
        description: 'L\'équipement a été retiré de l\'intervention.',
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
