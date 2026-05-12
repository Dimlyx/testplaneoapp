import { useEffect, useRef } from "react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

/**
 * Détecte automatiquement quand une nouvelle version de l'app est déployée.
 * Quand une nouvelle version est trouvée, on purge les caches (SW + Cache API)
 * et on recharge la page sans demander à l'utilisateur (évite les Ctrl+F5).
 *
 * Désactivé en mode dev et dans les iframes de preview Lovable.
 */

const CHECK_INTERVAL_MS = 60 * 1000; // 1 min
const RELOAD_FLAG = "planeo:reloaded-for-version";

const isPreviewOrIframe = (): boolean => {
  if (typeof window === "undefined") return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") return true;
  return host.includes("id-preview--") || host.includes("lovableproject.com");
};

async function fetchIndexFingerprint(): Promise<string | null> {
  try {
    const res = await fetch(`/index.html?_ts=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    });
    if (!res.ok) return null;
    const text = await res.text();
    const matches = text.match(/(src|href)="\/assets\/[^"]+"/g);
    return matches ? matches.sort().join("|") : text.length.toString();
  } catch {
    return null;
  }
}

async function purgeCachesAndReload() {
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* ignore */
  }
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        regs.map(async (r) => {
          // Ne pas désinscrire OneSignal
          if (r.scope.includes("/push/onesignal/")) return;
          try {
            await r.update();
          } catch {
            /* ignore */
          }
        })
      );
    }
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.setItem(RELOAD_FLAG, "1");
  } catch {
    /* ignore */
  }
  // Bypass cache reload
  window.location.reload();
}

export function useVersionCheck() {
  const initialFingerprint = useRef<string | null>(null);
  const reloading = useRef(false);

  useEffect(() => {
    if (import.meta.env.DEV) return;
    if (isPreviewOrIframe()) return;

    let cancelled = false;
    let intervalId: number | undefined;

    const check = async () => {
      const current = await fetchIndexFingerprint();
      if (cancelled || !current) return;

      if (initialFingerprint.current === null) {
        initialFingerprint.current = current;
        return;
      }

      if (current !== initialFingerprint.current && !reloading.current) {
        reloading.current = true;
        // Petit toast informatif puis reload auto immédiat
        try {
          toast({
            title: "Mise à jour en cours…",
            description: "Application rechargée pour appliquer la nouvelle version.",
            duration: 3000,
          });
        } catch {
          /* ignore */
        }
        await purgeCachesAndReload();
      }
    };

    check();
    intervalId = window.setInterval(check, CHECK_INTERVAL_MS);

    const onFocus = () => check();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);
}
