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
  getStepPhotoBlob,
  isLocalPhotoUrl,
  LOCAL_PHOTO_PREFIX,
  type StoredStepPhoto,
} from '@/lib/step-photo-store';
import { precachePhoto } from '@/lib/photo-precache';

/**
 * Upload (if needed) any `local://` URL contained in a serialized photo_url
 * value (single URL or JSON array) and return the same shape with every
 * local reference replaced by its remote https:// URL.
 *
 * - If a local blob is missing from IndexedDB, we also look for an already
 *   uploaded orphan in Storage (previous sync may have uploaded before the DB write).
 * - If upload/recovery fails, the local:// URL is kept so sync can retry.
 * - Local blobs are deleted only after the database write succeeds.
 *
 * Used at sync-replay time so queued `complete_step` / `save_draft_step`
 * mutations never overwrite an already-resolved remote URL with a stale
 * `local://` reference.
 */
export interface ResolvedLocalPhotoUrls {
  photoUrl: string | null;
  resolvedLocalUrls: string[];
  unresolvedLocalUrls: string[];
}

async function findPreviouslyUploadedStepPhoto(
  interventionId: string,
  localUrl: string,
): Promise<string | null> {
  if (!isLocalPhotoUrl(localUrl)) return null;
  const id = localUrl.slice(LOCAL_PHOTO_PREFIX.length);

  try {
    const { data, error } = await withTimeout(
      supabase.storage
        .from('intervention-photos')
        .list(`steps/${interventionId}`, { limit: 20, search: id }),
      8000,
    );

    if (error || !data?.length) return null;
    const match = data.find((item: any) => item?.name?.includes(id));
    if (!match?.name) return null;

    const { data: urlData } = supabase.storage
      .from('intervention-photos')
      .getPublicUrl(`steps/${interventionId}/${match.name}`);
    return urlData.publicUrl;
  } catch {
    return null;
  }
}

export async function resolveLocalPhotoUrlsForSync(
  photoUrl: string | null | undefined,
  interventionId: string,
): Promise<ResolvedLocalPhotoUrls> {
  if (!photoUrl) {
    return { photoUrl: photoUrl ?? null, resolvedLocalUrls: [], unresolvedLocalUrls: [] };
  }

  let urls: string[];
  let wasArray = false;
  try {
    const parsed = JSON.parse(photoUrl);
    if (Array.isArray(parsed)) { urls = parsed; wasArray = true; }
    else urls = [photoUrl];
  } catch {
    urls = [photoUrl];
  }

  const resolved: string[] = [];
  const resolvedLocalUrls: string[] = [];
  const unresolvedLocalUrls: string[] = [];
  for (const u of urls) {
    if (!isLocalPhotoUrl(u)) { resolved.push(u); continue; }
    const id = u.slice(LOCAL_PHOTO_PREFIX.length);
    try {
      const blob = await getStepPhotoBlob(u);
      if (!blob) {
        const recovered = await findPreviouslyUploadedStepPhoto(interventionId, u);
        if (recovered) {
          resolved.push(recovered);
          resolvedLocalUrls.push(u);
        } else {
          unresolvedLocalUrls.push(u);
          resolved.push(u);
        }
        continue;
      }
      const fileName = `steps/${interventionId}/sync-${id}.jpg`;
      const { error: uploadError } = await withTimeout(
        supabase.storage
          .from('intervention-photos')
          .upload(fileName, blob, { contentType: 'image/jpeg', cacheControl: '3600' }),
        30_000,
      );
      if (uploadError && !String(uploadError.message || '').toLowerCase().includes('exists')) {
        const recovered = await findPreviouslyUploadedStepPhoto(interventionId, u);
        if (recovered) {
          resolved.push(recovered);
          resolvedLocalUrls.push(u);
        } else {
          unresolvedLocalUrls.push(u);
          resolved.push(u);
        }
        continue;
      }
      const { data: urlData } = supabase.storage
        .from('intervention-photos')
        .getPublicUrl(fileName);
      const remoteUrl = urlData.publicUrl;
      try { precachePhoto(remoteUrl); } catch { /* best-effort */ }
      resolvedLocalUrls.push(u);
      resolved.push(remoteUrl);
    } catch (err) {
      console.warn('[resolveLocalPhotoUrlsForSync] failed for', u, err);
      unresolvedLocalUrls.push(u);
      resolved.push(u);
    }
  }

  return {
    photoUrl: wasArray ? JSON.stringify(resolved) : (resolved[0] ?? null),
    resolvedLocalUrls,
    unresolvedLocalUrls,
  };
}

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

/**
 * Rewrite the completion row so a `local://` URL becomes the freshly-uploaded
 * `https://` URL. Returns:
 *  - 'updated'  : row found and successfully rewritten
 *  - 'not-found': no completion row references this localUrl (draft not saved
 *                 yet OR user removed the photo). Caller should NOT delete the
 *                 IDB blob in the first case; the periodic worker will retry.
 *  - throws     : on transient DB error (caller treats as failure)
 */
export async function swapLocalUrlInCompletion(params: {
  interventionId: string;
  stepId: string;
  loopIndex: number;
  localUrl: string;
  remoteUrl: string;
}): Promise<'updated' | 'not-found'> {
  const { interventionId, stepId, loopIndex, localUrl, remoteUrl } = params;
  const { data: completion, error: fetchErr } = await withTimeout(
    supabase
      .from('intervention_step_completions')
      .select('id, photo_url')
      .eq('intervention_id', interventionId)
      .eq('step_id', stepId)
      .eq('loop_index', loopIndex)
      .maybeSingle(),
    8000,
  );
  if (fetchErr) throw fetchErr;
  if (!completion || !completion.photo_url) return 'not-found';

  let urls: string[];
  try {
    const parsed = JSON.parse(completion.photo_url);
    urls = Array.isArray(parsed) ? parsed : [completion.photo_url];
  } catch {
    urls = [completion.photo_url];
  }
  if (!urls.includes(localUrl)) return 'not-found';

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
  return 'updated';
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
    if (!String(uploadError.message || '').toLowerCase().includes('exists')) {
      throw uploadError;
    }
  }

  const { data: urlData } = supabase.storage
    .from('intervention-photos')
    .getPublicUrl(fileName);
  const remoteUrl = urlData.publicUrl;

  // 2. Rewrite the completion row so future loads use the remote URL
  await swapLocalUrlInCompletion({
    interventionId: photo.interventionId,
    stepId: photo.stepId,
    loopIndex: photo.loopIndex,
    localUrl,
    remoteUrl,
  });
  // If no completion references this local URL anymore, the user removed the
  // photo client-side — we can safely drop the orphan.

  // 3. Warm the Service Worker cache.
  try { precachePhoto(remoteUrl); } catch { /* best-effort */ }

  // 4. Delete local copy
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
