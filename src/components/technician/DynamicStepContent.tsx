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
import PinchZoomImage from "@/components/technician/PinchZoomImage";
import StepPhotoImg from "@/components/technician/StepPhotoImg";
import {
  saveStepPhoto,
  deleteStepPhoto,
  isLocalPhotoUrl,
} from "@/lib/step-photo-store";
import { isReallyOnline } from "@/lib/network-status";
import { withTimeout } from "@/lib/supabase-with-timeout";

const SIGNATURE_UPLOAD_TIMEOUT_MS = 4000;

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

// Helper to parse photo_url which can be a single URL or JSON array.
// We KEEP `local://` URLs (persistent IndexedDB references) and only filter
// out ephemeral `blob:` URLs that may have leaked into the DB by mistake.
const parsePhotoUrls = (photoUrl: string | null): string[] => {
  if (!photoUrl) return [];
  let urls: string[] = [];
  try {
    const parsed = JSON.parse(photoUrl);
    if (Array.isArray(parsed)) urls = parsed;
  } catch {
    urls = photoUrl ? [photoUrl] : [];
  }
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

  // Auto-save draft with debounce (2s after last change).
  // We persist BOTH remote URLs (https://...) AND local IndexedDB references
  // (local://...) so a photo never disappears, even if its upload failed.
  // Only ephemeral blob: URLs are filtered out (they don't survive a refresh).
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

  // Track which dependency triggered the effect to choose the right delay.
  const lastChangeKindRef = useRef<'text' | 'instant'>('instant');

  useEffect(() => {
    // Skip the initial mount to avoid saving unchanged data
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    if (isLocked) return;

    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    // Photos / checklist / multi-choice → save almost immediately (250ms).
    // Text comment → short debounce (700ms) to avoid spamming saves on every keystroke.
    // While a photo upload is still happening, wait a bit longer to avoid
    // overwriting the row mid-swap from local:// to remote URL.
    const baseDelay = lastChangeKindRef.current === 'text' ? 700 : 250;
    const delay = isUploading ? Math.max(baseDelay, 1500) : baseDelay;
    draftTimerRef.current = setTimeout(() => {
      saveDraftNow();
    }, delay);

    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [comment, photoUrls, checklistState, multipleChoiceState, saveDraftNow, isLocked, isUploading]);

  // Flush the pending draft save immediately (used on blur).
  const flushDraftNow = useCallback(() => {
    if (draftTimerRef.current) {
      clearTimeout(draftTimerRef.current);
      draftTimerRef.current = null;
    }
    saveDraftNow();
  }, [saveDraftNow]);

  const hasChecklist = checklistState.length > 0;
  const hasMultipleChoice = multipleChoiceState.length > 0;
  const selectedCount = multipleChoiceState.filter(i => i.selected).length;

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

  // Map of local:// URL -> in-flight upload promise (so we can wait on save)
  const pendingUploadsRef = useRef<Map<string, Promise<string | null>>>(new Map());

  /**
   * Capture pipeline (used by both gallery picker and custom camera):
   * 1. Compress the file.
   * 2. Persist the blob to IndexedDB and get a stable `local://` URL.
   *    => From this point, the photo CAN'T be lost, even if the app crashes.
   * 3. Add the local:// URL to the state immediately (instant preview).
   * 4. In the background, try to upload to Supabase Storage.
   *    - On success: swap local:// for the remote URL and delete from IndexedDB.
   *    - On failure: keep the local:// URL — it stays in IndexedDB and will be
   *      retried by the offline sync queue later.
   */
  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;

    setUploadingCount(prev => prev + files.length);
    setIsUploading(true);

    for (const file of files) {
      let compressed: Blob;
      let localUrl: string;
      try {
        compressed = await compressImage(file);
        localUrl = await saveStepPhoto({
          interventionId,
          stepId: step.id,
          loopIndex,
          blob: compressed,
        });
      } catch (err) {
        console.error('Failed to persist captured photo locally', err);
        setUploadingCount(prev => {
          const next = prev - 1;
          if (next <= 0) setIsUploading(false);
          return Math.max(0, next);
        });
        continue;
      }

      // Show the photo immediately via the persistent local URL
      setPhotoUrls(prev => [...prev, localUrl]);

      const uploadPromise = (async (): Promise<string | null> => {
        try {
          if (!navigator.onLine) {
            // Offline → keep local copy. Sync queue will pick it up later.
            return localUrl;
          }
          const fileName = `steps/${interventionId}/${step.id}-loop${loopIndex}-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
          const { error: uploadError } = await supabase.storage
            .from('intervention-photos')
            .upload(fileName, compressed, { contentType: 'image/jpeg' });
          if (uploadError) throw uploadError;

          const { data: urlData } = supabase.storage
            .from('intervention-photos')
            .getPublicUrl(fileName);
          const remoteUrl = urlData.publicUrl;

          // Swap local:// for remote and free the IndexedDB slot
          setPhotoUrls(prev => prev.map(u => u === localUrl ? remoteUrl : u));
          await deleteStepPhoto(localUrl);
          return remoteUrl;
        } catch (error: any) {
          console.warn('Photo upload failed, keeping local copy in IndexedDB:', error?.message);
          // IMPORTANT: do not delete — local:// URL stays, photo is safe.
          return localUrl;
        } finally {
          setUploadingCount(prev => {
            const next = prev - 1;
            if (next <= 0) setIsUploading(false);
            return Math.max(0, next);
          });
        }
      })();

      pendingUploadsRef.current.set(localUrl, uploadPromise);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    e.target.value = '';
    await handleFiles(fileArray);
  };

  const removePhoto = async (index: number) => {
    const url = photoUrls[index];
    setPhotoUrls(prev => prev.filter((_, i) => i !== index));
    if (isLocalPhotoUrl(url)) {
      await deleteStepPhoto(url);
      pendingUploadsRef.current.delete(url);
    }
  };

  // Handle files from MultiPhotoCamera
  const handleCameraCapture = async (files: File[]) => {
    setShowCamera(false);
    await handleFiles(files);
  };

  // Resolve photos for save — returns persistable URLs WITHOUT waiting for uploads.
  // Photos are already persisted in IndexedDB (local:// URLs) the moment they're
  // captured, so it's safe to validate the step immediately. The retry worker will
  // upload in the background and patch the row with the remote URL when done.
  const resolvePhotos = (): string[] => {
    return photoUrlsRef.current.filter(u => !u.startsWith('blob:'));
  };

  const handleValidate = async () => {
    const resolvedUrls = resolvePhotos();
    const serializedPhotos = resolvedUrls.length > 0 ? JSON.stringify(resolvedUrls) : undefined;
    await onComplete(
      step.id,
      comment || undefined,
      serializedPhotos,
      checklistState.length > 0 ? checklistState : undefined,
      multipleChoiceState.length > 0 ? multipleChoiceState : undefined
    );
  };

  // Handle signature step (offline-first):
  // 1. Always persist the signature blob in IndexedDB first (never lose it).
  // 2. If online, try a direct upload and complete the step with the remote URL.
  // 3. If offline OR upload fails, complete the step with a local:// URL —
  //    the step-photo-retry worker will upload + patch the row later.
  const handleSignatureValidation = async (signatureDataUrl: string, sName: string) => {
    let localUrl: string | null = null;
    try {
      const response = await fetch(signatureDataUrl);
      const blob = await response.blob();

      // Persist locally BEFORE any network attempt (guarantees no data loss)
      localUrl = await saveStepPhoto({
        interventionId,
        stepId: step.id,
        loopIndex,
        blob,
      });

      // Offline (or boot offline / dead heartbeat) → complete with local URL,
      // sync worker will handle upload when network comes back.
      if (!isReallyOnline()) {
        await onComplete(step.id, sName, localUrl);
        return;
      }

      // Online → try direct upload, but cap it so a flaky connection
      // can't keep the "Suivant" button spinning indefinitely.
      try {
        const fileName = `steps/${interventionId}/${step.id}-signature-${Date.now()}.png`;
        const { error: uploadError } = await withTimeout(
          supabase.storage
            .from('intervention-photos')
            .upload(fileName, blob, { contentType: 'image/png', upsert: false }),
          SIGNATURE_UPLOAD_TIMEOUT_MS,
        );
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage
          .from('intervention-photos')
          .getPublicUrl(fileName);
        await onComplete(step.id, sName, urlData.publicUrl);
        // Upload succeeded → free the local copy
        await deleteStepPhoto(localUrl);
      } catch (uploadErr) {
        console.warn('Step signature upload failed/timed out, keeping local copy:', uploadErr);
        // Complete the step anyway with the local URL — worker will retry
        await onComplete(step.id, sName, localUrl);
      }
    } catch (error) {
      console.error('Error saving step signature:', error);
      // Last-resort fallback: if we managed to persist locally, still complete
      if (localUrl) {
        try {
          await onComplete(step.id, sName, localUrl);
        } catch (e) {
          console.error('Failed to complete signature step with local URL', e);
        }
      }
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
                  const isLocal = isLocalPhotoUrl(url);
                  return (
                    <div key={`${url}-${index}`} className="relative">
                      <StepPhotoImg
                        url={url}
                        alt={`Photo ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg cursor-pointer"
                        onClick={() => setLightboxIndex(index)}
                      />
                      {isLocal && (
                        <div className="absolute bottom-1 left-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/90 text-white font-medium">
                          En attente d'envoi
                        </div>
                      )}
                      {canEdit && (
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
                className="fixed inset-0 z-[9999] bg-black/95"
                style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-4 right-4 text-white z-20 h-10 w-10"
                  onClick={() => setLightboxIndex(null)}
                >
                  <X className="h-6 w-6" />
                </Button>

                {photoUrls.length > 1 && lightboxIndex > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-2 top-1/2 -translate-y-1/2 text-white z-20 h-10 w-10"
                    onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </Button>
                )}

                {photoUrls.length > 1 && lightboxIndex < photoUrls.length - 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-white z-20 h-10 w-10"
                    onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}
                  >
                    <ChevronRight className="h-6 w-6" />
                  </Button>
                )}

                <LightboxImage
                  url={photoUrls[lightboxIndex]}
                  alt={`Photo ${lightboxIndex + 1}`}
                  onTap={() => setLightboxIndex(null)}
                />

                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white text-sm pointer-events-none">
                  {lightboxIndex + 1} / {photoUrls.length} · Pincez pour zoomer
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
              onChange={(e) => { lastChangeKindRef.current = 'text'; setComment(e.target.value); }}
              onBlur={flushDraftNow}
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
            {isCompleted && (
              <p className="text-xs text-muted-foreground text-center">
                Vos modifications sont enregistrées automatiquement.
              </p>
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

/**
 * Lightbox-friendly wrapper around <PinchZoomImage> that resolves
 * persistent local:// URLs to usable blob: URLs.
 */
const LightboxImage = ({
  url,
  alt,
  onTap,
}: {
  url: string;
  alt: string;
  onTap: () => void;
}) => {
  const [resolved, setResolved] = useState<string | null>(() =>
    isLocalPhotoUrl(url) ? null : url,
  );

  useEffect(() => {
    let cancelled = false;
    if (!isLocalPhotoUrl(url)) {
      setResolved(url);
      return;
    }
    import("@/lib/step-photo-store").then(({ resolveStepPhotoUrl }) => {
      resolveStepPhotoUrl(url).then((r) => {
        if (!cancelled) setResolved(r);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!resolved) {
    return (
      <div className="text-white text-sm">Chargement…</div>
    );
  }

  return (
    <PinchZoomImage
      src={resolved}
      alt={alt}
      className="max-h-[85vh] max-w-[95vw] object-contain rounded-lg"
      onTap={onTap}
    />
  );
};

export default DynamicStepContent;
