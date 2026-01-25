import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Technician {
  id: string;
  full_name: string | null;
  email: string;
}

export function useTechnicians(organizationId?: string | null) {
  return useQuery({
    queryKey: ['technicians', organizationId],
    queryFn: async () => {
      // First get technician user_ids for this organization
      let query = supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'technician');
      
      // Filter by organization if provided
      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      const { data: roles, error: rolesError } = await query;

      if (rolesError) throw rolesError;
      if (!roles || roles.length === 0) return [];

      const technicianIds = roles.map(r => r.user_id);

      // Then get their profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', technicianIds);

      if (profilesError) throw profilesError;

      return (profiles || []) as Technician[];
    },
  });
}
