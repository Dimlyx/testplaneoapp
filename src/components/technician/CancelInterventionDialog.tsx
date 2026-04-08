import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Camera, X, AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image-compression";

const CANCELLATION_REASONS = [
  { value: "client_absent", label: "Client absent" },
  { value: "access_impossible", label: "Accès impossible" },
  { value: "missing_parts", label: "Pièces manquantes" },
  { value: "client_request", label: "Demande du client" },
  { value: "other", label: "Autre" },
];

interface CancelInterventionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  interventionId: string;
  onConfirm: (data: {
    cancellation_reason: string;
    cancellation_details: string;
    cancellation_photos: string[];
  }) => Promise<void>;
  isUpdating: boolean;
}

const CancelInterventionDialog = ({
  open,
  onOpenChange,
  interventionId,
  onConfirm,
  isUpdating,
}: CancelInterventionDialogProps) => {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        const compressed = await compressImage(file);
        const preview = URL.createObjectURL(compressed);
        setPreviewUrls(prev => [...prev, preview]);

        const fileName = `cancellation/${interventionId}/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
        const { error } = await supabase.storage
          .from("intervention-photos")
          .upload(fileName, compressed, { contentType: "image/jpeg", upsert: false });

        if (error) throw error;

        const { data: urlData } = supabase.storage
          .from("intervention-photos")
          .getPublicUrl(fileName);

        setPhotos(prev => [...prev, urlData.publicUrl]);
      }
    } catch (error) {
      console.error("Error uploading cancellation photo:", error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleConfirm = async () => {
    const reasonLabel = CANCELLATION_REASONS.find(r => r.value === reason)?.label || reason;
    await onConfirm({
      cancellation_reason: reasonLabel,
      cancellation_details: details,
      cancellation_photos: photos,
    });
    // Reset
    setReason("");
    setDetails("");
    setPhotos([]);
    previewUrls.forEach(u => URL.revokeObjectURL(u));
    setPreviewUrls([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Annuler l'intervention
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Reason selection */}
          <div className="space-y-2">
            <Label className="font-medium">Motif d'annulation *</Label>
            <RadioGroup value={reason} onValueChange={setReason}>
              {CANCELLATION_REASONS.map(r => (
                <div key={r.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={r.value} id={r.value} />
                  <Label htmlFor={r.value} className="cursor-pointer">{r.label}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Details */}
          <div className="space-y-2">
            <Label className="font-medium">Détails (optionnel)</Label>
            <Textarea
              value={details}
              onChange={e => setDetails(e.target.value)}
              placeholder="Précisions sur l'annulation..."
              rows={3}
            />
          </div>

          {/* Photos */}
          <div className="space-y-2">
            <Label className="font-medium">Photos (optionnel)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={handlePhotoCapture}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Camera className="h-4 w-4 mr-2" />
              )}
              {isUploading ? "Upload en cours..." : "Prendre une photo"}
            </Button>

            {previewUrls.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-2">
                {previewUrls.map((url, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden border">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUpdating}>
            Retour
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!reason || isUpdating || isUploading}
          >
            {isUpdating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Confirmer l'annulation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CancelInterventionDialog;
