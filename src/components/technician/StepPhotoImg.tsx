import { useEffect, useState } from "react";
import {
  isLocalPhotoUrl,
  resolveStepPhotoUrl,
  getCachedStepPhotoUrl,
} from "@/lib/step-photo-store";
import { cn } from "@/lib/utils";

interface StepPhotoImgProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  url: string;
}

/**
 * <img> wrapper that knows how to resolve `local://step-photo/...` URLs
 * persisted in IndexedDB into usable blob: URLs.
 *
 * Remote URLs (https://...) pass through unchanged.
 */
const StepPhotoImg = ({ url, className, ...rest }: StepPhotoImgProps) => {
  const [resolved, setResolved] = useState<string | null>(() =>
    isLocalPhotoUrl(url) ? getCachedStepPhotoUrl(url) ?? null : url,
  );

  useEffect(() => {
    let cancelled = false;
    if (!isLocalPhotoUrl(url)) {
      setResolved(url);
      return;
    }
    const cached = getCachedStepPhotoUrl(url);
    if (cached) {
      setResolved(cached);
      return;
    }
    resolveStepPhotoUrl(url).then((r) => {
      if (!cancelled) setResolved(r);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!resolved) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted text-xs text-muted-foreground",
          className,
        )}
      >
        Chargement…
      </div>
    );
  }

  return <img src={resolved} className={className} {...rest} />;
};

export default StepPhotoImg;
