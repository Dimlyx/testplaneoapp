import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOffline } from '@/hooks/useOfflineSync';
import { saveInterventionOffline } from '@/lib/offline-db';
import { useToast } from '@/hooks/use-toast';
import { isReallyOnline } from '@/lib/network-status';
import { withTimeout, isTimeoutError } from '@/lib/supabase-with-timeout';
import type { Intervention, UpdateInterventionData } from '@/hooks/useInterventions';

/**
 * Offline-first intervention update hook.
 * 1. Applies optimistic update to React Query cache + IndexedDB immediately (instant UI).
 * 2. Fires Supabase push in the background (non-blocking).
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

      queryClient.setQueryData<Intervention>(
        ['intervention', id],
        (old) => patchCache(old)
      );

      queryClient.setQueriesData<Intervention[]>(
        { queryKey: ['technician-interventions'] },
        (old) => {
          if (!old) return old;
          return old.map((i) => (i.id === id ? { ...i, ...data } : i));
        }
      );

      // 2. Save to IndexedDB (fast, non-blocking for UI)
      const cached = queryClient.getQueryData<Intervention>(['intervention', id]);
      if (cached) {
        saveInterventionOffline({ ...cached, ...data }).catch(() => {});
      }

      // 3. If offline, queue and return immediately
      if (!isReallyOnline()) {
        queueInterventionUpdate(id, data).catch(() => {});
        toast({
          title: 'Enregistré hors-ligne',
          description: 'Synchronisation au retour de la connexion.',
        });
        return;
      }

      // 4. Online: fire-and-forget Supabase push in background
      Promise.resolve(
        supabase
          .from('interventions')
          .update(data)
          .eq('id', id)
      )
        .then(({ error }) => {
          if (error) throw error;
          queryClient.invalidateQueries({ queryKey: ['intervention', id] });
          queryClient.invalidateQueries({ queryKey: ['technician-interventions'] });
        })
        .catch((err: any) => {
          console.warn('Background sync failed, queuing offline:', err?.message);
          queueInterventionUpdate(id, data).catch(() => {});
        });
    },
    [queryClient, queueInterventionUpdate, toast]
  );

  return { updateIntervention };
}
