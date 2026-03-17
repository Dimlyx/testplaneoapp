import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, MessageSquare, CheckCircle, Upload, X, Plus } from "lucide-react";
import { WorkflowStep as WorkflowStepType } from "@/hooks/useWorkflowSteps";
import { StepCompletion } from "@/hooks/useStepCompletions";
import { supabase } from "@/integrations/supabase/client";
import SignaturePad from "@/components/SignaturePad";
import { getSignedUrls, getSignedUrl } from "@/lib/storage-utils";

interface DynamicStepContentProps {
  step: WorkflowStepType;
  interventionId: string;
  completion: StepCompletion | undefined;
  onComplete: (stepId: string, comment?: string, photoUrl?: string) => Promise<void>;
  isLocked: boolean;
  isCompleting: boolean;
  signerName?: string;
  onSignerNameChange?: (name: string) => void;
  loopIndex?: number;
}

// Helper to parse photo_url which can be a single URL or JSON array
const parsePhotoUrls = (photoUrl: string | null): string[] => {
  if (!photoUrl) return [];
  try {
    const parsed = JSON.parse(photoUrl);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Not JSON, single URL
  }
  return photoUrl ? [photoUrl] : [];
};

const DynamicStepContent = ({
  step,
  interventionId,
  completion,
  onComplete,
  isLocked,
  isCompleting,
  signerName = "",
  onSignerNameChange,
  loopIndex = 0,
}: DynamicStepContentProps) => {
  const [comment, setComment] = useState(completion?.comment || "");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]); // original URLs for saving
  const [displayPhotoUrls, setDisplayPhotoUrls] = useState<string[]>([]); // signed URLs for display
  const [isUploading, setIsUploading] = useState(false);
  const [localSignerName, setLocalSignerName] = useState(signerName);
  const [signedSignatureUrl, setSignedSignatureUrl] = useState<string | null>(null);

  const isCompleted = !!completion?.completed_at;

  // Resolve stored URLs to signed URLs on mount
  useEffect(() => {
    const rawUrls = parsePhotoUrls(completion?.photo_url || null);
    setPhotoUrls(rawUrls);
    if (rawUrls.length > 0) {
      getSignedUrls(rawUrls).then(setDisplayPhotoUrls);
    } else {
      setDisplayPhotoUrls([]);
    }
  }, [completion?.photo_url]);

  // Resolve signature URL
  useEffect(() => {
    if (completion?.photo_url && step.requires_signature) {
      getSignedUrl(completion.photo_url).then(setSignedSignatureUrl);
    }
  }, [completion?.photo_url, step.requires_signature]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const newUrls: string[] = [];
      const newDisplayUrls: string[] = [];
      for (const file of Array.from(files)) {
        const fileName = `steps/${interventionId}/${step.id}-loop${loopIndex}-${Date.now()}-${Math.random().toString(36).slice(2)}.${file.name.split('.').pop()}`;
        const { error: uploadError } = await supabase.storage
          .from("intervention-photos")
          .upload(fileName, file, { contentType: file.type });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("intervention-photos")
          .getPublicUrl(fileName);

        newUrls.push(urlData.publicUrl);
        const signedUrl = await getSignedUrl(urlData.publicUrl);
        newDisplayUrls.push(signedUrl);
      }
      setPhotoUrls(prev => [...prev, ...newUrls]);
      setDisplayPhotoUrls(prev => [...prev, ...newDisplayUrls]);
    } catch (error: any) {
      console.error("Upload error:", error);
    } finally {
      setIsUploading(false);
      // Reset input
      e.target.value = '';
    }
  };

  const removePhoto = (index: number) => {
    setPhotoUrls(prev => prev.filter((_, i) => i !== index));
    setDisplayPhotoUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleValidate = async () => {
    const serializedPhotos = photoUrls.length > 0 ? JSON.stringify(photoUrls) : undefined;
    await onComplete(step.id, comment || undefined, serializedPhotos);
  };

  // Handle signature step: upload signature and complete the step (does NOT close the intervention)
  const handleSignatureValidation = async (signatureDataUrl: string, sName: string) => {
    try {
      const response = await fetch(signatureDataUrl);
      const blob = await response.blob();
      const fileName = `steps/${interventionId}/${step.id}-signature-${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage
        .from('intervention-photos')
        .upload(fileName, blob, { contentType: 'image/png', upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage
        .from('intervention-photos')
        .getPublicUrl(fileName);
      await onComplete(step.id, sName, urlData.publicUrl);
    } catch (error) {
      console.error('Error uploading step signature:', error);
    }
  };

  // If this step requires signature, use the signature pad (only validates the step, does not close the intervention)
  if (step.requires_signature) {
    return (
      <div className="space-y-4">
        {isCompleted ? (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-950 p-3 rounded-lg">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium text-sm">Étape validée</span>
              </div>
              {signedSignatureUrl && (
                <img src={signedSignatureUrl} alt="Signature" className="mt-3 max-h-32 border rounded" />
              )}
              {completion?.comment && (
                <p className="text-sm text-muted-foreground mt-2">Signataire : {completion.comment}</p>
              )}
            </CardContent>
          </Card>
        ) : isLocked ? null : (
          <SignaturePad
            onSignatureComplete={handleSignatureValidation}
            signerName={localSignerName}
            onSignerNameChange={(name) => {
              setLocalSignerName(name);
              onSignerNameChange?.(name);
            }}
            existingSignature={null}
          />
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {step.description && (
          <p className="text-sm text-muted-foreground">{step.description}</p>
        )}

        {/* Photo section - multiple photos */}
        {step.requires_photo && (
          <div>
            <label className="text-sm font-medium mb-2 flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Photos {step.is_mandatory && <span className="text-destructive">*</span>}
              {photoUrls.length > 0 && <span className="text-muted-foreground text-xs">({photoUrls.length})</span>}
            </label>
            
            {/* Photo grid */}
            {photoUrls.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mb-3">
                {photoUrls.map((url, index) => (
                  <div key={index} className="relative">
                    <img src={url} alt={`Photo ${index + 1}`} className="w-full h-32 object-cover rounded-lg" />
                    {!isLocked && (
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6"
                        onClick={() => removePhoto(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add more photos button */}
            {!isLocked && (
              <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-muted-foreground/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                {photoUrls.length > 0 ? (
                  <Plus className="h-6 w-6 text-muted-foreground mb-1" />
                ) : (
                  <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                )}
                <span className="text-sm text-muted-foreground">
                  {isUploading ? "Envoi en cours..." : photoUrls.length > 0 ? "Ajouter une photo" : "Prendre une photo"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handlePhotoUpload}
                  disabled={isUploading || isLocked}
                  multiple
                />
              </label>
            )}
          </div>
        )}

        {/* Comment section */}
        {step.requires_comment && (
          <div>
            <label className="text-sm font-medium mb-2 flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Commentaire {step.is_mandatory && <span className="text-destructive">*</span>}
            </label>
            <Textarea
              placeholder="Ajouter un commentaire..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="min-h-[80px]"
              disabled={isLocked}
            />
          </div>
        )}

        {/* No requirements - just a validation button */}
        {!step.requires_photo && !step.requires_comment && !isCompleted && !isLocked && (
          <p className="text-sm text-muted-foreground">
            Validez cette étape une fois terminée.
          </p>
        )}

        {/* Validation button */}
        {!isLocked && (
          <div>
            {isCompleted ? (
              <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-950 p-3 rounded-lg">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium text-sm">Étape validée</span>
              </div>
            ) : (
              <Button
                onClick={handleValidate}
                disabled={isCompleting || isUploading || (step.requires_photo && step.is_mandatory && photoUrls.length === 0) || (step.requires_comment && step.is_mandatory && !comment.trim())}
                className="w-full"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Valider cette étape
              </Button>
            )}
          </div>
        )}

        {isLocked && isCompleted && (
          <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-950 p-3 rounded-lg">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium text-sm">Étape validée</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DynamicStepContent;
