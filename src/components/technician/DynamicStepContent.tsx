import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, MessageSquare, CheckCircle, Upload, X, Plus, ChevronDown, List, Save, ChevronLeft, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { WorkflowStep as WorkflowStepType } from "@/hooks/useWorkflowSteps";
import { StepCompletion, useSaveDraft } from "@/hooks/useStepCompletions";
import { supabase } from "@/integrations/supabase/client";
import SignaturePad from "@/components/SignaturePad";
import { compressImage } from "@/lib/image-compression";
import MultiPhotoCamera from "@/components/technician/MultiPhotoCamera";

interface DynamicStepContentProps {
  step: WorkflowStepType;
  interventionId: string;
  completion: StepCompletion | undefined;
  onComplete: (stepId: string, comment?: string, photoUrl?: string, checklistData?: { id: string; label: string; checked: boolean }[], multipleChoiceData?: { id: string; label: string; selected: boolean }[]) => Promise<void>;
  isLocked: boolean;
  isCompleting: boolean;
  signerName?: string;
  onSignerNameChange?: (name: string) => void;
  loopIndex?: number;
}

// Helper to parse photo_url which can be a single URL or JSON array
const parsePhotoUrls = (photoUrl: string | null): string[] => {
  if (!photoUrl) return [];
  let urls: string[] = [];
  try {
    const parsed = JSON.parse(photoUrl);
    if (Array.isArray(parsed)) urls = parsed;
  } catch {
    // Not JSON, single URL
    urls = photoUrl ? [photoUrl] : [];
  }
  // Filter out temporary blob: URLs that were persisted by mistake
  return urls.filter(u => !u.startsWith('blob:'));
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
  const photoUrlsRef = useRef<string[]>(photoUrls);
  // Keep ref in sync with state
  useEffect(() => { photoUrlsRef.current = photoUrls; }, [photoUrls]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [localSignerName, setLocalSignerName] = useState(signerName);
  const [isCommentFullscreen, setIsCommentFullscreen] = useState(false);
  
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

  // Initialize multiple choice state
  const [multipleChoiceState, setMultipleChoiceState] = useState<{ id: string; label: string; selected: boolean }[]>(() => {
    if (completion?.multiple_choice_data && Array.isArray(completion.multiple_choice_data)) {
      return completion.multiple_choice_data;
    }
    if (step.multiple_choice_items && step.multiple_choice_items.length > 0) {
      return step.multiple_choice_items.map(item => ({ ...item, selected: false }));
    }
    return [];
  });

  const [multipleChoiceOpen, setMultipleChoiceOpen] = useState(false);

  const isCompleted = !!completion?.completed_at;
  const saveDraft = useSaveDraft();
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasMountedRef = useRef(false);

  // Auto-save draft with debounce (2s after last change)
  // Filter out blob: URLs before saving to avoid persisting temporary browser URLs
  const saveDraftNow = useCallback(() => {
    if (isLocked) return;
    const persistableUrls = photoUrls.filter(u => !u.startsWith('blob:'));
    const serializedPhotos = persistableUrls.length > 0 ? JSON.stringify(persistableUrls) : undefined;
    saveDraft.mutate({
      interventionId,
      stepId: step.id,
      comment: comment || undefined,
      photoUrl: serializedPhotos,
      loopIndex,
      checklistData: checklistState.length > 0 ? checklistState : undefined,
      multipleChoiceData: multipleChoiceState.length > 0 ? multipleChoiceState : undefined,
    });
  }, [interventionId, step.id, comment, photoUrls, checklistState, multipleChoiceState, loopIndex, isLocked]);

  useEffect(() => {
    // Skip the initial mount to avoid saving unchanged data
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    if (isLocked) return;

    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      saveDraftNow();
    }, 2000);

    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [comment, photoUrls, checklistState, multipleChoiceState, saveDraftNow, isLocked]);
  const hasChecklist = checklistState.length > 0;
  const hasMultipleChoice = multipleChoiceState.length > 0;
  const selectedCount = multipleChoiceState.filter(i => i.selected).length;

  // Track if data has been modified since last save/completion
  const [hasChanges, setHasChanges] = useState(false);
  const initialDataRef = useRef({
    comment: completion?.comment || "",
    photoUrls: parsePhotoUrls(completion?.photo_url || null),
    checklist: completion?.checklist_data || [],
    multipleChoice: completion?.multiple_choice_data || [],
  });

  // Detect changes when completed
  useEffect(() => {
    if (!isCompleted) return;
    const initial = initialDataRef.current;
    const commentChanged = comment !== initial.comment;
    const photosChanged = JSON.stringify(photoUrls) !== JSON.stringify(initial.photoUrls);
    const checklistChanged = JSON.stringify(checklistState) !== JSON.stringify(initial.checklist);
    const mcChanged = JSON.stringify(multipleChoiceState) !== JSON.stringify(initial.multipleChoice);
    setHasChanges(commentChanged || photosChanged || checklistChanged || mcChanged);
  }, [comment, photoUrls, checklistState, multipleChoiceState, isCompleted]);

  const toggleChecklistItem = (itemId: string) => {
    setChecklistState(prev => prev.map(item => 
      item.id === itemId ? { ...item, checked: !item.checked } : item
    ));
  };

  const toggleMultipleChoiceItem = (itemId: string) => {
    setMultipleChoiceState(prev => prev.map(item =>
      item.id === itemId ? { ...item, selected: !item.selected } : item
    ));
  };

  // Map to track which local blob URLs map to which uploaded URLs
  const pendingUploadsRef = useRef<Map<string, Promise<string | null>>>(new Map());

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    
    // 1. Immediately show local previews using blob URLs
    const localUrls = fileArray.map(file => URL.createObjectURL(file));
    setPhotoUrls(prev => [...prev, ...localUrls]);
    setUploadingCount(prev => prev + fileArray.length);
    setIsUploading(true);
    
    // Reset input right away
    e.target.value = '';

    // 2. Upload each file in the background and swap blob URL for remote URL
    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      const localUrl = localUrls[i];
      
      const uploadPromise = (async (): Promise<string | null> => {
        try {
          // If offline, keep the blob URL — it will be visible locally
          if (!navigator.onLine) {
            setUploadingCount(prev => {
              const next = prev - 1;
              if (next <= 0) setIsUploading(false);
              return Math.max(0, next);
            });
            return localUrl; // Keep blob URL as-is
          }

          const compressed = await compressImage(file);
          const fileName = `steps/${interventionId}/${step.id}-loop${loopIndex}-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
          const { error: uploadError } = await supabase.storage
            .from("intervention-photos")
            .upload(fileName, compressed, { contentType: 'image/jpeg' });

          if (uploadError) throw uploadError;

          const { data: urlData } = supabase.storage
            .from("intervention-photos")
            .getPublicUrl(fileName);

          const remoteUrl = urlData.publicUrl;

          // Swap local blob URL with remote URL
          setPhotoUrls(prev => prev.map(u => u === localUrl ? remoteUrl : u));
          
          // Decrement uploading count
          setUploadingCount(prev => {
            const next = prev - 1;
            if (next <= 0) setIsUploading(false);
            return Math.max(0, next);
          });
          
          // Revoke blob URL to free memory
          URL.revokeObjectURL(localUrl);
          
          return remoteUrl;
        } catch (error: any) {
          console.warn("Photo upload failed, keeping local preview:", error?.message);
          // Don't remove the photo — keep the blob URL so the user sees it
          setUploadingCount(prev => {
            const next = prev - 1;
            if (next <= 0) setIsUploading(false);
            return Math.max(0, next);
          });
          return localUrl; // Keep blob URL as fallback
        }
      })();

      pendingUploadsRef.current.set(localUrl, uploadPromise);
    }
  };

  const removePhoto = (index: number) => {
    setPhotoUrls(prev => prev.filter((_, i) => i !== index));
  };

  // Handle files from MultiPhotoCamera
  const handleCameraCapture = (files: File[]) => {
    setShowCamera(false);
    if (files.length === 0) return;

    const localUrls = files.map(file => URL.createObjectURL(file));
    setPhotoUrls(prev => [...prev, ...localUrls]);
    setUploadingCount(prev => prev + files.length);
    setIsUploading(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const localUrl = localUrls[i];

      const uploadPromise = (async (): Promise<string | null> => {
        try {
          if (!navigator.onLine) {
            setUploadingCount(prev => { const n = prev - 1; if (n <= 0) setIsUploading(false); return Math.max(0, n); });
            return localUrl;
          }
          const compressed = await compressImage(file);
          const fileName = `steps/${interventionId}/${step.id}-loop${loopIndex}-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
          const { error: uploadError } = await supabase.storage
            .from("intervention-photos")
            .upload(fileName, compressed, { contentType: 'image/jpeg' });
          if (uploadError) throw uploadError;
          const { data: urlData } = supabase.storage
            .from("intervention-photos")
            .getPublicUrl(fileName);
          const remoteUrl = urlData.publicUrl;
          setPhotoUrls(prev => prev.map(u => u === localUrl ? remoteUrl : u));
          setUploadingCount(prev => { const n = prev - 1; if (n <= 0) setIsUploading(false); return Math.max(0, n); });
          URL.revokeObjectURL(localUrl);
          return remoteUrl;
        } catch (error: any) {
          console.warn("Photo upload failed, keeping local preview:", error?.message);
          setUploadingCount(prev => { const n = prev - 1; if (n <= 0) setIsUploading(false); return Math.max(0, n); });
          return localUrl;
        }
      })();
      pendingUploadsRef.current.set(localUrl, uploadPromise);
    }
  };

  // Resolve any pending uploads before saving — returns only persistable (non-blob) URLs
  const resolvePhotos = async (): Promise<string[]> => {
    // Wait for all pending uploads to finish (fast if already done)
    if (pendingUploadsRef.current.size > 0) {
      await Promise.allSettled(Array.from(pendingUploadsRef.current.values()));
      pendingUploadsRef.current.clear();
    }
    // Read the latest photoUrls from the ref (always up-to-date) and filter out any remaining blob URLs
    return photoUrlsRef.current.filter(u => !u.startsWith('blob:'));
  };

  const handleValidate = async () => {
    const resolvedUrls = await resolvePhotos();
    const serializedPhotos = resolvedUrls.length > 0 ? JSON.stringify(resolvedUrls) : undefined;
    await onComplete(
      step.id,
      comment || undefined,
      serializedPhotos,
      checklistState.length > 0 ? checklistState : undefined,
      multipleChoiceState.length > 0 ? multipleChoiceState : undefined
    );
    // Update initial data ref after save
    initialDataRef.current = {
      comment,
      photoUrls: [...resolvedUrls],
      checklist: [...checklistState],
      multipleChoice: [...multipleChoiceState],
    };
    setHasChanges(false);
  };

  const handleUpdate = async () => {
    await handleValidate();
  };

  // Handle signature step
  const handleSignatureValidation = async (signatureDataUrl: string, sName: string) => {
    try {
      const response = await fetch(signatureDataUrl);
      const blob = await response.blob();
      const fileName = `steps/${interventionId}/${step.id}-signature-${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage
        .from('intervention-photos')
        .upload(fileName, blob, { contentType: 'image/png', upsert: false });
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
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950 p-3 rounded-lg">
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

  // For non-signature steps: allow editing even after completion (unless readOnly/locked)
  const canEdit = !isLocked;

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
              Photos {step.is_mandatory && !isCompleted && <span className="text-destructive">*</span>}
              {photoUrls.length > 0 && <span className="text-muted-foreground text-xs">({photoUrls.length})</span>}
            </label>
            
            {photoUrls.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mb-3">
                {photoUrls.map((url, index) => {
                  const isBlobUrl = url.startsWith('blob:');
                  return (
                    <div key={index} className="relative">
                      <img
                        src={url}
                        alt={`Photo ${index + 1}`}
                        className={`w-full h-32 object-cover rounded-lg cursor-pointer ${isBlobUrl ? 'opacity-70' : ''}`}
                        onClick={() => !isBlobUrl && setLightboxIndex(index)}
                      />
                      {isBlobUrl && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                        </div>
                      )}
                      {canEdit && !isBlobUrl && (
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute top-1 right-1 h-6 w-6"
                          onClick={(e) => { e.stopPropagation(); removePhoto(index); }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Lightbox */}
            {lightboxIndex !== null && photoUrls[lightboxIndex] && (
              <div
                className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center"
                style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
                onClick={() => setLightboxIndex(null)}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-4 right-4 text-white z-10 h-10 w-10"
                  onClick={() => setLightboxIndex(null)}
                >
                  <X className="h-6 w-6" />
                </Button>

                {photoUrls.length > 1 && lightboxIndex > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-2 top-1/2 -translate-y-1/2 text-white z-10 h-10 w-10"
                    onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </Button>
                )}

                {photoUrls.length > 1 && lightboxIndex < photoUrls.length - 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-white z-10 h-10 w-10"
                    onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}
                  >
                    <ChevronRight className="h-6 w-6" />
                  </Button>
                )}

                <img
                  src={photoUrls[lightboxIndex]}
                  alt={`Photo ${lightboxIndex + 1}`}
                  className="max-h-[85vh] max-w-[95vw] object-contain rounded-lg"
                  onClick={(e) => e.stopPropagation()}
                />

                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white text-sm">
                  {lightboxIndex + 1} / {photoUrls.length}
                </div>
              </div>
            )}

            {canEdit && (
              <div className="flex gap-2">
                {/* Camera button - opens custom multi-photo camera */}
                <button
                  type="button"
                  onClick={() => setShowCamera(true)}
                  disabled={isUploading || isLocked}
                  className="flex-1 flex flex-col items-center justify-center h-24 border-2 border-dashed border-muted-foreground/30 rounded-lg cursor-pointer active:bg-muted/50 transition-colors disabled:opacity-50"
                >
                  <Camera className="h-6 w-6 text-muted-foreground mb-1" />
                  <span className="text-sm text-muted-foreground">
                    {isUploading ? `Envoi (${uploadingCount})...` : "Prendre des photos"}
                  </span>
                </button>
                {/* File picker for importing from gallery */}
                <label className="flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-muted-foreground/30 rounded-lg cursor-pointer active:bg-muted/50 transition-colors">
                  <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground">Galerie</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                    disabled={isUploading || isLocked}
                    multiple
                  />
                </label>
              </div>
            )}

            {/* Multi-photo camera overlay */}
            {showCamera && (
              <MultiPhotoCamera
                onCapture={handleCameraCapture}
                onClose={() => setShowCamera(false)}
              />
            )}
          </div>
        )}

        {/* Multiple choice section - collapsible bar */}
        {hasMultipleChoice && (
          <Collapsible open={multipleChoiceOpen} onOpenChange={setMultipleChoiceOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="w-full flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                disabled={isLocked}
              >
                <div className="flex items-center gap-2">
                  <List className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Choix multiple</span>
                  {selectedCount > 0 && (
                    <span className="text-xs bg-primary/20 text-primary-foreground px-2 py-0.5 rounded-full">
                      {selectedCount} sélectionné{selectedCount > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${multipleChoiceOpen ? "rotate-180" : ""}`} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-1">
              {multipleChoiceState.map((item) => (
                <label key={item.id} className="flex items-center gap-3 p-2.5 rounded-md hover:bg-muted/50 cursor-pointer border">
                  <Checkbox
                    checked={item.selected}
                    onCheckedChange={() => toggleMultipleChoiceItem(item.id)}
                    disabled={isLocked}
                  />
                  <span className={`text-sm ${item.selected ? "font-medium text-foreground" : "text-foreground"}`}>
                    {item.label}
                  </span>
                </label>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        {step.requires_comment && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Commentaire {step.is_mandatory && !isCompleted && <span className="text-destructive">*</span>}
              </label>
              {!isLocked && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setIsCommentFullscreen(true)}
                >
                  <Maximize2 className="h-3.5 w-3.5 mr-1" />
                  Agrandir
                </Button>
              )}
            </div>
            <Textarea
              placeholder="Ajouter un commentaire..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="min-h-[80px]"
              disabled={isLocked}
            />

            {/* Fullscreen comment overlay */}
            {isCommentFullscreen && (
              <div
                className="fixed inset-0 z-[9999] bg-background flex flex-col"
                style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
              >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b bg-card">
                  <h3 className="font-semibold">Commentaire</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsCommentFullscreen(false)}
                  >
                    <Minimize2 className="h-4 w-4 mr-1" />
                    Fermer
                  </Button>
                </div>

                {/* Large textarea */}
                <div className="flex-1 p-4 overflow-hidden">
                  <Textarea
                    placeholder="Ajouter un commentaire détaillé..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="w-full h-full min-h-[200px] resize-none text-base leading-relaxed"
                    disabled={isLocked}
                    autoFocus
                  />
                </div>

                {/* Footer with character count */}
                <div className="flex items-center justify-between p-4 border-t bg-card">
                  <span className="text-xs text-muted-foreground">
                    {comment.length} caractère{comment.length > 1 ? 's' : ''}
                  </span>
                  <Button onClick={() => setIsCommentFullscreen(false)}>
                    Enregistrer
                  </Button>
                </div>
              </div>
            )}
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
                <span className={`text-sm ${item.checked ? "text-muted-foreground line-through" : "text-foreground"}`}>
                  {item.label}
                </span>
              </label>
            ))}
          </div>
        )}

        {!step.requires_photo && !step.requires_comment && !hasChecklist && !hasMultipleChoice && !isCompleted && !isLocked && (
          <p className="text-sm text-muted-foreground">
            Validez cette étape une fois terminée.
          </p>
        )}

        {!isLocked && (
          <div className="space-y-2">
            {isCompleted && (
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950 p-3 rounded-lg">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium text-sm">Étape validée</span>
              </div>
            )}
            {isCompleted && hasChanges && (
              <Button
                onClick={handleUpdate}
                disabled={isCompleting}
                variant="outline"
                className="w-full"
              >
                <Save className="h-4 w-4 mr-2" />
                Mettre à jour
              </Button>
            )}
            {!isCompleted && (
              <Button
                onClick={handleValidate}
                disabled={isCompleting || (step.requires_photo && step.is_mandatory && photoUrls.length === 0) || (step.requires_comment && step.is_mandatory && !comment.trim())}
                className="w-full"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Suivant
              </Button>
            )}
          </div>
        )}

        {isLocked && isCompleted && (
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950 p-3 rounded-lg">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium text-sm">Étape validée</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DynamicStepContent;
