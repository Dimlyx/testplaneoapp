import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface InterventionPause {
  id: string;
  intervention_id: string;
  paused_by: string | null;
  paused_at: string;
  resumed_at: string | null;
  pause_reason: string;
  created_at: string;
}

export function useInterventionPauses(interventionId: string) {
  return useQuery({
    queryKey: ['intervention-pauses', interventionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('intervention_pauses')
        .select('*')
        .eq('intervention_id', interventionId)
        .order('paused_at', { ascending: false });
      if (error) throw error;
      return data as InterventionPause[];
    },
    enabled: !!interventionId,
  });
}

export function useActivePause(interventionId: string) {
  const { data: pauses = [] } = useInterventionPauses(interventionId);
  return pauses.find(p => !p.resumed_at) || null;
}

export function usePauseIntervention() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ interventionId, reason }: { interventionId: string; reason: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Create pause record
      const { error: pauseError } = await supabase
        .from('intervention_pauses')
        .insert({
          intervention_id: interventionId,
          paused_by: user?.id || null,
          pause_reason: reason,
        });
      if (pauseError) throw pauseError;

      // Update intervention is_paused flag
      const { error: updateError } = await supabase
        .from('interventions')
        .update({ is_paused: true })
        .eq('id', interventionId);
      if (updateError) throw updateError;
    },
    onSuccess: (_, { interventionId }) => {
      queryClient.invalidateQueries({ queryKey: ['intervention-pauses', interventionId] });
      queryClient.invalidateQueries({ queryKey: ['intervention', interventionId] });
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
      queryClient.invalidateQueries({ queryKey: ['technician-interventions'] });
    },
  });
}

export function useResumeIntervention() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ interventionId, pauseId }: { interventionId: string; pauseId: string }) => {
      // Update pause record with resumed_at
      const { error: pauseError } = await supabase
        .from('intervention_pauses')
        .update({ resumed_at: new Date().toISOString() })
        .eq('id', pauseId);
      if (pauseError) throw pauseError;

      // Update intervention is_paused flag
      const { error: updateError } = await supabase
        .from('interventions')
        .update({ is_paused: false })
        .eq('id', interventionId);
      if (updateError) throw updateError;
    },
    onSuccess: (_, { interventionId }) => {
      queryClient.invalidateQueries({ queryKey: ['intervention-pauses', interventionId] });
      queryClient.invalidateQueries({ queryKey: ['intervention', interventionId] });
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
      queryClient.invalidateQueries({ queryKey: ['technician-interventions'] });
    },
  });
}
