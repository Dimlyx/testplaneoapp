import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';

export interface TechnicianPermissions {
  can_create_intervention: boolean;
  can_cancel_intervention: boolean;
  can_view_history: boolean;
  can_add_photos: boolean;
  can_sign_client: boolean;
}

const DEFAULT_PERMISSIONS: TechnicianPermissions = {
  can_create_intervention: false,
  can_cancel_intervention: true,
  can_view_history: true,
  can_add_photos: true,
  can_sign_client: true,
};

export function useTechnicianPermissions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['technician-permissions', user?.id],
    queryFn: async (): Promise<TechnicianPermissions> => {
      if (!user?.id) return DEFAULT_PERMISSIONS;

      const { data } = await (supabase as any)
        .from('technician_details')
        .select('permissions')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!data?.permissions) return DEFAULT_PERMISSIONS;

      return { ...DEFAULT_PERMISSIONS, ...data.permissions };
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 min - permissions don't change often
  });
}
