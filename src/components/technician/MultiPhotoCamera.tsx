import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Camera, X, Check, RotateCcw, ImageIcon } from "lucide-react";

interface MultiPhotoCameraProps {
  onCapture: (files: File[]) => void;
  onClose: () => void;
}

const MultiPhotoCamera = ({ onCapture, onClose }: MultiPhotoCameraProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [capturedPhotos, setCapturedPhotos] = useState<{ blob: Blob; url: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [isStarting, setIsStarting] = useState(true);
  const [flashEffect, setFlashEffect] = useState(false);

  const startCamera = useCallback(async (facing: "environment" | "user") => {
    // Stop existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    setIsStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setError(null);
    } catch (err: any) {
      console.error("Camera error:", err);
      setError("Impossible d'accéder à la caméra. Vérifiez les permissions.");
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
      },
      "image/jpeg",
      0.85
    );
  }, []);

  const removePhoto = (index: number) => {
    setCapturedPhotos(prev => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  };

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

      {/* Flash overlay */}
      {flashEffect && <div className="absolute inset-0 z-50 bg-white pointer-events-none animate-flash" />}

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80">
        <Button variant="ghost" size="icon" onClick={handleCancel} className="text-white hover:bg-white/20">
          <X className="h-6 w-6" />
        </Button>
        <span className="text-white font-medium text-sm">
          {capturedPhotos.length > 0 ? `${capturedPhotos.length} photo${capturedPhotos.length > 1 ? "s" : ""}` : "Caméra"}
        </span>
        <Button variant="ghost" size="icon" onClick={handleSwitchCamera} className="text-white hover:bg-white/20">
          <RotateCcw className="h-5 w-5" />
        </Button>
      </div>

      {/* Camera view */}
      <div className="flex-1 relative overflow-hidden">
        {error ? (
          <div className="flex items-center justify-center h-full text-white text-center p-6">
            <div>
              <Camera className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{error}</p>
            </div>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: facingMode === "user" ? "scaleX(-1)" : undefined }}
          />
        )}
        {isStarting && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
          </div>
        )}
      </div>

      {/* Bottom section: thumbnails + controls */}
      <div className="bg-black/90 px-4 pb-4 pt-2">
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
