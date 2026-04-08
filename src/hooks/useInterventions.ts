import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserOrganization } from '@/hooks/useUserOrganization';

export type InterventionStatus = 'to_plan' | 'planned' | 'in_progress' | 'completed' | 'to_invoice' | 'archived' | 'cancelled';
export type InterventionType = string;

export interface Intervention {
  id: string;
  public_token: string;
  client_id: string;
  equipment_id: string | null;
  technician_id: string | null;
  organization_id: string | null;
  intervention_type: InterventionType;
  status: InterventionStatus;
  title: string;
  description: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  report: string | null;
  technical_comments: string | null;
  arrival_time: string | null;
  departure_time: string | null;
  travel_departure_time: string | null;
  travel_return_time: string | null;
  observations: string | null;
  equipment_functional: boolean | null;
  client_signature_name: string | null;
  client_signature_url: string | null;
  intervention_address: string | null;
  intervention_building: string | null;
  intervention_floor: string | null;
  intervention_city: string | null;
  intervention_postal_code: string | null;
  intervention_phone: string | null;
  intervention_email: string | null;
  intervention_contact_name: string | null;
  is_paused: boolean;
  token_expires_at: string | null;
  custom_status_id: string | null;
  estimated_duration: number | null;
  team_id: string | null;
  cancellation_reason: string | null;
  cancellation_details: string | null;
  cancellation_photos: string[] | null;
  created_at: string;
  updated_at: string;
  clients?: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    postal_code?: string | null;
    client_type?: string;
    organization_id?: string | null;
  };
  profiles?: {
    id: string;
    full_name: string | null;
    email: string;
    organization_id?: string | null;
  } | null;
}

export interface CreateInterventionData {
  client_id: string;
  technician_id?: string | null;
  intervention_type: InterventionType;
  title: string;
  description?: string;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  intervention_address?: string | null;
  intervention_city?: string | null;
  intervention_postal_code?: string | null;
  intervention_phone?: string | null;
  intervention_email?: string | null;
  estimated_duration?: number | null;
  organization_id?: string | null;
  equipment_id?: string | null;
  intervention_building?: string | null;
  intervention_floor?: string | null;
  intervention_contact_name?: string | null;
  status?: InterventionStatus;
}

export interface UpdateInterventionData {
  id: string;
  client_id?: string;
  technician_id?: string | null;
  intervention_type?: InterventionType;
  status?: InterventionStatus;
  title?: string;
  description?: string;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  report?: string;
  technical_comments?: string;
  arrival_time?: string | null;
  departure_time?: string | null;
  travel_departure_time?: string | null;
  travel_return_time?: string | null;
  observations?: string;
  client_signature_name?: string;
  client_signature_url?: string;
  intervention_address?: string | null;
  intervention_city?: string | null;
  intervention_postal_code?: string | null;
  intervention_phone?: string | null;
  intervention_email?: string | null;
  intervention_contact_name?: string | null;
  estimated_duration?: number | null;
  is_paused?: boolean;
  cancellation_reason?: string | null;
  cancellation_details?: string | null;
  cancellation_photos?: string[];
}

interface AssignmentPushPayload {
  userId: string;
  title: string;
  message: string;
  interventionId: string;
}

async function sendAssignmentPush(payload: AssignmentPushPayload) {
  const { error } = await supabase.functions.invoke('send-push-notification', {
    body: payload,
  });

  if (error) {
    console.warn('Push notification send failed:', error);
  }
}

export function useInterventions() {
  const { data: organizationId } = useUserOrganization();

  return useQuery({
    queryKey: ['interventions', organizationId],
    queryFn: async () => {
      let query = supabase
        .from('interventions')
        .select(`
          *,
          clients (id, name, email, phone, address, city)
        `)
        .order('created_at', { ascending: false });

      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Fetch technician profiles separately
      const interventionsWithProfiles = await Promise.all(
        (data || []).map(async (intervention) => {
          if (intervention.technician_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('id, full_name, email')
              .eq('id', intervention.technician_id)
              .maybeSingle();
            return { ...intervention, profiles: profile };
          }
          return { ...intervention, profiles: null };
        })
      );
      
      return interventionsWithProfiles as Intervention[];
    },
  });
}

