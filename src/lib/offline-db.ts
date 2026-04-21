import { openDB, DBSchema, IDBPDatabase } from 'idb';

// Types for offline data
export interface OfflineIntervention {
  id: string;
  data: any;
  lastSynced: number;
}

export interface OfflineMutation {
  id: string;
  type:
    | 'update_intervention'
    | 'create_intervention'
    | 'add_photo'
    | 'add_signature'
    | 'update_equipment'
    | 'complete_step'
    | 'save_draft_step'
    | 'uncomplete_step';
  payload: any;
  createdAt: number;
  synced: boolean;
  error?: string;
  attempts?: number;
  lastAttemptAt?: number;
}

export interface OfflinePhoto {
  id: string;
  interventionId: string;
  equipmentId?: string;
  photoType: string;
  blob: Blob;
  createdAt: number;
  synced: boolean;
}

export interface OfflineSignature {
  id: string;
  interventionId: string;
  signatureName: string;
  blob: Blob;
  createdAt: number;
  synced: boolean;
}

interface PlaneoOfflineDB extends DBSchema {
  interventions: {
    key: string;
    value: OfflineIntervention;
    indexes: { 'by-sync': number };
  };
  mutations: {
    key: string;
    value: OfflineMutation;
    indexes: { 'by-synced': number; 'by-created': number };
  };
  photos: {
    key: string;
    value: OfflinePhoto;
    indexes: { 'by-intervention': string; 'by-synced': number };
  };
  signatures: {
    key: string;
    value: OfflineSignature;
    indexes: { 'by-intervention': string; 'by-synced': number };
  };
  syncStatus: {
    key: string;
    value: { key: string; lastSync: number; pendingCount: number };
  };
}

const DB_NAME = 'planeo-offline';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<PlaneoOfflineDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<PlaneoOfflineDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<PlaneoOfflineDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Interventions store
      if (!db.objectStoreNames.contains('interventions')) {
        const interventionStore = db.createObjectStore('interventions', { keyPath: 'id' });
        interventionStore.createIndex('by-sync', 'lastSynced');
      }

      // Mutations store (pending changes)
      if (!db.objectStoreNames.contains('mutations')) {
        const mutationStore = db.createObjectStore('mutations', { keyPath: 'id' });
        mutationStore.createIndex('by-synced', 'synced');
        mutationStore.createIndex('by-created', 'createdAt');
      }

      // Photos store
      if (!db.objectStoreNames.contains('photos')) {
        const photoStore = db.createObjectStore('photos', { keyPath: 'id' });
        photoStore.createIndex('by-intervention', 'interventionId');
        photoStore.createIndex('by-synced', 'synced');
      }

      // Signatures store
      if (!db.objectStoreNames.contains('signatures')) {
        const signatureStore = db.createObjectStore('signatures', { keyPath: 'id' });
        signatureStore.createIndex('by-intervention', 'interventionId');
        signatureStore.createIndex('by-synced', 'synced');
      }

      // Sync status store
      if (!db.objectStoreNames.contains('syncStatus')) {
        db.createObjectStore('syncStatus', { keyPath: 'key' });
      }
    },
  });

  return dbInstance;
}

// Intervention operations
export async function saveInterventionOffline(intervention: any): Promise<void> {
  const db = await getDB();
  await db.put('interventions', {
    id: intervention.id,
    data: intervention,
    lastSynced: Date.now(),
  });
}

export async function getInterventionOffline(id: string): Promise<any | null> {
  const db = await getDB();
  const record = await db.get('interventions', id);
  return record?.data || null;
}

export async function getAllInterventionsOffline(): Promise<any[]> {
  const db = await getDB();
  const records = await db.getAll('interventions');
  return records.map(r => r.data);
}

// Mutation operations (pending changes)
export async function addMutation(mutation: Omit<OfflineMutation, 'id' | 'createdAt' | 'synced'>): Promise<string> {
  const db = await getDB();
  const id = crypto.randomUUID();
  await db.put('mutations', {
    id,
    ...mutation,
    createdAt: Date.now(),
    synced: false,
  });
  await updatePendingCount();
  return id;
}

export async function getPendingMutations(): Promise<OfflineMutation[]> {
  const db = await getDB();
  const all = await db.getAll('mutations');
  return all.filter(m => !m.synced).sort((a, b) => a.createdAt - b.createdAt);
}

