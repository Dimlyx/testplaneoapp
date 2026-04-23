/**
 * Counts items in the offline queue that belong to a specific intervention.
 * Used to block the final close action if anything is still waiting to sync.
 */
import { useEffect, useState } from 'react';
import { useOffline } from '@/hooks/useOfflineSync';
import { getPendingMutations, getPendingPhotos, getPendingSignatures } from '@/lib/offline-db';
import { getPendingStepPhotosForIntervention } from '@/lib/step-photo-store';

export interface PendingBreakdown {
  total: number;
  photos: number;       // raw intervention photos in offline-db
  signatures: number;   // signatures in offline-db
  mutations: number;    // misc mutations (status, equipment, step completions...)
  stepPhotos: number;   // step workflow photos still in IndexedDB (local://)
}

const ZERO: PendingBreakdown = {
  total: 0,
  photos: 0,
  signatures: 0,
  mutations: 0,
  stepPhotos: 0,
};

export function usePendingForIntervention(interventionId: string | undefined): {
  pending: PendingBreakdown;
  reload: () => Promise<void>;
} {
  const [pending, setPending] = useState<PendingBreakdown>(ZERO);
  // Re-evaluate whenever the global pending count changes (worker tick, sync, etc.)
  const { pendingCount, isSyncing } = useOffline();

  const reload = async () => {
    if (!interventionId) {
      setPending(ZERO);
      return;
    }
    try {
      const [mutations, photos, signatures, stepPhotos] = await Promise.all([
        getPendingMutations(),
        getPendingPhotos(),
        getPendingSignatures(),
        getPendingStepPhotosForIntervention(interventionId),
      ]);

      const matchesIntervention = (payload: any) =>
        payload?.id === interventionId ||
        payload?.interventionId === interventionId;

      const muCount = mutations.filter(m => matchesIntervention(m.payload)).length;
      const phCount = photos.filter(p => p.interventionId === interventionId).length;
      const sigCount = signatures.filter(s => s.interventionId === interventionId).length;
      const stepCount = stepPhotos.length;

      setPending({
        total: muCount + phCount + sigCount + stepCount,
        mutations: muCount,
        photos: phCount,
        signatures: sigCount,
        stepPhotos: stepCount,
      });
    } catch (e) {
      console.error('usePendingForIntervention: failed to load pending', e);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interventionId, pendingCount, isSyncing]);

  return { pending, reload };
}
