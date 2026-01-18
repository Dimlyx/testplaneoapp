import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Technician {
  id: string;
  full_name: string | null;
  email: string;
}

export function useTechnicians() {
  return useQuery({
    queryKey: ['technicians'],
    queryFn: async () => {
      // First get technician user_ids
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'technician');

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