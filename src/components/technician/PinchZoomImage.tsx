import { useRef, useState, useCallback, useEffect } from "react";

interface PinchZoomImageProps {
  src: string;
  alt?: string;
  className?: string;
  /** Called on a single tap (not on pinch / pan / double-tap). Useful for closing a lightbox. */
  onTap?: () => void;
}

/**
 * Image wrapper with pinch-to-zoom, double-tap zoom and pan gestures.
 * Designed for mobile (touch) but also supports mouse wheel zoom on desktop.
 */
const PinchZoomImage = ({ src, alt, className, onTap }: PinchZoomImageProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);

  // Refs for active gestures (avoid re-renders during move)
  const stateRef = useRef({ scale: 1, tx: 0, ty: 0 });
  const pinchRef = useRef<{
    startDist: number;
    startScale: number;
    startMidX: number;
    startMidY: number;
    startTx: number;
    startTy: number;
  } | null>(null);
  const panRef = useRef<{
    startX: number;
    startY: number;
    startTx: number;
    startTy: number;
  } | null>(null);
  const tapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const lastTapRef = useRef<number>(0);
  const movedRef = useRef(false);

  // Keep stateRef in sync
  useEffect(() => {
    stateRef.current = { scale, tx, ty };
  }, [scale, tx, ty]);

  // Reset zoom when src changes
  useEffect(() => {
    setScale(1);
    setTx(0);
    setTy(0);
  }, [src]);

  const clamp = useCallback((s: number) => Math.min(Math.max(s, 1), 5), []);

  const clampTranslation = useCallback((nextScale: number, nextTx: number, nextTy: number) => {
    const el = containerRef.current;
    if (!el) return { x: nextTx, y: nextTy };
    const w = el.clientWidth;
    const h = el.clientHeight;
    // Max offset so image stays within container bounds when scaled
    const maxX = ((nextScale - 1) * w) / 2;
    const maxY = ((nextScale - 1) * h) / 2;
    return {
      x: Math.min(Math.max(nextTx, -maxX), maxX),
      y: Math.min(Math.max(nextTy, -maxY), maxY),
    };
  }, []);

  const apply = useCallback(
    (nextScale: number, nextTx: number, nextTy: number) => {
      const s = clamp(nextScale);
      const { x, y } = clampTranslation(s, nextTx, nextTy);
      setScale(s);
      setTx(x);
      setTy(y);
    },
    [clamp, clampTranslation]
  );

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Start pinch
      const [t1, t2] = [e.touches[0], e.touches[1]];
      const dx = t2.clientX - t1.clientX;
      const dy = t2.clientY - t1.clientY;
      pinchRef.current = {
        startDist: Math.hypot(dx, dy),
        startScale: stateRef.current.scale,
        startMidX: (t1.clientX + t2.clientX) / 2,
        startMidY: (t1.clientY + t2.clientY) / 2,
        startTx: stateRef.current.tx,
        startTy: stateRef.current.ty,
      };
      panRef.current = null;
      movedRef.current = true;
    } else if (e.touches.length === 1) {
      const t = e.touches[0];
      // Start pan only if zoomed in
      if (stateRef.current.scale > 1) {
        panRef.current = {
          startX: t.clientX,
          startY: t.clientY,
          startTx: stateRef.current.tx,
          startTy: stateRef.current.ty,
        };
      }
      tapRef.current = { time: Date.now(), x: t.clientX, y: t.clientY };
      movedRef.current = false;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const [t1, t2] = [e.touches[0], e.touches[1]];
      const dx = t2.clientX - t1.clientX;
      const dy = t2.clientY - t1.clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / pinchRef.current.startDist;
      const nextScale = clamp(pinchRef.current.startScale * ratio);
      // Keep pinch midpoint stable
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const midOffsetX = pinchRef.current.startMidX - cx;
      const midOffsetY = pinchRef.current.startMidY - cy;
      const scaleDelta = nextScale / pinchRef.current.startScale;
      const nextTx =
        pinchRef.current.startTx - midOffsetX * (scaleDelta - 1);
      const nextTy =
        pinchRef.current.startTy - midOffsetY * (scaleDelta - 1);
      apply(nextScale, nextTx, nextTy);
      movedRef.current = true;
    } else if (e.touches.length === 1 && panRef.current) {
      e.preventDefault();
      const t = e.touches[0];
      const nextTx = panRef.current.startTx + (t.clientX - panRef.current.startX);
      const nextTy = panRef.current.startTy + (t.clientY - panRef.current.startY);
      apply(stateRef.current.scale, nextTx, nextTy);
      // Mark as moved if finger traveled meaningfully
      if (
        Math.abs(t.clientX - panRef.current.startX) > 8 ||
        Math.abs(t.clientY - panRef.current.startY) > 8
      ) {
        movedRef.current = true;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) pinchRef.current = null;
    if (e.touches.length === 0) {
      panRef.current = null;

      // Detect tap / double-tap (only if no movement / no pinch happened)
      const tap = tapRef.current;
      tapRef.current = null;
      if (tap && !movedRef.current) {
        const now = Date.now();
        if (now - tap.time < 250) {
          // Double tap?
          if (now - lastTapRef.current < 300) {
            lastTapRef.current = 0;
            // Toggle zoom centered on tap point
            const el = containerRef.current;
            if (el) {
              const rect = el.getBoundingClientRect();
              if (stateRef.current.scale > 1) {
                apply(1, 0, 0);
              } else {
                const cx = rect.left + rect.width / 2;
                const cy = rect.top + rect.height / 2;
                const offsetX = tap.x - cx;
                const offsetY = tap.y - cy;
                apply(2.5, -offsetX * 1.5, -offsetY * 1.5);
              }
            }
            return;
          }
          lastTapRef.current = now;
          // Single tap → propagate after small delay to allow double-tap
          if (onTap) {
            setTimeout(() => {
              if (lastTapRef.current === now) {
                onTap();
              }
            }, 280);
          }
        }
      }
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey && Math.abs(e.deltaY) < 30) return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    apply(stateRef.current.scale * factor, stateRef.current.tx, stateRef.current.ty);
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden flex items-center justify-center touch-none select-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onWheel={handleWheel}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        className={className}
        style={{
          transform: `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`,
          transition: pinchRef.current || panRef.current ? "none" : "transform 0.2s ease-out",
          transformOrigin: "center center",
          willChange: "transform",
        }}
      />
    </div>
  );
};

export default PinchZoomImage;
