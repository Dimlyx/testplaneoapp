import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CheckCircle,
  Camera,
  MessageSquare,
  X,
  Plus,
  Upload,
  XCircle,
  Save,
  Pencil,
} from "lucide-react";
import { WorkflowStep } from "@/hooks/useWorkflowSteps";
import { StepCompletion, useCompleteStep, useUncompleteStep } from "@/hooks/useStepCompletions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface AdminStepEditorProps {
  steps: WorkflowStep[];
  completions: StepCompletion[];
  interventionId: string;
}

const parsePhotoUrls = (photoUrl: string | null): string[] => {
  if (!photoUrl) return [];
  try {
    const parsed = JSON.parse(photoUrl);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return photoUrl ? [photoUrl] : [];
};

interface StepItemProps {
  step: WorkflowStep;
  completion: StepCompletion | undefined;
  interventionId: string;
  index: number;
  loopIndex: number;
}

const StepItem = ({ step, completion, interventionId, index, loopIndex }: StepItemProps) => {
  const isCompleted = !!completion?.completed_at;
  const [editing, setEditing] = useState(false);
  const [comment, setComment] = useState(completion?.comment || "");
  const [photoUrls, setPhotoUrls] = useState<string[]>(parsePhotoUrls(completion?.photo_url || null));
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const completeStep = useCompleteStep();
  const uncompleteStep = useUncompleteStep();

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
      toast({ title: "Erreur upload", description: error.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const removePhoto = (idx: number) => {
    setPhotoUrls(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const serializedPhotos = photoUrls.length > 0 ? JSON.stringify(photoUrls) : undefined;
      await completeStep.mutateAsync({
        interventionId,
        stepId: step.id,
        comment: comment || undefined,
        photoUrl: serializedPhotos,
        loopIndex,
      });
      setEditing(false);
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUncomplete = async () => {
    try {
      await uncompleteStep.mutateAsync({ interventionId, stepId: step.id, loopIndex });
      setComment("");
      setPhotoUrls([]);
      setEditing(false);
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };

  const handleStartEdit = () => {
    setComment(completion?.comment || "");
    setPhotoUrls(parsePhotoUrls(completion?.photo_url || null));
    setEditing(true);
  };

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">{index + 1}.</span>
          <h4 className="font-semibold">{step.label}</h4>
          {step.is_mandatory && (
            <span className="text-xs text-destructive">Obligatoire</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isCompleted ? (
            <>
              <div className="flex items-center gap-1 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span className="text-xs">Validée</span>
              </div>
              {!editing && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleStartEdit}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                    <XCircle className="h-3.5 w-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Dévalider cette étape ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      L'étape « {step.label} » sera marquée comme non validée. Les commentaires et photos associés seront supprimés. Cette action est irréversible.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={handleUncomplete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Dévalider
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Non validée</span>
          )}
        </div>
      </div>

      {step.description && (
        <p className="text-sm text-muted-foreground">{step.description}</p>
      )}

      {/* Requirements indicators */}
      <div className="flex gap-3 text-xs text-muted-foreground">
        {step.requires_photo && (
          <span className="flex items-center gap-1">
            <Camera className="h-3 w-3" /> Photo requise
          </span>
        )}
        {step.requires_comment && (
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" /> Commentaire requis
          </span>
        )}
      </div>

      {/* Read-only view when completed and not editing */}
      {isCompleted && !editing && (
        <div className="bg-muted/30 rounded-lg p-3 space-y-3">
          {completion?.comment && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Commentaire</p>
              <p className="text-sm whitespace-pre-wrap">{completion.comment}</p>
            </div>
          )}
          {parsePhotoUrls(completion?.photo_url || null).length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Photos ({parsePhotoUrls(completion?.photo_url || null).length})
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {parsePhotoUrls(completion?.photo_url || null).map((url, photoIdx) => (
                  <a key={photoIdx} href={url} target="_blank" rel="noopener noreferrer">
                    <img src={url} alt={`Photo ${photoIdx + 1}`} className="w-full aspect-square object-cover rounded-lg hover:opacity-90 transition-opacity" />
                  </a>
                ))}
              </div>
            </div>
          )}
          {completion?.completed_at && (
            <p className="text-xs text-muted-foreground">
              Validée le {new Date(completion.completed_at).toLocaleString("fr-FR")}
            </p>
          )}
          {/* Checklist read-only */}
          {completion?.checklist_data && Array.isArray(completion.checklist_data) && completion.checklist_data.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Checklist</p>
              <div className="space-y-1">
                {completion.checklist_data.map((item: any) => (
                  <div key={item.id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={item.checked} disabled />
                    <span className={item.checked ? "line-through text-muted-foreground" : ""}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Multiple choice read-only */}
          {completion?.multiple_choice_data && Array.isArray(completion.multiple_choice_data) && completion.multiple_choice_data.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Choix multiple</p>
              <div className="space-y-1">
                {completion.multiple_choice_data.map((item: any) => (
                  <div key={item.id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={item.selected} disabled />
                    <span className={item.selected ? "font-medium" : "text-muted-foreground"}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit mode or not-yet-completed mode */}
      {(editing || !isCompleted) && (
        <div className="bg-muted/20 border border-dashed rounded-lg p-3 space-y-3">
          {/* Comment editor */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Commentaire</label>
            <Textarea
              placeholder="Ajouter un commentaire..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="min-h-[60px]"
            />
          </div>

          {/* Photo editor */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Photos</label>
            {photoUrls.length > 0 && (
              <div className="grid grid-cols-3 md:grid-cols-4 gap-2 mb-2">
                {photoUrls.map((url, photoIdx) => (
                  <div key={photoIdx} className="relative">
                    <img src={url} alt={`Photo ${photoIdx + 1}`} className="w-full aspect-square object-cover rounded-lg" />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6"
                      onClick={() => removePhoto(photoIdx)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <label className="flex items-center justify-center w-full h-16 border-2 border-dashed border-muted-foreground/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
              {photoUrls.length > 0 ? (
                <Plus className="h-5 w-5 text-muted-foreground mr-1" />
              ) : (
                <Upload className="h-5 w-5 text-muted-foreground mr-1" />
              )}
              <span className="text-sm text-muted-foreground">
                {isUploading ? "Envoi..." : "Ajouter des photos"}
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
                disabled={isUploading}
                multiple
              />
            </label>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 justify-end">
            {editing && (
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                Annuler
              </Button>
            )}
            <Button size="sm" onClick={handleSave} disabled={isSaving || isUploading}>
              <Save className="h-3.5 w-3.5 mr-1" />
              {isCompleted ? "Mettre à jour" : "Valider l'étape"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

const AdminStepEditor = ({ steps, completions, interventionId }: AdminStepEditorProps) => {
  // Calculate max loop index
  const maxLoopIndex = completions.length > 0
    ? Math.max(...completions.map(c => c.loop_index ?? 0))
    : 0;
  const totalLoops = maxLoopIndex + 1;

  // Separate signature steps from loopable steps
  const signatureSteps = steps.filter(s => s.requires_signature);
  const loopableSteps = steps.filter(s => !s.requires_signature);

  return (
    <div className="space-y-4">
      {/* Loopable steps grouped by iteration */}
      {Array.from({ length: totalLoops }, (_, loopIdx) => (
        <div key={`loop-${loopIdx}`}>
          {totalLoops > 1 && (
            <div className="flex items-center gap-2 my-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full">
                Équipement {loopIdx + 1}
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>
          )}
          {loopableSteps.map((step, index) => {
            const completion = completions.find(
              c => c.step_id === step.id && (c.loop_index ?? 0) === loopIdx
            );
            return (
              <StepItem
                key={`${step.id}-loop-${loopIdx}`}
                step={step}
                completion={completion}
                interventionId={interventionId}
                index={index}
                loopIndex={loopIdx}
              />
            );
          })}
        </div>
      ))}

      {/* Signature steps (not in loop) */}
      {signatureSteps.map((step, index) => {
        const completion = completions.find(c => c.step_id === step.id);
        return (
          <StepItem
            key={step.id}
            step={step}
            completion={completion}
            interventionId={interventionId}
            index={loopableSteps.length + index}
            loopIndex={0}
          />
        );
      })}
    </div>
  );
};

export default AdminStepEditor;