export async function markMutationSynced(id: string): Promise<void> {
  const db = await getDB();
  const mutation = await db.get('mutations', id);
  if (mutation) {
    mutation.synced = true;
    await db.put('mutations', mutation);
    await updatePendingCount();
  }
}

export async function markMutationError(id: string, error: string): Promise<void> {
  const db = await getDB();
  const mutation = await db.get('mutations', id);
  if (mutation) {
    mutation.error = error;
    await db.put('mutations', mutation);
  }
}

export async function deleteMutation(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('mutations', id);
  await updatePendingCount();
}

export async function incrementMutationAttempts(id: string): Promise<number> {
  const db = await getDB();
  const mutation = await db.get('mutations', id);
  if (!mutation) return 0;
  const next = (mutation.attempts || 0) + 1;
  mutation.attempts = next;
  mutation.lastAttemptAt = Date.now();
  await db.put('mutations', mutation);
  return next;
}

// Photo operations
export async function savePhotoOffline(photo: Omit<OfflinePhoto, 'id' | 'createdAt' | 'synced'>): Promise<string> {
  const db = await getDB();
  const id = crypto.randomUUID();
  await db.put('photos', {
    id,
    ...photo,
    createdAt: Date.now(),
    synced: false,
  });
  await updatePendingCount();
  return id;
}

export async function getPhotoBlobOffline(id: string): Promise<OfflinePhoto | null> {
  const db = await getDB();
  const photo = await db.get('photos', id);
  return photo || null;
}

export async function getPendingPhotos(): Promise<OfflinePhoto[]> {
  const db = await getDB();
  const all = await db.getAll('photos');
  return all.filter(p => !p.synced);
}

export async function getPhotosForIntervention(interventionId: string): Promise<OfflinePhoto[]> {
  const db = await getDB();
  return db.getAllFromIndex('photos', 'by-intervention', interventionId);
}

export async function markPhotoSynced(id: string): Promise<void> {
  const db = await getDB();
  const photo = await db.get('photos', id);
  if (photo) {
    photo.synced = true;
    await db.put('photos', photo);
    await updatePendingCount();
  }
}

export async function deletePhotoOffline(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('photos', id);
  await updatePendingCount();
}

// Signature operations
export async function saveSignatureOffline(signature: Omit<OfflineSignature, 'id' | 'createdAt' | 'synced'>): Promise<string> {
  const db = await getDB();
  const id = crypto.randomUUID();
  await db.put('signatures', {
    id,
    ...signature,
    createdAt: Date.now(),
    synced: false,
  });
  await updatePendingCount();
  return id;
}

export async function getPendingSignatures(): Promise<OfflineSignature[]> {
  const db = await getDB();
  const all = await db.getAll('signatures');
  return all.filter(s => !s.synced);
}

export async function getSignatureForIntervention(interventionId: string): Promise<OfflineSignature | null> {
  const db = await getDB();
  const signatures = await db.getAllFromIndex('signatures', 'by-intervention', interventionId);
  return signatures.find(s => !s.synced) || null;
}

export async function markSignatureSynced(id: string): Promise<void> {
  const db = await getDB();
  const signature = await db.get('signatures', id);
  if (signature) {
    signature.synced = true;
    await db.put('signatures', signature);
    await updatePendingCount();
  }
}

// Sync status operations
async function updatePendingCount(): Promise<void> {
  const db = await getDB();
  const mutations = await getPendingMutations();
  const photos = await getPendingPhotos();
  const signatures = await getPendingSignatures();
  
  await db.put('syncStatus', {
    key: 'main',
    lastSync: Date.now(),
    pendingCount: mutations.length + photos.length + signatures.length,
  });
}

export async function getSyncStatus(): Promise<{ lastSync: number; pendingCount: number }> {
  const db = await getDB();
  const status = await db.get('syncStatus', 'main');
  return status || { lastSync: 0, pendingCount: 0 };
}

// Clear all offline data
export async function clearOfflineData(): Promise<void> {
  const db = await getDB();
  await db.clear('interventions');
  await db.clear('mutations');
  await db.clear('photos');
  await db.clear('signatures');
  await db.clear('syncStatus');
}
