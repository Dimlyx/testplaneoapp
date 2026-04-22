import { useEffect, useRef } from "react";
import { toast } from "@/hooks/use-toast";

/**
 * Détecte automatiquement quand une nouvelle version de l'app est déployée,
 * et propose à l'utilisateur de recharger la page.
 *
 * Fonctionnement :
 * - Au démarrage, on récupère le hash de l'index.html courant.
 * - Toutes les X minutes (et au focus de l'onglet), on re-fetch index.html.
 * - Si le contenu a changé, on affiche un toast avec un bouton "Recharger".
 *
 * Désactivé en mode dev et dans les iframes de preview Lovable.
 */

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

const isPreviewOrIframe = (): boolean => {
  if (typeof window === "undefined") return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const host = window.location.hostname;
  return (
    host.includes("id-preview--") ||
    host.includes("lovableproject.com") ||
    host.includes("lovable.app") === false && host === "localhost"
  );
};

async function fetchIndexFingerprint(): Promise<string | null> {
  try {
    const res = await fetch(`/index.html?_ts=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    });
    if (!res.ok) return null;
    const text = await res.text();
    // On extrait les sources de scripts/links — c'est ce qui change à chaque build (hash Vite).
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
            <button
              onClick={() => window.location.reload()}
              className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground"
            >
              Recharger
            </button>
          ) as any,
        });
      }
    };

    // Premier check immédiat puis intervalle régulier.
    check();
    intervalId = window.setInterval(check, CHECK_INTERVAL_MS);

    // Vérifier aussi quand l'utilisateur revient sur l'onglet.
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
