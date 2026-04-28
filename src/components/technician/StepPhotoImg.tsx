import { useEffect, useState } from "react";
import { ImageOff, Loader2 } from "lucide-react";
import {
  isLocalPhotoUrl,
  resolveStepPhotoUrl,
  getCachedStepPhotoUrl,
} from "@/lib/step-photo-store";
import { cn } from "@/lib/utils";

interface StepPhotoImgProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  url: string;
}

type ResolveState =
  | { status: "loading" }
  | { status: "ready"; src: string }
  | { status: "timeout" }
  | { status: "missing" };

/**
 * <img> wrapper that knows how to resolve `local://step-photo/...` URLs
 * persisted in IndexedDB into usable blob: URLs.
 *
 * - Remote URLs (https://...) pass through unchanged.
 * - Local URLs show a spinner while IndexedDB resolves.
 * - After 3s without resolution, shows an explicit "syncing" placeholder
 *   instead of a broken image.
 * - All rendered <img> tags use loading="lazy" to avoid blocking page render.
 */
const StepPhotoImg = ({ url, className, alt, ...rest }: StepPhotoImgProps) => {
  const [state, setState] = useState<ResolveState>(() => {
    if (!isLocalPhotoUrl(url)) return { status: "ready", src: url };
    const cached = getCachedStepPhotoUrl(url);
    return cached ? { status: "ready", src: cached } : { status: "loading" };
  });

  useEffect(() => {
    let cancelled = false;

    if (!isLocalPhotoUrl(url)) {
      setState({ status: "ready", src: url });
      return;
    }

    const cached = getCachedStepPhotoUrl(url);
    if (cached) {
      setState({ status: "ready", src: cached });
      return;
    }

    setState({ status: "loading" });

    const timeoutId = window.setTimeout(() => {
      if (!cancelled) {
        setState((prev) => (prev.status === "loading" ? { status: "timeout" } : prev));
      }
    }, 3000);

    resolveStepPhotoUrl(url)
      .then((resolved) => {
        if (cancelled) return;
        window.clearTimeout(timeoutId);
        if (resolved) {
          setState({ status: "ready", src: resolved });
        } else {
          setState({ status: "missing" });
        }
      })
      .catch(() => {
        if (cancelled) return;
        window.clearTimeout(timeoutId);
        setState({ status: "timeout" });
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [url]);

  if (state.status === "loading") {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 bg-muted text-xs text-muted-foreground",
          className,
        )}
        role="status"
        aria-label="Chargement de la photo"
      >
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Chargement…</span>
      </div>
    );
  }

  if (state.status === "timeout") {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-1 bg-muted px-3 py-2 text-center text-xs text-muted-foreground",
          className,
        )}
        role="status"
      >
        <span className="text-base" aria-hidden>📷</span>
        <span>Photo en cours de synchronisation…</span>
      </div>
    );
  }

  if (state.status === "missing") {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-1 bg-muted px-3 py-2 text-center text-xs text-muted-foreground",
          className,
        )}
        role="status"
      >
        <ImageOff className="h-5 w-5" />
        <span>Photo indisponible</span>
      </div>
    );
  }

  return (
    <img
      src={state.src}
      className={className}
      alt={alt ?? ""}
      loading="lazy"
      decoding="async"
      {...rest}
    />
  );
};

export default StepPhotoImg;
