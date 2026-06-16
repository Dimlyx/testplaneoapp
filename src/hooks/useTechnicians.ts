import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useUserOrganization';

export interface Technician {
  id: string;
  full_name: string | null;
  email: string;
}

export function useTechnicians(organizationId?: string | null) {
  const { data: currentOrgId } = useUserOrganization();
  // Always scope to an organization — falls back to the current (or impersonated)
  // org so super_admin impersonation doesn't leak technicians from other orgs.
  const effectiveOrgId = organizationId ?? currentOrgId ?? null;

  return useQuery({
    queryKey: ['technicians', effectiveOrgId],
    queryFn: async () => {
      if (!effectiveOrgId) return [];

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'technician')
        .eq('organization_id', effectiveOrgId);

      if (rolesError) throw rolesError;
      if (!roles || roles.length === 0) return [];

      const technicianIds = roles.map(r => r.user_id);

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', technicianIds);

      if (profilesError) throw profilesError;

      return (profiles || []) as Technician[];
    },
    enabled: !!effectiveOrgId,
  });
}
