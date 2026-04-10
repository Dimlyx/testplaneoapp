import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOffline } from '@/hooks/useOfflineSync';
import { saveInterventionOffline } from '@/lib/offline-db';
import { useToast } from '@/hooks/use-toast';
import type { Intervention, UpdateInterventionData } from '@/hooks/useInterventions';

/**
 * Offline-first intervention update hook.
 * 1. Applies optimistic update to React Query cache + IndexedDB immediately.
 * 2. Tries to push to Supabase.
 * 3. On network failure, queues the mutation for later sync.
 */
export function useOfflineInterventionUpdate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { queueInterventionUpdate } = useOffline();

  const updateIntervention = useCallback(
    async ({ id, ...data }: UpdateInterventionData) => {
      // 1. Optimistic update: patch React Query cache immediately
      const patchCache = (old: Intervention | undefined) => {
        if (!old) return old;
        return { ...old, ...data } as Intervention;
      };

      // Update single intervention cache
      queryClient.setQueryData<Intervention>(
        ['intervention', id],
        (old) => patchCache(old)
      );

      // Update list caches (technician-interventions, interventions)
      const patchList = (old: Intervention[] | undefined) => {
        if (!old) return old;
        return old.map((i) => (i.id === id ? { ...i, ...data } : i));
      };

      queryClient.setQueriesData<Intervention[]>(
        { queryKey: ['technician-interventions'] },
        patchList
      );

      // 2. Update IndexedDB cache for offline reads
      const cached = queryClient.getQueryData<Intervention>(['intervention', id]);
      if (cached) {
        try {
          await saveInterventionOffline({ ...cached, ...data });
        } catch {
          // IndexedDB write failure is non-critical
        }
      }

      // 3. If offline, skip Supabase entirely and queue
      if (!navigator.onLine) {
        try {
          await queueInterventionUpdate(id, data);
          toast({
            title: 'Enregistré hors-ligne',
            description: 'La modification sera synchronisée au retour de la connexion.',
          });
        } catch (queueErr) {
          console.error('Failed to queue offline mutation:', queueErr);
        }
        return false;
      }

      // 4. Online: try Supabase
      try {
        const { error } = await supabase
          .from('interventions')
          .update(data)
          .eq('id', id);

        if (error) throw error;

        // Refresh from server to get canonical data
        queryClient.invalidateQueries({ queryKey: ['intervention', id] });
        queryClient.invalidateQueries({ queryKey: ['technician-interventions'] });
        return true;
      } catch (err: any) {
        // 4. Network/server error → queue for later sync
        console.warn('Online update failed, queuing offline:', err?.message);
        try {
          await queueInterventionUpdate(id, data);
          toast({
            title: 'Enregistré hors-ligne',
            description: 'La modification sera synchronisée au retour de la connexion.',
          });
        } catch (queueErr) {
          console.error('Failed to queue offline mutation:', queueErr);
          toast({
            title: 'Erreur',
            description: "Impossible d'enregistrer la modification.",
            variant: 'destructive',
          });
        }
        return false;
      }
    },
    [queryClient, queueInterventionUpdate, toast]
  );

  return { updateIntervention };
}
