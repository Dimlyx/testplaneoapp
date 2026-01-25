import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';

export function useUserOrganization() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-organization', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

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
