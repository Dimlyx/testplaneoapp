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
   * Raw bytes of the photo. Stored as an ArrayBuffer (NOT a Blob) because
   * WebKit/iOS can silently empty Blobs persisted in IndexedDB after the app
   * is backgrounded, the screen sleeps or memory pressure occurs — producing
   * 0-byte uploads ("No content provided").
   */
  data?: ArrayBuffer;
  mimeType?: string;
  /** Legacy records written before the ArrayBuffer migration. */
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
const DB_VERSION = 2;

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

/** Rebuild a fresh Blob from a stored record, right before use. */
export function stepPhotoToBlob(record: StoredStepPhoto | undefined | null): Blob | null {
  if (!record) return null;
  const type = record.mimeType || record.blob?.type || 'image/jpeg';
  if (record.data && record.data.byteLength > 0) {
    return new Blob([record.data], { type });
  }
  if (record.blob && record.blob.size > 0) return record.blob;
  return null;
}

/**
 * Convert any legacy Blob-based records to ArrayBuffer storage.
 * Runs once at startup so photos already pending on a device before this
 * update are not left stranded in the old (WebKit-fragile) format.
 */
let legacyMigrationPromise: Promise<void> | null = null;
export function migrateLegacyStepPhotos(): Promise<void> {
  if (!legacyMigrationPromise) {
    legacyMigrationPromise = (async () => {
      try {
        const db = await getDB();
        const all = await db.getAll('stepPhotos');
        for (const record of all) {
          if (record.data && record.data.byteLength > 0) continue;
          if (!record.blob) continue;
          try {
            const buffer = await record.blob.arrayBuffer();
            if (buffer.byteLength === 0) continue; // already emptied by WebKit, keep as-is
            await db.put('stepPhotos', {
              ...record,
              data: buffer,
              mimeType: record.blob.type || 'image/jpeg',
              blob: undefined,
            });
          } catch (e) {
            console.warn('[step-photo-store] legacy migration failed for', record.id, e);
          }
        }
      } catch (e) {
        console.warn('[step-photo-store] legacy migration skipped', e);
      }
    })();
  }
  return legacyMigrationPromise;
}


// In-memory cache of resolved blob URLs so we don't recreate them on every render
const blobUrlCache = new Map<string, string>();

// Shared per-photo upload lock. Every step-photo upload path uses the same
// local:// key so the direct uploader, retry worker, mutation resolver and
// orphan safety net cannot upload the same IndexedDB record concurrently.
const uploadsInFlight = new Map<string, Promise<unknown>>();

export async function runStepPhotoUploadLocked<T>(
  localUrl: string,
  upload: () => PromiseLike<T>,
): Promise<{ started: boolean; result?: T }> {
  if (!isLocalPhotoUrl(localUrl)) return { started: false };
  if (uploadsInFlight.has(localUrl)) {
    console.log(`[step-photo-lock] skip ${localUrl}, already in progress`);
    return { started: false };
  }


  // Keep the lock tied to the real network promise. If an outer timeout stops
  // waiting, the lock remains active until the underlying request truly ends.
  const request = Promise.resolve().then(upload);
  uploadsInFlight.set(localUrl, request);
  try {
    return { started: true, result: await request };
  } finally {
    if (uploadsInFlight.get(localUrl) === request) uploadsInFlight.delete(localUrl);
  }
}

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
  // Store raw bytes, never the Blob itself (WebKit can empty stored Blobs).
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
  return `${LOCAL_PHOTO_PREFIX}${id}`;
}

/** Get a freshly rebuilt blob for a local:// URL, if it still exists. */
export async function getStepPhotoBlob(localUrl: string): Promise<Blob | null> {
  if (!isLocalPhotoUrl(localUrl)) return null;
  const id = localUrl.slice(LOCAL_PHOTO_PREFIX.length);
  const db = await getDB();
  const record = await db.get('stepPhotos', id);
  return stepPhotoToBlob(record);
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
  return db.getAllFromIndex('stepPhotos', 'by-intervention', interventionId);
}

/** Delete step-photo blobs only after the parent intervention is proven deleted. */
export async function deleteStepPhotosForIntervention(interventionId: string): Promise<void> {
  const db = await getDB();
  const photos = await db.getAllFromIndex('stepPhotos', 'by-intervention', interventionId);
  await Promise.all(
    photos.map((photo) => deleteStepPhoto(`${LOCAL_PHOTO_PREFIX}${photo.id}`)),
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
  return db.getAll('stepPhotos');
}
