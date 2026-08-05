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

export async function getPendingForIntervention(
  interventionId: string | undefined,
): Promise<PendingBreakdown> {
  if (!interventionId) return ZERO;

  const [mutations, photos, signatures, stepPhotos] = await Promise.all([
    getPendingMutations(),
    getPendingPhotos(),
    getPendingSignatures(),
    getPendingStepPhotosForIntervention(interventionId),
  ]);

  const matchesIntervention = (payload: any) =>
    payload?.id === interventionId || payload?.interventionId === interventionId;

  const mutationCount = mutations.filter((mutation) => matchesIntervention(mutation.payload)).length;
  const photoCount = photos.filter((photo) => photo.interventionId === interventionId).length;
  const signatureCount = signatures.filter((signature) => signature.interventionId === interventionId).length;
  const stepPhotoCount = stepPhotos.length;

  return {
    total: mutationCount + photoCount + signatureCount + stepPhotoCount,
    mutations: mutationCount,
    photos: photoCount,
    signatures: signatureCount,
    stepPhotos: stepPhotoCount,
  };
}

export function usePendingForIntervention(interventionId: string | undefined): {
  pending: PendingBreakdown;
  reload: () => Promise<PendingBreakdown>;
} {
  const [pending, setPending] = useState<PendingBreakdown>(ZERO);
  // Re-evaluate whenever the global pending count changes (worker tick, sync, etc.)
  const { pendingCount, isSyncing } = useOffline();

  const reload = async () => {
    if (!interventionId) {
      setPending(ZERO);
      return ZERO;
    }
    try {
      const nextPending = await getPendingForIntervention(interventionId);
      setPending(nextPending);
      return nextPending;
    } catch (e) {
      console.error('usePendingForIntervention: failed to load pending', e);
      return pending;
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interventionId, pendingCount, isSyncing]);

  return { pending, reload };
}
