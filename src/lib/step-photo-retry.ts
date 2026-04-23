/**
 * Background retry worker for orphaned step photos.
 *
 * Photos that were captured by the technician but failed to upload remain
 * in IndexedDB with a `local://step-photo/<id>` reference inside the
 * intervention_step_completions.photo_url column.
 *
 * This worker:
 *  1. Lists every locally-stored photo (across all interventions).
 *  2. For each one, checks whether the corresponding completion row still
 *     references it.
 *  3. Tries to upload the blob to Supabase Storage.
 *  4. On success: rewrites the completion row to use the remote https:// URL
 *     and deletes the local copy.
 *
 * Strategy:
 *  - Exponential backoff per photo (5s, 30s, 2m, 10m, 30m, 1h cap).
 *  - Skips upload entirely if the network heartbeat says we're offline.
 *  - Runs at most one cycle at a time (idempotent).
 */
import { supabase } from '@/integrations/supabase/client';
import { isReallyOnline, checkNetworkNow } from '@/lib/network-status';
import { withTimeout } from '@/lib/supabase-with-timeout';
import {
  getAllPendingStepPhotos,
  deleteStepPhoto,
  LOCAL_PHOTO_PREFIX,
  type StoredStepPhoto,
} from '@/lib/step-photo-store';

// Per-photo retry state kept in memory (resets on app reload, which is fine —
// at startup we want to retry everything immediately anyway).
interface RetryState {
  attempts: number;
  nextAttemptAt: number;
  lastError?: string;
}
const retryStates = new Map<string, RetryState>();

// Backoff schedule in ms
const BACKOFF_MS = [0, 5_000, 30_000, 120_000, 600_000, 1_800_000, 3_600_000];

function getBackoff(attempts: number): number {
  return BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length - 1)];
}

/** Upload one stored photo, then update the DB and delete the local copy. */
async function uploadOne(photo: StoredStepPhoto): Promise<boolean> {
  const localUrl = `${LOCAL_PHOTO_PREFIX}${photo.id}`;
  const fileName = `steps/${photo.interventionId}/${photo.stepId}-loop${photo.loopIndex}-${photo.createdAt}-${photo.id}.jpg`;

  // 1. Upload to storage
  const { error: uploadError } = await withTimeout(
    supabase.storage
      .from('intervention-photos')
      .upload(fileName, photo.blob, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
      }),
    30_000,
  );
  if (uploadError) {
    // If file already exists (rare race), we can still resolve to its public URL
    if (!String(uploadError.message || '').toLowerCase().includes('exists')) {
      throw uploadError;
    }
  }

  const { data: urlData } = supabase.storage
    .from('intervention-photos')
    .getPublicUrl(fileName);
  const remoteUrl = urlData.publicUrl;

  // 2. Find the completion row referencing this local URL and rewrite it
  const { data: completion, error: fetchErr } = await withTimeout(
    supabase
      .from('intervention_step_completions')
      .select('id, photo_url')
      .eq('intervention_id', photo.interventionId)
      .eq('step_id', photo.stepId)
      .eq('loop_index', photo.loopIndex)
      .maybeSingle(),
    8000,
  );
  if (fetchErr) throw fetchErr;

  if (completion && completion.photo_url) {
    let urls: string[];
    try {
      const parsed = JSON.parse(completion.photo_url);
      urls = Array.isArray(parsed) ? parsed : [completion.photo_url];
    } catch {
      urls = [completion.photo_url];
    }
    if (urls.includes(localUrl)) {
      const updated = urls.map(u => (u === localUrl ? remoteUrl : u));
      const serialized = updated.length === 1 ? updated[0] : JSON.stringify(updated);
      const { error: updErr } = await withTimeout(
        supabase
          .from('intervention_step_completions')
          .update({ photo_url: serialized })
          .eq('id', completion.id),
        8000,
      );
      if (updErr) throw updErr;
    }
  }
  // If no completion references this local URL anymore, the user removed the
  // photo client-side — we can safely drop the orphan.

  // 3. Delete local copy
  await deleteStepPhoto(localUrl);
  retryStates.delete(photo.id);
  return true;
}

let cycleInFlight = false;

/** Run one retry cycle. Safe to call concurrently; extra calls are no-ops. */
export async function runStepPhotoRetryCycle(): Promise<{
  attempted: number;
  succeeded: number;
  failed: number;
  pending: number;
}> {
  if (cycleInFlight) return { attempted: 0, succeeded: 0, failed: 0, pending: 0 };
  cycleInFlight = true;
  let attempted = 0;
  let succeeded = 0;
  let failed = 0;

  try {
    const online = await checkNetworkNow();
    if (!online) {
      const all = await getAllPendingStepPhotos();
      return { attempted: 0, succeeded: 0, failed: 0, pending: all.length };
    }

    const photos = await getAllPendingStepPhotos();
    const now = Date.now();

    for (const photo of photos) {
      if (!isReallyOnline()) break;
      const state = retryStates.get(photo.id) ?? { attempts: 0, nextAttemptAt: 0 };
      if (state.nextAttemptAt > now) continue; // still backing off

      attempted++;
      try {
        await uploadOne(photo);
        succeeded++;
      } catch (err: any) {
        failed++;
        const attempts = state.attempts + 1;
        retryStates.set(photo.id, {
          attempts,
          nextAttemptAt: Date.now() + getBackoff(attempts),
          lastError: err?.message || 'unknown',
        });
        console.warn(
          `[step-photo-retry] upload failed for ${photo.id} (attempt ${attempts}):`,
          err?.message,
        );
      }
    }

    const remaining = await getAllPendingStepPhotos();
    return { attempted, succeeded, failed, pending: remaining.length };
  } finally {
    cycleInFlight = false;
  }
}

/** Force an immediate retry of every pending photo (resets backoff). */
export async function forceStepPhotoRetry(): Promise<ReturnType<typeof runStepPhotoRetryCycle>> {
  retryStates.clear();
  return runStepPhotoRetryCycle();
}

let intervalId: number | null = null;

/** Start the periodic background worker (every 30s). Safe to call multiple times. */
export function startStepPhotoRetryWorker(): void {
  if (intervalId !== null) return;
  // First cycle quickly after startup
  setTimeout(() => {
    runStepPhotoRetryCycle().catch(err =>
      console.error('[step-photo-retry] initial cycle failed', err),
    );
  }, 3_000);
  intervalId = window.setInterval(() => {
    runStepPhotoRetryCycle().catch(err =>
      console.error('[step-photo-retry] cycle failed', err),
    );
  }, 30_000);
}

export function stopStepPhotoRetryWorker(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
