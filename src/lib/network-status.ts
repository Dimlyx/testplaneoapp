/**
 * Real network status detection.
 *
 * `navigator.onLine` is unreliable: it returns `true` even when the connection
 * is dead (captive portal, weak signal, dropped TCP, etc.). We complement it
 * with a lightweight heartbeat to Supabase REST.
 *
 * Subscribers receive a stable boolean (`true` = really online).
 */

const HEARTBEAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/health`;
const HEARTBEAT_TIMEOUT_MS = 5000;
const HEARTBEAT_INTERVAL_MS = 20_000;
const HEARTBEAT_INTERVAL_OFFLINE_MS = 5_000; // poll faster when offline

type Listener = (online: boolean) => void;

let realIsOnline = navigator.onLine;
// Boot-time offline flag: if the app starts without a connection,
// short-circuit any network attempt until the user explicitly comes back
// online (avoids 3-10s NetworkFirst waits before falling back to cache).
let bootedOffline = !navigator.onLine;
let listeners = new Set<Listener>();
let intervalId: number | null = null;
let inFlight = false;

async function ping(): Promise<boolean> {
  if (inFlight) return realIsOnline;
  if (!navigator.onLine) return false;

  inFlight = true;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEARTBEAT_TIMEOUT_MS);
    const res = await fetch(HEARTBEAT_URL, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
      // No auth required for health endpoint
      headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
    });
    clearTimeout(timeoutId);
    return res.ok || res.status === 401; // 401 still proves connectivity
  } catch {
    return false;
  } finally {
    inFlight = false;
  }
}

function setStatus(next: boolean) {
  if (next === realIsOnline) return;
  realIsOnline = next;
  listeners.forEach((l) => {
    try {
      l(next);
    } catch (e) {
      console.warn('network listener failed', e);
    }
  });
  rescheduleInterval();
}

function rescheduleInterval() {
  if (intervalId !== null) {
    clearInterval(intervalId);
  }
  const delay = realIsOnline ? HEARTBEAT_INTERVAL_MS : HEARTBEAT_INTERVAL_OFFLINE_MS;
  intervalId = window.setInterval(async () => {
    const ok = await ping();
    setStatus(ok);
  }, delay);
}

function start() {
  if (intervalId !== null) return;
  rescheduleInterval();

  // Browser hints — but we re-verify with a ping
  window.addEventListener('online', async () => {
    const ok = await ping();
    setStatus(ok);
  });
  window.addEventListener('offline', () => setStatus(false));

  // Initial probe
  ping().then(setStatus);
}

start();

export function isReallyOnline(): boolean {
  return realIsOnline;
}

export function subscribeNetworkStatus(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Force an immediate ping. Useful right before a critical operation
 * (e.g. starting a sync).
 */
export async function checkNetworkNow(): Promise<boolean> {
  const ok = await ping();
  setStatus(ok);
  return ok;
}
