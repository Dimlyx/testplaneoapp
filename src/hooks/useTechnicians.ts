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
      const { data, error } = await supabase
        .from('user_roles')
        .select(`
          user_id,
          profiles:user_id (
            id,
            full_name,
            email
          )
        `)
        .eq('role', 'technician');

      if (error) throw error;
      
      return data
        .filter(item => item.profiles)
        .map(item => ({
          id: (item.profiles as any).id,
          full_name: (item.profiles as any).full_name,
          email: (item.profiles as any).email,
        })) as Technician[];
    },
  });
}