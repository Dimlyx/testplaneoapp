import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Eraser, Check, Pen, Maximize2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SignaturePadProps {
  onSignatureComplete: (signatureDataUrl: string, signerName: string) => void;
  signerName: string;
  onSignerNameChange: (name: string) => void;
  existingSignature?: string | null;
}

const SignaturePad = ({ 
  onSignatureComplete, 
  signerName, 
  onSignerNameChange,
  existingSignature 
}: SignaturePadProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fullscreenCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const initializeCanvas = (canvas: HTMLCanvasElement | null, loadExisting = false) => {
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    // Set drawing style
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Fill with white background
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // If there's an existing signature, load it
    if (loadExisting && existingSignature) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
        setHasSignature(true);
      };
      img.src = existingSignature;
    }
  };

  useEffect(() => {
    initializeCanvas(canvasRef.current, true);
  }, [existingSignature]);

  useEffect(() => {
    if (isFullscreen) {
      // Small delay to ensure dialog is rendered
      setTimeout(() => {
        initializeCanvas(fullscreenCanvasRef.current, false);
        // Copy existing signature to fullscreen canvas if any
        if (hasSignature && canvasRef.current && fullscreenCanvasRef.current) {
          const ctx = fullscreenCanvasRef.current.getContext("2d");
          if (ctx) {
            const rect = fullscreenCanvasRef.current.getBoundingClientRect();
            ctx.drawImage(canvasRef.current, 0, 0, rect.width, rect.height);
          }
        }
      }, 100);
    }
  }, [isFullscreen]);

  const getCoordinates = (e: React.TouchEvent | React.MouseEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  const startDrawing = (e: React.TouchEvent | React.MouseEvent, canvas: HTMLCanvasElement | null) => {
    e.preventDefault();
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;

    setIsDrawing(true);
    const { x, y } = getCoordinates(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent, canvas: HTMLCanvasElement | null) => {
    e.preventDefault();
    if (!isDrawing) return;

    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;

    const { x, y } = getCoordinates(e, canvas);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = (canvas: HTMLCanvasElement | null) => {
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;

    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const clearSignature = () => {
    clearCanvas(canvasRef.current);
    if (isFullscreen) {
      clearCanvas(fullscreenCanvasRef.current);
    }
  };

  const handleValidate = () => {
    const canvas = isFullscreen ? fullscreenCanvasRef.current : canvasRef.current;
    if (!canvas || !hasSignature || !signerName.trim()) return;

    const dataUrl = canvas.toDataURL("image/png");
    onSignatureComplete(dataUrl, signerName);
    setIsFullscreen(false);
  };

  const handleFullscreenClose = () => {
    // Copy signature from fullscreen canvas to main canvas
    if (fullscreenCanvasRef.current && canvasRef.current && hasSignature) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        const rect = canvasRef.current.getBoundingClientRect();
        ctx.drawImage(fullscreenCanvasRef.current, 0, 0, rect.width, rect.height);
      }
    }
    setIsFullscreen(false);
  };

  const renderCanvas = (ref: React.RefObject<HTMLCanvasElement>, className: string) => (
    <canvas
      ref={ref}
      className={`${className} touch-none cursor-crosshair`}
      onMouseDown={(e) => startDrawing(e, ref.current)}
      onMouseMove={(e) => draw(e, ref.current)}
      onMouseUp={stopDrawing}
      onMouseLeave={stopDrawing}
      onTouchStart={(e) => startDrawing(e, ref.current)}
      onTouchMove={(e) => draw(e, ref.current)}
      onTouchEnd={stopDrawing}
    />
  );

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Pen className="h-4 w-4" />
            Signature du client
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Nom du signataire
            </label>
            <Input
              placeholder="Nom et prénom du client"
              value={signerName}
              onChange={(e) => onSignerNameChange(e.target.value)}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">
                Signature (dessiner ci-dessous)
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsFullscreen(true)}
                className="gap-1"
              >
                <Maximize2 className="h-4 w-4" />
                Plein écran
              </Button>
            </div>
            <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg overflow-hidden bg-white">
              {renderCanvas(canvasRef, "w-full h-40")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Utilisez votre doigt ou un stylet pour signer
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={clearSignature}
              className="flex-1"
            >
              <Eraser className="h-4 w-4 mr-2" />
              Effacer
            </Button>
            <Button
              type="button"
              onClick={handleValidate}
              className="flex-1"
              disabled={!hasSignature || !signerName.trim()}
            >
              <Check className="h-4 w-4 mr-2" />
              Valider signature
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Fullscreen Signature Dialog */}
      <Dialog open={isFullscreen} onOpenChange={handleFullscreenClose}>
        <DialogContent className="max-w-none w-screen h-screen p-0 m-0 rounded-none flex flex-col">
          <DialogHeader className="p-4 pb-2 shrink-0 bg-background border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Pen className="h-5 w-5" />
                Signature du client
              </DialogTitle>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleFullscreenClose}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            {signerName && (
              <p className="text-sm text-muted-foreground">
                Signataire : {signerName}
              </p>
            )}
          </DialogHeader>
          
          <div className="flex-1 p-4 bg-white flex flex-col">
            <div className="flex-1 border-2 border-dashed border-muted-foreground/30 rounded-lg overflow-hidden">
              {renderCanvas(fullscreenCanvasRef, "w-full h-full")}
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Signez dans la zone ci-dessus
            </p>
          </div>

          <div className="p-4 pt-2 shrink-0 bg-background border-t flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => clearCanvas(fullscreenCanvasRef.current)}
              className="flex-1"
            >
              <Eraser className="h-4 w-4 mr-2" />
              Effacer
            </Button>
            <Button
              type="button"
              onClick={handleValidate}
              className="flex-1"
              disabled={!hasSignature || !signerName.trim()}
            >
              <Check className="h-4 w-4 mr-2" />
              Valider signature
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SignaturePad;
