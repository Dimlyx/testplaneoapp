import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, MessageSquare, CheckCircle, Upload, X } from "lucide-react";
import { WorkflowStep as WorkflowStepType } from "@/hooks/useWorkflowSteps";
import { StepCompletion } from "@/hooks/useStepCompletions";
import { supabase } from "@/integrations/supabase/client";
import SignaturePad from "@/components/SignaturePad";

interface DynamicStepContentProps {
  step: WorkflowStepType;
  interventionId: string;
  completion: StepCompletion | undefined;
  onComplete: (stepId: string, comment?: string, photoUrl?: string) => Promise<void>;
  onSignatureComplete?: (signatureDataUrl: string, signerName: string) => Promise<void>;
  isLocked: boolean;
  isCompleting: boolean;
  signerName?: string;
  onSignerNameChange?: (name: string) => void;
  existingSignature?: string | null;
}

const DynamicStepContent = ({
  step,
  interventionId,
  completion,
  onComplete,
  onSignatureComplete,
  isLocked,
  isCompleting,
  signerName = "",
  onSignerNameChange,
  existingSignature,
}: DynamicStepContentProps) => {
  const [comment, setComment] = useState(completion?.comment || "");
  const [photoUrl, setPhotoUrl] = useState(completion?.photo_url || "");
  const [isUploading, setIsUploading] = useState(false);

  const isCompleted = !!completion?.completed_at;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileName = `steps/${interventionId}/${step.id}-${Date.now()}.${file.name.split('.').pop()}`;
      const { error: uploadError } = await supabase.storage
        .from("intervention-photos")
        .upload(fileName, file, { contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("intervention-photos")
        .getPublicUrl(fileName);

      setPhotoUrl(urlData.publicUrl);
    } catch (error: any) {
      console.error("Upload error:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleValidate = async () => {
    await onComplete(step.id, comment || undefined, photoUrl || undefined);
  };

  // If this step requires signature, use the signature pad
  if (step.requires_signature && onSignatureComplete) {
    return (
      <SignaturePad
        onSignatureComplete={onSignatureComplete}
        signerName={signerName}
        onSignerNameChange={onSignerNameChange || (() => {})}
        existingSignature={existingSignature}
      />
    );
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {step.description && (
          <p className="text-sm text-muted-foreground">{step.description}</p>
        )}

        {/* Photo section */}
        {step.requires_photo && (
          <div>
            <label className="text-sm font-medium mb-2 flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Photo {step.is_mandatory && <span className="text-destructive">*</span>}
            </label>
            {photoUrl ? (
              <div className="relative">
                <img src={photoUrl} alt="Step photo" className="w-full h-48 object-cover rounded-lg" />
                {!isLocked && (
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6"
                    onClick={() => setPhotoUrl("")}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ) : !isLocked ? (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-muted-foreground/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">
                  {isUploading ? "Envoi en cours..." : "Prendre une photo"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handlePhotoUpload}
                  disabled={isUploading || isLocked}
                />
              </label>
            ) : null}
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
                disabled={isCompleting || isUploading || (step.requires_photo && step.is_mandatory && !photoUrl) || (step.requires_comment && step.is_mandatory && !comment.trim())}
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
