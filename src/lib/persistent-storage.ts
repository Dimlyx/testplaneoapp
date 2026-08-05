/**
 * Ask the browser for PERSISTENT storage.
 *
 * Why this matters for PLANEO:
 * Step photos taken offline live as Blobs in IndexedDB until the network
 * comes back. By default, IndexedDB is "best-effort" storage: Android
 * Chrome / WebView (Median) may evict it at ANY time under storage
 * pressure — silently, without any code deleting anything. When that
 * happens the completion row keeps its `local://step-photo/<id>` reference
 * but the blob is gone → broken photos in the report, with no upload ever
 * reaching Storage.
 *
 * Requesting persistence marks the origin as "do not evict", which is the
 * only real protection against that scenario.
 *
 * Best-effort and idempotent: safe to call at every boot.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!('storage' in navigator) || !navigator.storage?.persist) return false;

    const already = (await navigator.storage.persisted?.()) ?? false;
    if (already) return true;

    const granted = await navigator.storage.persist();
    if (!granted) {
      console.warn(
        '[PLANEO] Persistent storage NOT granted — offline photos could be evicted by the OS.',
      );
    }
    return granted;
  } catch {
    return false;
  }
}

/** Log the current storage quota/usage (diagnostic only). */
export async function logStorageEstimate(): Promise<void> {
  try {
    const estimate = await navigator.storage?.estimate?.();
    if (!estimate) return;
    const used = Math.round((estimate.usage ?? 0) / 1024 / 1024);
    const quota = Math.round((estimate.quota ?? 0) / 1024 / 1024);
    console.info(`[PLANEO] Storage: ${used} MB used / ${quota} MB quota`);
  } catch {
    /* best-effort */
  }
}