export function useTechnicianInterventions(technicianId: string | undefined) {
  return useQuery({
    queryKey: ['technician-interventions', technicianId],
    queryFn: async () => {
      if (!technicianId) return [];
      
      // Fetch directly assigned interventions
      const { data: directData, error: directError } = await supabase
        .from('interventions')
        .select(`
          *,
          clients (id, name, email, phone, address, city)
        `)
        .eq('technician_id', technicianId)
        .order('scheduled_date', { ascending: true });

      if (directError) throw directError;

      // Fetch team interventions (where user is a team member but not the leader/technician_id)
      // RLS policy "Team members can view team interventions" handles access control
      const { data: teamMemberships } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', technicianId);

      let teamInterventions: any[] = [];
      if (teamMemberships && teamMemberships.length > 0) {
        const teamIds = teamMemberships.map(m => m.team_id);
        const { data: teamData } = await supabase
          .from('interventions')
          .select(`
            *,
            clients (id, name, email, phone, address, city)
          `)
          .in('team_id', teamIds)
          .neq('technician_id', technicianId)
          .order('scheduled_date', { ascending: true });
        teamInterventions = teamData || [];
      }

      const allInterventions = [
        ...(directData || []).map(d => ({ ...d, profiles: null })),
        ...teamInterventions.map((d: any) => ({ ...d, profiles: null, _isTeamMember: true })),
      ] as Intervention[];

      // Sort chronologically by date then time
      allInterventions.sort((a, b) => {
        const dateA = a.scheduled_date || '9999-12-31';
        const dateB = b.scheduled_date || '9999-12-31';
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        const timeA = a.scheduled_time || '99:99';
        const timeB = b.scheduled_time || '99:99';
        return timeA.localeCompare(timeB);
      });

      return allInterventions;
    },
    enabled: !!technicianId,
  });
}

export function useIntervention(id: string) {
  return useQuery({
    queryKey: ['intervention', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('interventions')
        .select(`
          *,
          clients (id, name, email, phone, address, city, postal_code, client_type)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      
      let profiles = null;
      if (data.technician_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('id', data.technician_id)
          .maybeSingle();
        profiles = profile;
      }
      
      return { ...data, profiles } as Intervention;
    },
  });
}

export function usePublicIntervention(token: string) {
  return useQuery({
    queryKey: ['public-intervention', token],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('interventions')
        .select(`
          *,
          clients (id, name, email, phone, address, city, postal_code, client_type)
        `)
        .eq('public_token', token)
        .maybeSingle();

      if (error) throw error;
      return data as Intervention | null;
    },
    enabled: !!token,
  });
}

export function useCreateIntervention(organizationId?: string | null) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateInterventionData) => {
      const insertData = {
        ...data,
        organization_id: data.organization_id || organizationId || null,
      };
      
      const { data: result, error } = await supabase
        .from('interventions')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      if (result?.technician_id) {
        await sendAssignmentPush({
          userId: result.technician_id,
          title: 'Nouvelle intervention assignée',
          message: `L'intervention "${result.title}" vous a été assignée.`,
          interventionId: result.id,
        });
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
      toast({
        title: 'Intervention créée',
        description: 'L\'intervention a été créée avec succès.',
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

export function useUpdateIntervention() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateInterventionData) => {
      const { data: previousIntervention } = await supabase
        .from('interventions')
        .select('technician_id, title')
        .eq('id', id)
        .maybeSingle();

      const { data: result, error } = await supabase
        .from('interventions')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      const technicianChanged =
        !!result?.technician_id &&
        result.technician_id !== previousIntervention?.technician_id;

      if (technicianChanged) {
        await sendAssignmentPush({
          userId: result.technician_id,
          title: 'Nouvelle intervention assignée',
          message: `L'intervention "${result.title}" vous a été assignée.`,
          interventionId: result.id,
        });
      }

      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
      queryClient.invalidateQueries({ queryKey: ['technician-interventions'] });
      queryClient.invalidateQueries({ queryKey: ['intervention', result.id] });
      toast({
        title: 'Intervention mise à jour',
        description: 'L\'intervention a été mise à jour avec succès.',
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

export function useDeleteIntervention() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('interventions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
      toast({
        title: 'Intervention supprimée',
        description: 'L\'intervention a été supprimée avec succès.',
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
