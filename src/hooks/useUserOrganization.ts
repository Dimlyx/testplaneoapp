import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useOrganizationContext } from '@/lib/organization-context';

export function useUserOrganization() {
  const { user, role } = useAuth();
  const { viewAsOrgId } = useOrganizationContext();

  return useQuery({
    queryKey: ['user-organization', user?.id, viewAsOrgId],
    queryFn: async () => {
      if (!user?.id) return null;

      // If super admin is viewing as an organization, use that org ID
      if (role === 'super_admin' && viewAsOrgId) {
        return viewAsOrgId;
      }

      const { data, error } = await supabase
        .from('user_roles')
        .select('organization_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data?.organization_id || null;
    },
    enabled: !!user?.id,
  });
}
