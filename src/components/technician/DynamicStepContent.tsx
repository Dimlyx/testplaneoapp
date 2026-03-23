import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, MessageSquare, CheckCircle, Upload, X, Plus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { WorkflowStep as WorkflowStepType } from "@/hooks/useWorkflowSteps";
import { StepCompletion } from "@/hooks/useStepCompletions";
import { supabase } from "@/integrations/supabase/client";
import SignaturePad from "@/components/SignaturePad";

interface DynamicStepContentProps {
  step: WorkflowStepType;
  interventionId: string;
  completion: StepCompletion | undefined;
  onComplete: (stepId: string, comment?: string, photoUrl?: string, checklistData?: { id: string; label: string; checked: boolean }[]) => Promise<void>;
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
  const [photoUrls, setPhotoUrls] = useState<string[]>(parsePhotoUrls(completion?.photo_url || null));
  const [isUploading, setIsUploading] = useState(false);
  const [localSignerName, setLocalSignerName] = useState(signerName);
  
  // Initialize checklist state from completion or step template
  const [checklistState, setChecklistState] = useState<{ id: string; label: string; checked: boolean }[]>(() => {
    if (completion?.checklist_data && Array.isArray(completion.checklist_data)) {
      return completion.checklist_data;
    }
    if (step.checklist_items && step.checklist_items.length > 0) {
      return step.checklist_items.map(item => ({ ...item, checked: false }));
    }
    return [];
  });

  const isCompleted = !!completion?.completed_at;
  const hasChecklist = checklistState.length > 0;

  const toggleChecklistItem = (itemId: string) => {
    setChecklistState(prev => prev.map(item => 
      item.id === itemId ? { ...item, checked: !item.checked } : item
    ));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const newUrls: string[] = [];
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
      }
      setPhotoUrls(prev => [...prev, ...newUrls]);
    } catch (error: any) {
      console.error("Upload error:", error);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const removePhoto = (index: number) => {
    setPhotoUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleValidate = async () => {
    const serializedPhotos = photoUrls.length > 0 ? JSON.stringify(photoUrls) : undefined;
    await onComplete(step.id, comment || undefined, serializedPhotos, checklistState.length > 0 ? checklistState : undefined);
  };

  // Handle signature step
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
              {completion?.photo_url && (
                <img src={completion.photo_url} alt="Signature" className="mt-3 max-h-32 border rounded" />
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

        {/* Checklist section */}
        {hasChecklist && (
          <div className="space-y-2">
            <label className="text-sm font-medium mb-2 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Checklist
            </label>
            {checklistState.map((item) => (
              <label key={item.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer">
                <Checkbox
                  checked={item.checked}
                  onCheckedChange={() => toggleChecklistItem(item.id)}
                  disabled={isLocked}
                />
                <span className={`text-sm ${item.checked ? "line-through text-muted-foreground" : ""}`}>
                  {item.label}
                </span>
              </label>
            ))}
          </div>
        )}

        {!step.requires_photo && !step.requires_comment && !hasChecklist && !isCompleted && !isLocked && (
          <p className="text-sm text-muted-foreground">
            Validez cette étape une fois terminée.
          </p>
        )}

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
