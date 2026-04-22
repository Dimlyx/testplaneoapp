import { useEffect, useRef } from "react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

/**
 * Détecte automatiquement quand une nouvelle version de l'app est déployée,
 * et propose à l'utilisateur de recharger la page.
 *
 * Désactivé en mode dev et dans les iframes de preview Lovable.
 */

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 min

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
    // Les fichiers Vite ont un hash dans leur nom — change à chaque build.
    const matches = text.match(/(src|href)="\/assets\/[^"]+"/g);
    return matches ? matches.sort().join("|") : text.length.toString();
  } catch {
    return null;
  }
}

export function useVersionCheck() {
  const initialFingerprint = useRef<string | null>(null);
  const notified = useRef(false);

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

      if (current !== initialFingerprint.current && !notified.current) {
        notified.current = true;
        toast({
          title: "Nouvelle version disponible",
          description: "Rechargez la page pour profiter des dernières mises à jour.",
          duration: Infinity,
          action: (
            <Button size="sm" onClick={() => window.location.reload()}>
              Recharger
            </Button>
          ) as any,
        });
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
