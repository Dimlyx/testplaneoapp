/**
 * Pre-cache remote step photo URLs into the Service Worker cache so they
 * remain viewable when the device goes offline.
 *
 * The Vite PWA workbox config uses a `CacheFirst` strategy on
 * `/storage/**` URLs, but it only stores responses that have actually
 * been requested at least once. A technician who uploads photos online,
 * then closes the app and goes offline, would otherwise see broken
 * thumbnails because the SW cache was never warmed.
 *
 * This module fans out lightweight `fetch()` calls for each remote photo
 * URL — those requests transit the SW and populate the cache. We:
 *  - skip `local://` URLs (handled by IndexedDB),
 *  - skip URLs we've already warmed in this session (memory dedup),
 *  - silently ignore failures (offline, 404, etc.),
 *  - throttle to avoid hammering the network on big interventions.
 */

const inFlight = new Set<string>();
const warmed = new Set<string>();

const STORAGE_HOST_RE = /\/storage\/v1\/object\//i;

function shouldPrecache(url: string): boolean {
  if (!url) return false;
  if (warmed.has(url)) return false;
  if (inFlight.has(url)) return false;
  if (!url.startsWith("http")) return false;
  // Only photos served from Supabase Storage benefit from the SW cache.
  if (!STORAGE_HOST_RE.test(url)) return false;
  return true;
}

/** Fire-and-forget warm-up of a single URL through the Service Worker. */
export function precachePhoto(url: string): void {
  if (!shouldPrecache(url)) return;
  if (typeof window === "undefined") return;
  if (!("caches" in window)) return;
  if (!navigator.onLine) return;

  inFlight.add(url);
  // `no-cors` is fine: we just want the SW to observe the request and store it.
  fetch(url, { mode: "no-cors", credentials: "omit", cache: "default" })
    .then(() => {
      warmed.add(url);
    })
    .catch(() => {
      /* offline / network error — will retry next time */
    })
    .finally(() => {
      inFlight.delete(url);
    });
}

/**
 * Warm up a batch of URLs (e.g. all photos referenced by an intervention's
 * step completions). Throttled so we don't open hundreds of parallel
 * connections on a slow network.
 */
export function precachePhotos(urls: Array<string | null | undefined>): void {
  const unique = Array.from(
    new Set(urls.filter((u): u is string => typeof u === "string" && shouldPrecache(u))),
  );
  if (unique.length === 0) return;

  // Stagger requests in small windows.
  const CONCURRENCY = 4;
  let cursor = 0;
  const runNext = () => {
    while (cursor < unique.length && inFlight.size < CONCURRENCY) {
      precachePhoto(unique[cursor++]);
    }
    if (cursor < unique.length) {
      window.setTimeout(runNext, 250);
    }
  };
  runNext();
}

/**
 * Extract every photo URL from a `photo_url` cell, which may be a single
 * string or a JSON-encoded array (legacy format used by the workflow).
 */
export function extractPhotoUrls(photoUrl: string | null | undefined): string[] {
  if (!photoUrl) return [];
  try {
    const parsed = JSON.parse(photoUrl);
    if (Array.isArray(parsed)) return parsed.filter((u): u is string => typeof u === "string");
  } catch {
    /* not JSON — treat as single URL */
  }
  return [photoUrl];
}
