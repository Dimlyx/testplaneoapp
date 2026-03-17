import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from './useUserOrganization';

export interface TechnicianDetail {
  id: string;
  user_id: string;
  organization_id: string | null;
  technician_type: 'internal' | 'subcontractor';
  address: string | null;
  city: string | null;
  postal_code: string | null;
  hire_date: string | null;
  contract_type: string | null;
  contract_end_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TechnicianWithDetails {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  details: TechnicianDetail | null;
}

export function useTechnicianDetails() {
  const { data: organizationId } = useUserOrganization();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['technician-details', organizationId],
    queryFn: async (): Promise<TechnicianWithDetails[]> => {
      if (!organizationId) return [];

      // Get technicians for this org
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'technician')
        .eq('organization_id', organizationId);

      if (rolesError) throw rolesError;
      if (!roles || roles.length === 0) return [];

      const techIds = roles.map(r => r.user_id);

      // Get profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone')
        .in('id', techIds);

      if (profilesError) throw profilesError;

      // Get HR details
      const { data: details, error: detailsError } = await supabase
        .from('technician_details')
        .select('*')
        .eq('organization_id', organizationId);

      if (detailsError) throw detailsError;

      const detailsMap = new Map((details || []).map((d: any) => [d.user_id, d]));

      return (profiles || []).map(p => ({
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        phone: p.phone,
        details: (detailsMap.get(p.id) as TechnicianDetail) || null,
      }));
    },
    enabled: !!organizationId,
  });

  const upsertDetails = useMutation({
    mutationFn: async (data: {
      user_id: string;
      technician_type: 'internal' | 'subcontractor';
      address?: string | null;
      city?: string | null;
      postal_code?: string | null;
      hire_date?: string | null;
      contract_type?: string | null;
      contract_end_date?: string | null;
      notes?: string | null;
    }) => {
      const { error } = await supabase
        .from('technician_details')
        .upsert({
          ...data,
          organization_id: organizationId!,
        }, { onConflict: 'user_id,organization_id' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technician-details'] });
    },
  });

  return { ...query, upsertDetails };
}
