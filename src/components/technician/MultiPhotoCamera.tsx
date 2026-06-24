import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Camera, X, Check, RotateCcw, ImageIcon, Zap, ZapOff } from "lucide-react";

interface MultiPhotoCameraProps {
  onCapture: (files: File[]) => void;
  onClose: () => void;
}

const MultiPhotoCamera = ({ onCapture, onClose }: MultiPhotoCameraProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const nativeInputRef = useRef<HTMLInputElement>(null);

  const handleNativeCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length > 0) {
      streamRef.current?.getTracks().forEach(t => t.stop());
      onCapture(files);
    }
  };

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [capturedPhotos, setCapturedPhotos] = useState<{ blob: Blob; url: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [isStarting, setIsStarting] = useState(true);
  const [flashEffect, setFlashEffect] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [zoomCaps, setZoomCaps] = useState<{ min: number; max: number; step: number } | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number>(1);

  // Niveaux de zoom proposés (filtrés selon capacités du device)
  const ZOOM_LEVELS = [0.5, 1, 2];

  const applyZoom = useCallback(async (value: number) => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !zoomCaps) return;
    const clamped = Math.max(zoomCaps.min, Math.min(zoomCaps.max, value));
    try {
      await (track as any).applyConstraints({ advanced: [{ zoom: clamped }] });
      setCurrentZoom(value);
    } catch (err) {
      console.warn("Zoom apply failed:", err);
    }
  }, [zoomCaps]);

  const startCamera = useCallback(async (facing: "environment" | "user") => {
    // Stop existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsStarting(true);
    setError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError("Votre navigateur ne supporte pas l'accès caméra. Essayez Chrome à jour.");
      setIsStarting(false);
      return;
    }

    // Un seul appel getUserMedia avec contraintes simples — laisse Android Chrome
    // afficher son prompt natif. Un nouvel appel après refus ne ré-affiche pas le prompt.
    let stream: MediaStream | null = null;
    let lastErr: any = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing } },
        audio: false,
      });
    } catch (err) {
      lastErr = err;
      // Fallback unique sans facingMode au cas où le device n'a qu'une caméra
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        lastErr = null;
      } catch (err2) {
        lastErr = err2;
      }
    }

    if (!stream) {
      const name = lastErr?.name || "";
      const msg = lastErr?.message || "";
      console.error("Camera error:", name, msg, lastErr);

      // Vérifie l'état réel de la permission pour distinguer "jamais demandé" vs "refusé"
      let permState: string | null = null;
      try {
        // @ts-ignore - camera permission name
        const p = await navigator.permissions?.query?.({ name: "camera" as PermissionName });
        permState = p?.state ?? null;
      } catch {}

      let userMsg = "Impossible d'accéder à la caméra.";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        if (permState === "denied") {
          userMsg =
            "Autorisation caméra refusée pour cette application.\n\n" +
            "• Si vous utilisez PLANEO installé sur l'écran d'accueil : appui long sur l'icône PLANEO → Infos appli → Autorisations → Caméra → Autoriser.\n" +
            "• Si vous utilisez Chrome : appuyez sur le cadenas/⋮ dans la barre d'adresse → Autorisations → Caméra → Autoriser, puis rechargez.";
        } else {
          userMsg =
            "Autorisation caméra refusée. Touchez « Réessayer » et acceptez la demande d'accès caméra qui apparaît.";
        }
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        userMsg = "Aucune caméra détectée sur l'appareil.";
      } else if (name === "NotReadableError" || name === "TrackStartError") {
        userMsg = "La caméra est déjà utilisée par une autre application. Fermez-la puis réessayez.";
      } else if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
        userMsg = "La caméra demandée n'est pas disponible sur ce téléphone.";
      } else if (name === "SecurityError" || !window.isSecureContext) {
        userMsg = "Accès caméra bloqué : connexion non sécurisée (HTTPS requis).";
      } else if (msg) {
        userMsg = `Impossible d'accéder à la caméra : ${msg}`;
      }
      setError(userMsg);
      setIsStarting(false);
      return;
    }

    try {
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      const track = stream.getVideoTracks()[0];
      const capabilities = track?.getCapabilities?.() as any;
      setTorchSupported(!!capabilities?.torch);
      setTorchOn(false);
      if (capabilities?.zoom) {
        const caps = {
          min: capabilities.zoom.min ?? 1,
          max: capabilities.zoom.max ?? 1,
          step: capabilities.zoom.step ?? 0.1,
        };
        setZoomCaps(caps);
        const defaultZoom = caps.min > 1 ? caps.min : 1;
        try {
          await (track as any).applyConstraints({ advanced: [{ zoom: defaultZoom }] });
        } catch {}
        setCurrentZoom(defaultZoom);
      } else {
        setZoomCaps(null);
        setCurrentZoom(1);
      }
    } finally {
      setIsStarting(false);
    }
  }, []);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      capturedPhotos.forEach(p => URL.revokeObjectURL(p.url));
    };
  }, []);

  const handleSwitchCamera = () => {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    startCamera(next);
  };

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await (track as any).applyConstraints({ advanced: [{ torch: !torchOn }] });
      setTorchOn(prev => !prev);
    } catch (err) {
      console.warn("Torch toggle failed:", err);
    }
  };

  const takePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);

    // Flash effect
    setFlashEffect(true);
    setTimeout(() => setFlashEffect(false), 150);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        setCapturedPhotos(prev => [...prev, { blob, url }]);
        // IMPORTANT: persist each photo immediately so it survives the
        // technician quitting/backgrounding the app before tapping OK.
        const file = new File(
          [blob],
          `photo-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`,
          { type: "image/jpeg", lastModified: Date.now() },
        );
        try {
          onCapture([file]);
        } catch (err) {
          console.warn("Immediate photo persist failed:", err);
        }
      },
      "image/jpeg",
      0.85
    );
  }, [onCapture]);

  const handleConfirm = () => {
    const files = capturedPhotos.map((p, i) =>
      new File([p.blob], `photo-${Date.now()}-${i}.jpg`, { type: "image/jpeg", lastModified: Date.now() })
    );
    // Clean up
    streamRef.current?.getTracks().forEach(t => t.stop());
    capturedPhotos.forEach(p => URL.revokeObjectURL(p.url));
    onCapture(files);
  };

  const handleCancel = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    capturedPhotos.forEach(p => URL.revokeObjectURL(p.url));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Hidden canvas for capturing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Hidden native camera input (fallback Android) */}
      <input
        ref={nativeInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={handleNativeCapture}
      />

      {/* Flash overlay */}
      {flashEffect && <div className="absolute inset-0 z-50 bg-white pointer-events-none animate-flash" />}

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80">
        <Button variant="ghost" size="icon" onClick={handleCancel} className="text-white hover:bg-white/20">
          <X className="h-6 w-6" />
        </Button>
        <div className="flex items-center gap-2">
          {torchSupported && (
            <Button variant="ghost" size="icon" onClick={toggleTorch} className={`hover:bg-white/20 ${torchOn ? 'text-yellow-400' : 'text-white/60'}`}>
              {torchOn ? <Zap className="h-5 w-5" /> : <ZapOff className="h-5 w-5" />}
            </Button>
          )}
          <span className="text-white font-medium text-sm">
            {capturedPhotos.length > 0 ? `${capturedPhotos.length} photo${capturedPhotos.length > 1 ? "s" : ""}` : "Caméra"}
          </span>
        </div>
        <Button variant="ghost" size="icon" onClick={handleSwitchCamera} className="text-white hover:bg-white/20">
          <RotateCcw className="h-5 w-5" />
        </Button>
      </div>

      {/* Camera view */}
      <div className="flex-1 relative overflow-hidden">
        {error ? (
          <div className="flex items-center justify-center h-full text-white text-center p-6">
            <div className="max-w-md">
              <Camera className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm whitespace-pre-line mb-4">{error}</p>
              <div className="flex flex-col gap-2 items-center">
                <Button
                  onClick={() => nativeInputRef.current?.click()}
                  size="sm"
                  className="bg-primary text-primary-foreground"
                >
                  Ouvrir l'app Caméra du téléphone
                </Button>
                <Button onClick={() => startCamera(facingMode)} variant="secondary" size="sm">
                  Réessayer la caméra intégrée
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: facingMode === "user" ? "scaleX(-1)" : undefined, background: "#000" }}
          />
        )}
        {isStarting && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
          </div>
        )}
      </div>

      {/* Bottom section: zoom + thumbnails + controls */}
      <div className="bg-black/90 px-4 pb-4 pt-2">
        {/* Zoom selector — visible only if device supports zoom */}
        {zoomCaps && (
          <div className="flex justify-center mb-3">
            <div className="inline-flex items-center gap-1 bg-black/60 rounded-full p-1 border border-white/20">
              {ZOOM_LEVELS.filter(z => z >= zoomCaps.min && z <= zoomCaps.max).map(z => {
                const active = Math.abs(currentZoom - z) < 0.05;
                return (
                  <button
                    key={z}
                    type="button"
                    onClick={() => applyZoom(z)}
                    className={`min-w-[44px] h-9 px-3 rounded-full text-xs font-semibold transition-colors ${
                      active ? "bg-white text-black" : "text-white/80 active:bg-white/20"
                    }`}
                  >
                    {z}x
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Thumbnail strip */}
        {capturedPhotos.length > 0 && (
          <div className="flex gap-2 mb-3 overflow-x-auto py-1 scrollbar-none">
            {capturedPhotos.map((photo, index) => (
              <div key={index} className="relative flex-shrink-0">
                <img
                  src={photo.url}
                  alt={`Photo ${index + 1}`}
                  className="h-14 w-14 object-cover rounded-lg border border-white/30"
                />
                <button
                  onClick={() => removePhoto(index)}
                  className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full h-5 w-5 flex items-center justify-center"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-between">
          {/* Left: photo count or placeholder */}
          <div className="w-16 flex items-center">
            {capturedPhotos.length > 0 && (
              <div className="flex items-center gap-1 text-white/70 text-xs">
                <ImageIcon className="h-4 w-4" />
                <span>{capturedPhotos.length}</span>
              </div>
            )}
          </div>

          {/* Center: capture button */}
          <button
            onClick={takePhoto}
            disabled={!!error || isStarting}
            className="w-18 h-18 rounded-full border-4 border-white flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
            style={{ width: 72, height: 72 }}
          >
            <div className="w-14 h-14 rounded-full bg-white" style={{ width: 56, height: 56 }} />
          </button>

          {/* Right: confirm button */}
          <div className="w-16 flex justify-end">
            {capturedPhotos.length > 0 && (
              <Button
                onClick={handleConfirm}
                size="sm"
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-4"
              >
                <Check className="h-4 w-4 mr-1" />
                OK
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MultiPhotoCamera;
