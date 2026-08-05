/**
 * Persistent store for workflow step photos.
 *
 * Goal: GUARANTEE that no photo taken by a technician can ever be lost,
 * even if the upload fails, the app is closed, or the device reboots.
 *
 * Strategy:
 * 1. Every photo is saved to IndexedDB (as a Blob) BEFORE any upload attempt.
 * 2. Photos are referenced by a stable `local://step-photo/<id>` URL that
 *    survives component remounts, page refreshes and app restarts.
 * 3. A resolver turns `local://...` URLs back into `URL.createObjectURL()`
 *    blob URLs on demand, so <img src> just works.
 * 4. Once an upload succeeds, the local copy can be safely removed.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export const LOCAL_PHOTO_PREFIX = 'local://step-photo/';

export interface StoredStepPhoto {
  id: string;
  interventionId: string;
  stepId: string;
  loopIndex: number;
  /**
   * Raw bytes are the durable source of truth. Some Android WebViews report a
   * successful IndexedDB write for Blob values, then return an empty/missing
   * value after a cold offline restart. ArrayBuffer uses IndexedDB's native
   * structured-clone path and survives that scenario reliably.
   */
  data?: ArrayBuffer;
  mimeType?: string;
  /** Backward compatibility for photos saved by earlier app versions. */
  blob?: Blob;
  createdAt: number;
}

interface StepPhotoDB extends DBSchema {
  stepPhotos: {
    key: string;
    value: StoredStepPhoto;
    indexes: {
      'by-intervention': string;
      'by-step': [string, string, number];
    };
  };
}

const DB_NAME = 'planeo-step-photos';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<StepPhotoDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<StepPhotoDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('stepPhotos')) {
          const store = db.createObjectStore('stepPhotos', { keyPath: 'id' });
          store.createIndex('by-intervention', 'interventionId');
          store.createIndex('by-step', ['interventionId', 'stepId', 'loopIndex']);
        }
      },
    });
  }
  return dbPromise;
}

// In-memory cache of resolved blob URLs so we don't recreate them on every render
const blobUrlCache = new Map<string, string>();

/** True if a URL is one of our persistent local references. */
export function isLocalPhotoUrl(url: string): boolean {
  return url.startsWith(LOCAL_PHOTO_PREFIX);
}

/** Save a photo to IndexedDB and return its persistent local:// URL. */
export async function saveStepPhoto(params: {
  interventionId: string;
  stepId: string;
  loopIndex: number;
  blob: Blob;
}): Promise<string> {
  const id = crypto.randomUUID();
  const db = await getDB();
  const data = await params.blob.arrayBuffer();
  await db.put('stepPhotos', {
    id,
    interventionId: params.interventionId,
    stepId: params.stepId,
    loopIndex: params.loopIndex,
    data,
    mimeType: params.blob.type || 'image/jpeg',
    createdAt: Date.now(),
  });

  // Verify the durable payload before allowing the workflow to reference it.
  // A failed/partial write must be surfaced now, not after the intervention is
  // closed and the technician has left the site.
  const saved = await db.get('stepPhotos', id);
  if (!saved?.data?.byteLength && !saved?.blob?.size) {
    await db.delete('stepPhotos', id).catch(() => {});
    throw new Error('La photo n’a pas pu être enregistrée hors ligne');
  }
  return `${LOCAL_PHOTO_PREFIX}${id}`;
}

/** Get the underlying blob for a local:// URL, if it still exists. */
export async function getStepPhotoBlob(localUrl: string): Promise<Blob | null> {
  if (!isLocalPhotoUrl(localUrl)) return null;
  const id = localUrl.slice(LOCAL_PHOTO_PREFIX.length);
  const db = await getDB();
  const record = await db.get('stepPhotos', id);
  if (!record) return null;
  if (record.data?.byteLength) {
    return new Blob([record.data], { type: record.mimeType || 'image/jpeg' });
  }
  return record.blob ?? null;
}

/**
 * Resolve a local:// URL to a blob: URL usable in <img src>.
 * Returns null if the photo was deleted or never existed.
 * The returned URL is cached in memory and reused across renders.
 */
export async function resolveStepPhotoUrl(localUrl: string): Promise<string | null> {
  if (!isLocalPhotoUrl(localUrl)) return localUrl;
  const cached = blobUrlCache.get(localUrl);
  if (cached) return cached;
  const blob = await getStepPhotoBlob(localUrl);
  if (!blob) return null;
  const blobUrl = URL.createObjectURL(blob);
  blobUrlCache.set(localUrl, blobUrl);
  return blobUrl;
}

/** Synchronous lookup of an already-resolved blob URL (no IndexedDB roundtrip). */
export function getCachedStepPhotoUrl(localUrl: string): string | undefined {
  return blobUrlCache.get(localUrl);
}

/** Delete a local photo (after a successful upload, or on user removal). */
export async function deleteStepPhoto(localUrl: string): Promise<void> {
  if (!isLocalPhotoUrl(localUrl)) return;
  const id = localUrl.slice(LOCAL_PHOTO_PREFIX.length);
  const db = await getDB();
  await db.delete('stepPhotos', id);
  const cached = blobUrlCache.get(localUrl);
  if (cached) {
    URL.revokeObjectURL(cached);
    blobUrlCache.delete(localUrl);
  }
}

/** List all pending local photos for an intervention (across all steps). */
export async function getPendingStepPhotosForIntervention(
  interventionId: string,
): Promise<StoredStepPhoto[]> {
  const db = await getDB();
  return hydrateStoredPhotos(
    await db.getAllFromIndex('stepPhotos', 'by-intervention', interventionId),
  );
}

/** Count of pending local photos across the whole app. */
export async function countPendingStepPhotos(): Promise<number> {
  const db = await getDB();
  return db.count('stepPhotos');
}

/** All locally-stored step photos (across every intervention). */
export async function getAllPendingStepPhotos(): Promise<StoredStepPhoto[]> {
  const db = await getDB();
  return hydrateStoredPhotos(await db.getAll('stepPhotos'));
}

function hydrateStoredPhotos(records: StoredStepPhoto[]): StoredStepPhoto[] {
  return records.flatMap((record) => {
    if (record.blob?.size) return [record];
    if (!record.data?.byteLength) return [];
    return [{
      ...record,
      blob: new Blob([record.data], { type: record.mimeType || 'image/jpeg' }),
    }];
  });
}
