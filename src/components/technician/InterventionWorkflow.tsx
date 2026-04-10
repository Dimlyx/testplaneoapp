import { useState, useEffect, useMemo, useCallback } from "react";
import { 
  MapPin, 
  CheckCircle, 
  FileText, 
  Save,
  AlertCircle,
  Info,
  Lock,
  ClipboardList,
  PenTool,
  PauseCircle,
  PlayCircle,
  Clock,
  RefreshCw,
  ChevronDown,
  Car,
} from "lucide-react";
import WorkflowStep from "./WorkflowStep";
import { MapsChooser, useMapsChooser } from "@/components/technician/MapsChooser";
import DynamicStepContent from "./DynamicStepContent";
import CancelInterventionDialog from "./CancelInterventionDialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import AttachmentsList from "@/components/technician/AttachmentsList";
import EquipmentDetailPanel from "@/components/technician/EquipmentDetailPanel";
import { useInterventionAttachments } from "@/hooks/useInterventionAttachments";
import JourneyTracker from "@/components/technician/JourneyTracker";
import { Tables } from "@/integrations/supabase/types";
import { useInterventionTypes } from "@/hooks/useInterventionTypes";
import { useWorkflowSteps } from "@/hooks/useWorkflowSteps";
import { useStepCompletions, useCompleteStep } from "@/hooks/useStepCompletions";
import { useInterventionPauses, useActivePause, usePauseIntervention, useResumeIntervention } from "@/hooks/useInterventionPauses";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

type Client = Tables<"clients">;
type Intervention = Tables<"interventions">;

// Equipment loop displayed as a WorkflowStep that can be expanded/collapsed
// Children are only mounted once opened (lazy) for performance

interface InterventionWorkflowProps {
  intervention: Intervention;
  client: Client | undefined;
  report: string;
  clientSignatureName: string;
  clientSignatureUrl: string | null;
  onEndIntervention: () => Promise<void>;
  onSave: () => Promise<void>;
  onSignatureComplete: (signatureDataUrl: string, signerName: string) => Promise<void>;
  onReportChange: (value: string) => void;
  onClientSignatureNameChange: (value: string) => void;
  onDownloadPDF: () => Promise<void>;
  onStatusChange: (newStatus: string) => Promise<void>;
  onTimeUpdate: (field: string, value: string) => Promise<void>;
  onCancelIntervention: (data: { cancellation_reason: string; cancellation_details: string; cancellation_photos: string[] }) => Promise<void>;
  isUpdating: boolean;
  readOnly?: boolean;
}

const InterventionWorkflow = ({
  intervention,
  client,
  report,
  clientSignatureName,
  clientSignatureUrl,
  onEndIntervention,
  onSave,
  onSignatureComplete,
  onReportChange,
  onClientSignatureNameChange,
  onDownloadPDF,
  onStatusChange,
  onTimeUpdate,
  onCancelIntervention,
  isUpdating,
  readOnly = false,
}: InterventionWorkflowProps) => {
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const [openEquipmentPanel, setOpenEquipmentPanel] = useState<number | null>(null);
  const mapsChooser = useMapsChooser();
  const { data: attachments = [] } = useInterventionAttachments(intervention.id);
  
  // Fetch intervention type and its workflow steps
  const { data: interventionTypes = [] } = useInterventionTypes();
  const matchingType = interventionTypes.find(
    t => t.name === intervention.intervention_type
  );
  const { data: workflowSteps = [] } = useWorkflowSteps(matchingType?.id);
  const { data: stepCompletions = [] } = useStepCompletions(intervention.id);
  const completeStep = useCompleteStep();

  // Pause management
  const { data: pauses = [] } = useInterventionPauses(intervention.id);
  const activePause = useActivePause(intervention.id);
  const pauseIntervention = usePauseIntervention();
  const resumeIntervention = useResumeIntervention();
  const [showPauseDialog, setShowPauseDialog] = useState(false);
  const [pauseReason, setPauseReason] = useState("");
  const [showPauseHistory, setShowPauseHistory] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const isPaused = !!activePause;

  // Determine completed steps based on data
  const isStarted = intervention.status === 'in_progress' || intervention.status === 'completed' || intervention.status === 'to_invoice' || intervention.status === 'archived';
  const hasSignature = !!clientSignatureUrl;
  const isCompleted = intervention.status === 'completed';
  const isToInvoice = intervention.status === 'to_invoice';
  const isArchived = intervention.status === 'archived';
  const isCancelled = intervention.status === 'cancelled';
  
  const isLocked = isCompleted || isToInvoice || isArchived || isCancelled;
  const stepsLocked = !isStarted || isPaused;

  // Separate signature steps from loopable steps
  const signatureSteps = useMemo(() => workflowSteps.filter(s => s.requires_signature), [workflowSteps]);
  
  // Find the MAIN loop trigger step — the last one with is_loop_trigger whose loop_yes_step_id
  // points backwards (to a step before it), creating the actual repeat loop.
  // Other loop triggers (e.g. conditional branches) are rendered inline with Oui/Non.
  const loopTriggerStep = useMemo(() => {
    if (!matchingType?.allow_loop) return undefined;
    const nonSig = workflowSteps.filter(s => !s.requires_signature);
    const triggers = nonSig.filter(s => s.is_loop_trigger);
    // Prefer the trigger whose loop_yes_step_id points to a step BEFORE it (real loop-back)
    for (let i = triggers.length - 1; i >= 0; i--) {
      const t = triggers[i];
      if (t.loop_yes_step_id) {
        const tIdx = nonSig.findIndex(s => s.id === t.id);
        const yesIdx = nonSig.findIndex(s => s.id === t.loop_yes_step_id);
        if (yesIdx !== -1 && yesIdx <= tIdx) return t;
      }
    }
    // Fallback: last trigger
    return triggers.length > 0 ? triggers[triggers.length - 1] : undefined;
  }, [workflowSteps, matchingType]);
  
  const { preLoopSteps, loopableSteps, postLoopSteps } = useMemo(() => {
    const nonSignatureSteps = workflowSteps.filter(s => !s.requires_signature);
    
    if (!matchingType?.allow_loop || !loopTriggerStep) {
      return { preLoopSteps: nonSignatureSteps, loopableSteps: [] as typeof nonSignatureSteps, postLoopSteps: [] as typeof nonSignatureSteps };
    }
    
    const triggerIndex = nonSignatureSteps.findIndex(s => s.id === loopTriggerStep.id);
    
    if (triggerIndex === -1) {
      return { preLoopSteps: nonSignatureSteps, loopableSteps: [] as typeof nonSignatureSteps, postLoopSteps: [] as typeof nonSignatureSteps };
    }
    
    // Find where the loop starts using loop_yes_step_id
    let loopStartIndex = 0;
    if (loopTriggerStep.loop_yes_step_id) {
      const yesIdx = nonSignatureSteps.findIndex(s => s.id === loopTriggerStep.loop_yes_step_id);
      if (yesIdx !== -1 && yesIdx <= triggerIndex) {
        loopStartIndex = yesIdx;
      }
    }
    
    return {
      preLoopSteps: nonSignatureSteps.slice(0, loopStartIndex),
      loopableSteps: nonSignatureSteps.slice(loopStartIndex, triggerIndex + 1),
      postLoopSteps: nonSignatureSteps.slice(triggerIndex + 1),
    };
  }, [workflowSteps, matchingType, loopTriggerStep]);

  // Calculate loop iterations from completions
  const maxLoopIndex = useMemo(() => {
    if (stepCompletions.length === 0) return 0;
    return Math.max(...stepCompletions.map(c => c.loop_index ?? 0));
  }, [stepCompletions]);

  // Current loop count (number of complete or in-progress loops)
  const loopCount = maxLoopIndex + 1;

  // Get steps skipped by conditional branch "Non" answers for a given loop
  const getSkippedStepIdsForLoop = (loopIdx: number): Set<string> => {
    const skipped = new Set<string>();
    const conditionalBranches = loopableSteps.filter(s => s.is_loop_trigger && s.id !== loopTriggerStep?.id);
    for (const branch of conditionalBranches) {
      const branchCompletion = stepCompletions.find(
        c => c.step_id === branch.id && (c.loop_index ?? 0) === loopIdx && c.completed_at
      );
      if (branchCompletion?.comment?.includes("Non") && branch.loop_no_step_id) {
        const branchIdx = loopableSteps.findIndex(s => s.id === branch.id);
        const noIdx = loopableSteps.findIndex(s => s.id === branch.loop_no_step_id);
        if (branchIdx !== -1 && noIdx !== -1 && noIdx > branchIdx) {
          for (let i = branchIdx + 1; i < noIdx; i++) {
            skipped.add(loopableSteps[i].id);
          }
        }
      }
    }
    return skipped;
  };

  // Check if all loopable steps are completed for a given loop index (excluding skipped steps)
  const isLoopComplete = (loopIdx: number) => {
    const skipped = getSkippedStepIdsForLoop(loopIdx);
    return loopableSteps.length > 0 && loopableSteps.every(
      step => skipped.has(step.id) || stepCompletions.some(c => c.step_id === step.id && c.loop_index === loopIdx && c.completed_at)
    );
  };

  // Check if the latest loop is complete (to show the "add another?" question)
  const isLatestLoopComplete = isLoopComplete(maxLoopIndex);

  // All loops are complete
  const allLoopsComplete = loopableSteps.length === 0 || isLatestLoopComplete;

  // Check if all signature steps are completed
  const allSignatureStepsCompleted = signatureSteps.length === 0 || signatureSteps.every(
    step => stepCompletions.some(c => c.step_id === step.id && c.completed_at)
  );

  // Show "add another" dialog state
  const [showAddLoopPrompt, setShowAddLoopPrompt] = useState(false);

  // Handle adding a new loop
  const handleAddLoop = () => {
    setShowAddLoopPrompt(false);
    setJustAddedLoop(true);
    const newLoopIdx = maxLoopIndex + 1;
    if (loopableSteps.length > 0) {
      setActiveStep(`step-${loopableSteps[0].id}-loop-${newLoopIdx}`);
    }
  };

  // Determine how many loops to render (existing + 1 new if user triggered it)
  const hasNewEmptyLoop = useMemo(() => {
    if (loopableSteps.length === 0) return false;
    if (activeStep) {
      const match = activeStep.match(/loop-(\d+)/);
      if (match) {
        const activeLoopIdx = parseInt(match[1]);
        return activeLoopIdx > maxLoopIndex;
      }
    }
    return false;
  }, [activeStep, maxLoopIndex, loopableSteps]);

  const totalLoops = hasNewEmptyLoop ? maxLoopIndex + 2 : loopCount;

  // Track whether we just added a new loop (to prevent useEffect from overriding)
  const [justAddedLoop, setJustAddedLoop] = useState(false);

  // Auto-open first incomplete step
  useEffect(() => {
    // Don't override if we just triggered a new loop manually
    if (justAddedLoop) {
      setJustAddedLoop(false);
      return;
    }
    // Don't override if user is browsing inside an expanded past equipment
    if (expandedEquipments.size > 0) return;
    
    if (isLocked) {
      setActiveStep('finish');
      return;
    }
    if (!isStarted) {
      setActiveStep('general-info');
      return;
    }
    
    // Check pre-loop steps first
    const firstIncompletePreLoop = preLoopSteps.find(
      step => !stepCompletions.some(c => c.step_id === step.id && c.loop_index === 0 && c.completed_at)
    );
    if (firstIncompletePreLoop) {
      setActiveStep(`step-${firstIncompletePreLoop.id}-loop-0`);
      return;
    }
    
    // Find first incomplete loopable step across all loops (excluding skipped steps)
    const loopsToCheck = Math.max(maxLoopIndex + 1, totalLoops);
    for (let loopIdx = 0; loopIdx < loopsToCheck; loopIdx++) {
      const skippedIds = getSkippedStepIdsForLoop(loopIdx);
      const firstIncomplete = loopableSteps.find(
        step => !skippedIds.has(step.id) && !stepCompletions.some(c => c.step_id === step.id && c.loop_index === loopIdx && c.completed_at)
      );
      if (firstIncomplete) {
        setActiveStep(`step-${firstIncomplete.id}-loop-${loopIdx}`);
        return;
      }
    }
    
    // Check if the last loop trigger was answered "Oui" but next loop not started yet
    // This means we need to show the new loop's first step
    if (loopableSteps.length > 0) {
      const lastTriggerCompletion = stepCompletions.find(
        c => c.step_id === loopTriggerStep?.id && c.loop_index === maxLoopIndex && c.completed_at
      );
      if (lastTriggerCompletion?.comment?.includes("Oui")) {
        const newLoopIdx = maxLoopIndex + 1;
        setActiveStep(`step-${loopableSteps[0].id}-loop-${newLoopIdx}`);
        return;
      }
    }
    
    // Check post-loop steps
    const firstIncompletePostLoop = postLoopSteps.find(
      step => !stepCompletions.some(c => c.step_id === step.id && c.loop_index === 0 && c.completed_at)
    );
    if (firstIncompletePostLoop) {
      setActiveStep(`step-${firstIncompletePostLoop.id}-loop-0`);
      return;
    }
    
    // All loopable steps done, check signature steps
    const firstIncompleteSignature = signatureSteps.find(
      step => !stepCompletions.some(c => c.step_id === step.id && c.completed_at)
    );
    if (firstIncompleteSignature) {
      setActiveStep(`step-${firstIncompleteSignature.id}`);
      return;
    }
    
    setActiveStep('finish');
  }, [isStarted, isLocked, workflowSteps.length, stepCompletions.length, maxLoopIndex, totalLoops, 
    // Track actual completed count (not just array length) so advancing works when a draft is updated to completed
    stepCompletions.filter(c => c.completed_at).length]);

  const handleStepClick = (step: string) => {
    if (stepsLocked && step !== 'general-info') return;
    setActiveStep(activeStep === step ? null : step);
  };

  const handleCompleteStep = async (stepId: string, comment?: string, photoUrl?: string, checklistData?: { id: string; label: string; checked: boolean }[], multipleChoiceData?: { id: string; label: string; selected: boolean }[], loopIndex: number = 0) => {
    await completeStep.mutateAsync({
      interventionId: intervention.id,
      stepId,
      comment,
      photoUrl,
      loopIndex,
      checklistData,
      multipleChoiceData,
    });
  };

  const handlePause = async () => {
    if (!pauseReason.trim()) return;
    try {
      await pauseIntervention.mutateAsync({
        interventionId: intervention.id,
        reason: pauseReason.trim(),
      });
      setPauseReason("");
      setShowPauseDialog(false);
      toast({ title: "Intervention mise en pause" });
    } catch {
      toast({ title: "Erreur lors de la mise en pause", variant: "destructive" });
    }
  };

  const handleResume = async () => {
    if (!activePause) return;
    try {
      await resumeIntervention.mutateAsync({
        interventionId: intervention.id,
        pauseId: activePause.id,
      });
      toast({ title: "Intervention reprise" });
    } catch {
      toast({ title: "Erreur lors de la reprise", variant: "destructive" });
    }
  };

  const LockedOverlay = () => (
    <div className="absolute inset-0 bg-background/80 backdrop-blur-[1px] flex items-center justify-center z-10 rounded-lg">
      <div className="flex items-center gap-2 text-muted-foreground bg-muted/90 px-4 py-2 rounded-full text-sm">
        {isPaused ? (
          <>
            <PauseCircle className="h-4 w-4" />
            <span>Intervention en pause</span>
          </>
        ) : (
          <>
            <Lock className="h-4 w-4" />
            <span>Démarrez l'intervention d'abord</span>
          </>
        )}
      </div>
    </div>
  );


  return (
    <>
    <div className="space-y-0">
      {/* Cancelled banner */}
      {isCancelled && (
        <Card className="mb-4 border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
              <AlertCircle className="h-5 w-5" />
              <div>
                <span className="font-medium">Intervention annulée</span>
                {intervention.cancellation_reason && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-0.5">
                    Motif : {intervention.cancellation_reason}
                  </p>
                )}
                {intervention.cancellation_details && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-0.5">
                    {intervention.cancellation_details}
                  </p>
                )}
              </div>
            </div>
            {intervention.cancellation_photos && (intervention.cancellation_photos as string[]).length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-3">
                {(intervention.cancellation_photos as string[]).map((url, i) => (
                  <img key={i} src={url} alt="" className="rounded-lg aspect-square object-cover border" />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Locked banner for completed interventions */}
      {isLocked && !isCancelled && (
        <Card className="mb-4 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">Intervention terminée - Modification impossible</span>
            </div>
            <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
              Cette intervention est clôturée. Seul un administrateur peut la modifier.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Paused banner */}
      {isPaused && !isLocked && (
        <Card className="mb-4 border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
                <PauseCircle className="h-5 w-5" />
                <div>
                  <span className="font-medium">Intervention en pause</span>
                  <p className="text-sm text-orange-600 dark:text-orange-400 mt-0.5">
                    Motif : {activePause?.pause_reason}
                  </p>
                  <p className="text-xs text-orange-500 dark:text-orange-500 mt-0.5">
                    Depuis le {format(new Date(activePause!.paused_at), "dd/MM/yyyy à HH:mm", { locale: fr })}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={handleResume}
                disabled={resumeIntervention.isPending}
                className="shrink-0"
              >
                <PlayCircle className="h-4 w-4 mr-1" />
                Reprendre
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {stepsLocked && !isLocked && !isPaused && (
        <Card className="mb-4 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">Démarrez l'intervention pour débloquer les étapes</span>
            </div>
            <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
              Cliquez sur "Démarrer l'intervention" dans les informations générales pour accéder aux étapes.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Pause dialog */}
      <Dialog open={showPauseDialog} onOpenChange={setShowPauseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mettre en pause l'intervention</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label className="text-sm font-medium">Motif de la pause</label>
            <Input
              placeholder="Ex: Attente de pièces, pause déjeuner..."
              value={pauseReason}
              onChange={(e) => setPauseReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPauseDialog(false)}>Annuler</Button>
            <Button
              onClick={handlePause}
              disabled={!pauseReason.trim() || pauseIntervention.isPending}
            >
              <PauseCircle className="h-4 w-4 mr-1" />
              Confirmer la pause
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pause history dialog */}
      <Dialog open={showPauseHistory} onOpenChange={setShowPauseHistory}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Historique des pauses</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {pauses.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucune pause enregistrée</p>
            ) : (
              pauses.map((pause) => (
                <div key={pause.id} className="border rounded-lg p-3 space-y-1">
                  <p className="text-sm font-medium">{pause.pause_reason}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Pause : {format(new Date(pause.paused_at), "dd/MM/yyyy HH:mm", { locale: fr })}</span>
                  </div>
                  {pause.resumed_at ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <PlayCircle className="h-3 w-3" />
                      <span>Reprise : {format(new Date(pause.resumed_at), "dd/MM/yyyy HH:mm", { locale: fr })}</span>
                    </div>
                  ) : (
                    <span className="text-xs font-medium text-orange-600 dark:text-orange-400">En cours</span>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Step 0: General Info */}
      <WorkflowStep
        icon={Info}
        label="Informations générales"
        isActive={activeStep === 'general-info'}
        isCompleted={isStarted}
        onClick={() => handleStepClick('general-info')}
      >
        <Card>
          <CardContent className="p-4 space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Titre</label>
              <p className="font-medium mt-1">{intervention.title}</p>
            </div>

            {client && (
              <div className="border-t pt-4">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">Contact</label>
                <p className="font-medium">
                  {intervention.intervention_contact_name || client.name}
                </p>
                
                {(intervention.intervention_address || client.address) && (() => {
                  const addr = intervention.intervention_address 
                    ? `${intervention.intervention_address}, ${intervention.intervention_postal_code || ''} ${intervention.intervention_city || ''}`.trim()
                    : `${client.address}, ${client.postal_code || ''} ${client.city || ''}`.trim();
                  return (
                    <button
                      type="button"
                      className="flex items-start gap-2 text-sm text-primary dark:text-foreground hover:underline mt-2"
                      onClick={() => mapsChooser.openMaps(addr)}
                    >
                      <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>{addr}</span>
                    </button>
                  );
                })()}

                {(intervention.intervention_building || intervention.intervention_floor) && (
                  <div className="flex items-start gap-2 text-sm text-muted-foreground mt-1 ml-6">
                    <span>
                      {[
                        intervention.intervention_building ? `Bât. ${intervention.intervention_building}` : '',
                        intervention.intervention_floor ? `Étage ${intervention.intervention_floor}` : '',
                      ].filter(Boolean).join(' - ')}
                    </span>
                  </div>
                )}
                
                {(intervention.intervention_phone || client.phone) && (
                  <a 
                    href={`tel:${intervention.intervention_phone || client.phone}`} 
                    className="flex items-center gap-2 text-sm text-primary dark:text-foreground mt-2"
                  >
                    📞 {intervention.intervention_phone || client.phone}
                  </a>
                )}
                
                {(intervention.intervention_email || client.email) && (
                  <a 
                    href={`mailto:${intervention.intervention_email || client.email}`} 
                    className="flex items-center gap-2 text-sm text-primary dark:text-foreground mt-1"
                  >
                    ✉️ {intervention.intervention_email || client.email}
                  </a>
                )}
              </div>
            )}

            {intervention.description && (
              <div className="border-t pt-4">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Description</label>
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap break-words overflow-wrap-anywhere">
                  {intervention.description.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
                    /^https?:\/\//.test(part) ? (
                      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-primary dark:text-blue-400 underline break-all">
                        {part}
                      </a>
                    ) : (
                      <span key={i}>{part}</span>
                    )
                  )}
                </p>
              </div>
            )}

            {attachments.length > 0 && (
              <div className="border-t pt-4">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 block">
                  Pièces jointes
                </label>
                <AttachmentsList interventionId={intervention.id} isReadOnly={true} />
              </div>
            )}

            <JourneyTracker
              interventionStatus={intervention.status}
              travelDepartureTime={intervention.travel_departure_time}
              arrivalTime={intervention.arrival_time}
              departureTime={intervention.departure_time}
              onStatusChange={onStatusChange}
              onTimeUpdate={onTimeUpdate}
              isUpdating={isUpdating}
            />

            {/* Pause/Resume buttons - only shown when intervention is in progress */}
            {isStarted && !isLocked && (
              <div className="border-t pt-4 space-y-2">
                <div className="flex items-center gap-2">
                  {!isPaused ? (
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowPauseDialog(true)}
                    >
                      <PauseCircle className="h-4 w-4 mr-2" />
                      Mettre en pause
                    </Button>
                  ) : (
                    <Button
                      className="flex-1"
                      onClick={handleResume}
                      disabled={resumeIntervention.isPending}
                    >
                      <PlayCircle className="h-4 w-4 mr-2" />
                      Reprendre l'intervention
                    </Button>
                  )}
                  {pauses.length > 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowPauseHistory(true)}
                      title="Historique des pauses"
                    >
                      <Clock className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Cancel button - visible when planned or in_progress */}
            {!isLocked && !readOnly && (intervention.status === 'planned' || intervention.status === 'in_progress') && (
              <div className="border-t pt-4">
                <Button
                  variant="outline"
                  className="w-full border-destructive/50 text-destructive hover:bg-destructive/10"
                  onClick={() => setShowCancelDialog(true)}
                >
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Annuler l'intervention
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </WorkflowStep>

      {/* Pre-loop steps (run once, not repeated in loops) */}
      {preLoopSteps.map((step) => {
        const completion = stepCompletions.find(
          c => c.step_id === step.id && (c.loop_index ?? 0) === 0
        );
        const isStepCompleted = !!completion?.completed_at;
        const stepKey = `step-${step.id}-loop-0`;
        const isInlineLoopTrigger = step.is_loop_trigger && matchingType?.allow_loop;

        return (
          <WorkflowStep
            key={stepKey}
            icon={isInlineLoopTrigger ? RefreshCw : ClipboardList}
            label={step.label}
            isActive={activeStep === stepKey}
            isCompleted={isStepCompleted}
            onClick={() => handleStepClick(stepKey)}
            isDisabled={stepsLocked}
          >
            <div className="relative">
              {stepsLocked && <LockedOverlay />}
              {isInlineLoopTrigger ? (
                <Card>
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center gap-3">
                      <RefreshCw className="h-5 w-5 text-primary shrink-0" />
                      <div>
                        <p className="font-medium">{step.label}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Choisissez pour continuer ou passer à la suite.
                        </p>
                      </div>
                    </div>
                    {!isLocked && !isStepCompleted && (
                      <div className="flex flex-col gap-3">
                        <Button
                          className="w-full h-12 text-base"
                          onClick={async () => {
                            await handleCompleteStep(step.id, "Oui", undefined, undefined, undefined, 0);
                            // Navigate to the yes step
                            if (step.loop_yes_step_id) {
                              setActiveStep(`step-${step.loop_yes_step_id}-loop-0`);
                            }
                          }}
                          disabled={completeStep.isPending}
                        >
                          <CheckCircle className="h-5 w-5 mr-2" />
                          Oui
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full h-12 text-base"
                          onClick={async () => {
                            await handleCompleteStep(step.id, "Non", undefined, undefined, undefined, 0);
                            // Navigate to the no step or next step
                            if (step.loop_no_step_id) {
                              setActiveStep(`step-${step.loop_no_step_id}-loop-0`);
                            }
                          }}
                          disabled={completeStep.isPending}
                        >
                          Non
                        </Button>
                      </div>
                    )}
                    {isStepCompleted && (
                      <div className="flex items-center gap-2 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950 p-3 rounded-lg">
                        <CheckCircle className="h-5 w-5" />
                        <span className="font-medium text-sm">
                          {completion?.comment || "Étape validée"}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <DynamicStepContent
                  step={step}
                  interventionId={intervention.id}
                  completion={completion}
                  onComplete={(stepId, comment, photoUrl, checklistData, multipleChoiceData) => handleCompleteStep(stepId, comment, photoUrl, checklistData, multipleChoiceData, 0)}
                  isLocked={isLocked}
                  isCompleting={completeStep.isPending}
                  loopIndex={0}
                />
              )}
            </div>
          </WorkflowStep>
        );
      })}

      {/* Dynamic workflow steps - rendered inline with loops nested below trigger */}
      {loopableSteps.length > 0 && (() => {
        // Render loops recursively: each loop's steps appear inline,
        // and if "Oui" was clicked on trigger, the next loop appears right below it
        const renderLoop = (loopIdx: number): React.ReactNode[] => {
          const nodes: React.ReactNode[] = [];
          const loopComplete = isLoopComplete(loopIdx);
          // A past loop = completed AND there's at least one more loop after it
          // (the trigger was answered "Oui", meaning a next loop was started)
          const triggerCompletion = stepCompletions.find(
            c => c.step_id === loopTriggerStep?.id && c.loop_index === loopIdx && c.completed_at
          );
          const isPastLoop = loopComplete && !!triggerCompletion?.comment?.includes("Oui");

          // If it's a completed past loop, show as a single collapsible WorkflowStep
          if (isPastLoop) {
            const isExpanded = expandedEquipments.has(loopIdx);

            nodes.push(
              <WorkflowStep
                key={`equipment-${loopIdx}`}
                icon={CheckCircle}
                label={`Équipement ${loopIdx + 1}`}
                isActive={isExpanded}
                isCompleted={true}
                onClick={() => {
                  setExpandedEquipments(prev => {
                    const next = new Set(prev);
                    if (next.has(loopIdx)) {
                      next.delete(loopIdx);
                      // Clear activeStep if it belongs to this loop
                      if (activeStep?.includes(`loop-${loopIdx}`)) {
                        setActiveStep(null);
                      }
                    } else {
                      next.add(loopIdx);
                    }
                    return next;
                  });
                }}
                isDisabled={stepsLocked}
              >
                {isExpanded && (
                  <div className="space-y-0">
                    {renderLoopSteps(loopIdx, true)}
                  </div>
                )}
              </WorkflowStep>
            );

            // isPastLoop is true means trigger was "Oui", so always render next loop
            const nextLoopIdx = loopIdx + 1;
            if (nextLoopIdx < totalLoops) {
              nodes.push(...renderLoop(nextLoopIdx));
            }

            return nodes;
          }

          // Active / current loop: show separator then render steps normally
          if (loopIdx > 0) {
            nodes.push(
              <div key={`loop-sep-${loopIdx}`} className="flex items-center gap-2 my-3 px-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full">
                  Équipement {loopIdx + 1}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>
            );
          }
          nodes.push(...renderLoopSteps(loopIdx, false));

          return nodes;
        };

        // Extracted: render individual steps for a given loop index
        const renderLoopSteps = (loopIdx: number, insideCollapsible: boolean = false): React.ReactNode[] => {
          const nodes: React.ReactNode[] = [];
          const skippedIds = getSkippedStepIdsForLoop(loopIdx);

          for (const step of loopableSteps) {
            // Skip steps hidden by conditional branch
            if (skippedIds.has(step.id)) continue;
            const completion = stepCompletions.find(
              c => c.step_id === step.id && (c.loop_index ?? 0) === loopIdx
            );
            const isStepCompleted = !!completion?.completed_at;
            const stepKey = `step-${step.id}-loop-${loopIdx}`;
            const isMainLoopTrigger = step.id === loopTriggerStep?.id && matchingType?.allow_loop;
            const isConditionalBranch = step.is_loop_trigger && !isMainLoopTrigger && matchingType?.allow_loop;

            nodes.push(
              <WorkflowStep
                key={stepKey}
                icon={isMainLoopTrigger ? RefreshCw : isConditionalBranch ? RefreshCw : ClipboardList}
                label={step.label}
                isActive={activeStep === stepKey}
                isCompleted={isStepCompleted}
                onClick={() => handleStepClick(stepKey)}
                isDisabled={stepsLocked}
              >
                <div className="relative">
                  {stepsLocked && <LockedOverlay />}
                  {(isMainLoopTrigger || isConditionalBranch) ? (
                    <Card>
                      <CardContent className="p-4 space-y-4">
                        <div className="flex items-center gap-3">
                          <RefreshCw className="h-5 w-5 text-primary shrink-0" />
                          <div>
                            <p className="font-medium">{step.label}</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              {isMainLoopTrigger 
                                ? "Choisissez pour reprendre les étapes ou passer à la suite."
                                : "Choisissez pour continuer."}
                            </p>
                          </div>
                        </div>
                        {!isLocked && !isStepCompleted && (
                          <div className="flex flex-col gap-3">
                            <Button
                              className="w-full h-12 text-base"
                              onClick={async () => {
                                await handleCompleteStep(step.id, "Oui - continuer", undefined, undefined, undefined, loopIdx);
                                if (isMainLoopTrigger) {
                                  handleAddLoop();
                                } else if (step.loop_yes_step_id) {
                                  setActiveStep(`step-${step.loop_yes_step_id}-loop-${loopIdx}`);
                                }
                              }}
                              disabled={completeStep.isPending}
                            >
                              <RefreshCw className="h-5 w-5 mr-2" />
                              Oui
                            </Button>
                            <Button
                              variant="outline"
                              className="w-full h-12 text-base"
                              onClick={async () => {
                                await handleCompleteStep(step.id, "Non - passer à la suite", undefined, undefined, undefined, loopIdx);
                                if (isMainLoopTrigger) {
                                  if (loopTriggerStep?.loop_no_step_id) {
                                    setActiveStep(`step-${loopTriggerStep.loop_no_step_id}`);
                                  } else if (signatureSteps.length > 0) {
                                    setActiveStep(`step-${signatureSteps[0].id}`);
                                  } else {
                                    setActiveStep('finish');
                                  }
                                } else if (step.loop_no_step_id) {
                                  setActiveStep(`step-${step.loop_no_step_id}-loop-${loopIdx}`);
                                }
                              }}
                              disabled={completeStep.isPending}
                            >
                              Non
                            </Button>
                          </div>
                        )}
                        {isStepCompleted && (
                          <div className="flex items-center gap-2 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950 p-3 rounded-lg">
                            <CheckCircle className="h-5 w-5" />
                            <span className="font-medium text-sm">
                              {completion?.comment || "Étape validée"}
                            </span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ) : (
                    <DynamicStepContent
                      step={step}
                      interventionId={intervention.id}
                      completion={completion}
                      onComplete={(stepId, comment, photoUrl, checklistData, multipleChoiceData) => handleCompleteStep(stepId, comment, photoUrl, checklistData, multipleChoiceData, loopIdx)}
                      isLocked={isLocked}
                      isCompleting={completeStep.isPending}
                      loopIndex={loopIdx}
                    />
                  )}
                </div>
              </WorkflowStep>
            );

            // If this is the MAIN loop trigger and it was answered "Oui", render next loop inline right below
            // (only when NOT inside a collapsed equipment — parent handles chaining in that case)
            if (!insideCollapsible && isMainLoopTrigger && isStepCompleted && completion?.comment?.includes("Oui")) {
              const nextLoopIdx = loopIdx + 1;
              if (nextLoopIdx < totalLoops) {
                nodes.push(...renderLoop(nextLoopIdx));
              }
            }
          }
          return nodes;
        };

        // Only start rendering from loop 0; subsequent loops are rendered inline after their trigger
        return renderLoop(0);
      })()}

      {/* Post-loop steps (run once after all loops are done) */}
      {postLoopSteps.map((step) => {
        const completion = stepCompletions.find(
          c => c.step_id === step.id && (c.loop_index ?? 0) === 0
        );
        const isStepCompleted = !!completion?.completed_at;
        const stepKey = `step-${step.id}-loop-0`;

        return (
          <WorkflowStep
            key={stepKey}
            icon={ClipboardList}
            label={step.label}
            isActive={activeStep === stepKey}
            isCompleted={isStepCompleted}
            onClick={() => handleStepClick(stepKey)}
            isDisabled={stepsLocked}
          >
            <div className="relative">
              {stepsLocked && <LockedOverlay />}
              <DynamicStepContent
                step={step}
                interventionId={intervention.id}
                completion={completion}
                onComplete={(stepId, comment, photoUrl, checklistData, multipleChoiceData) => handleCompleteStep(stepId, comment, photoUrl, checklistData, multipleChoiceData, 0)}
                isLocked={isLocked}
                isCompleting={completeStep.isPending}
                loopIndex={0}
              />
            </div>
          </WorkflowStep>
        );
      })}

      {/* Signature steps - shown after all loops, not part of the loop */}
      {signatureSteps.map((step) => {
        const completion = stepCompletions.find(c => c.step_id === step.id);
        const isStepCompleted = !!completion?.completed_at;
        const stepKey = `step-${step.id}`;

        return (
          <WorkflowStep
            key={step.id}
            icon={PenTool}
            label={step.label}
            isActive={activeStep === stepKey}
            isCompleted={isStepCompleted}
            onClick={() => handleStepClick(stepKey)}
            isDisabled={stepsLocked}
          >
            <div className="relative">
              {stepsLocked && <LockedOverlay />}
              <DynamicStepContent
                step={step}
                interventionId={intervention.id}
                completion={completion}
                onComplete={(stepId, comment, photoUrl, checklistData, multipleChoiceData) => handleCompleteStep(stepId, comment, photoUrl, checklistData, multipleChoiceData, 0)}
                isLocked={isLocked}
                isCompleting={completeStep.isPending}
              />
            </div>
          </WorkflowStep>
        );
      })}

      {/* If no dynamic steps configured, show a message */}
      {workflowSteps.length === 0 && (
        <Card className="my-4 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">Aucune étape configurée</span>
            </div>
            <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
              Ce type d'intervention n'a pas d'étapes de workflow. Demandez à un administrateur de configurer les étapes dans les paramètres.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Final step: Finish */}
      <WorkflowStep
        icon={CheckCircle}
        label="Terminer l'intervention"
        isActive={activeStep === 'finish'}
        isCompleted={isCompleted}
        isLast
        onClick={() => handleStepClick('finish')}
        isDisabled={stepsLocked}
      >
        <div className="relative">
          {stepsLocked && <LockedOverlay />}
          <Card>
            <CardContent className="p-4 space-y-4">
              {!isCompleted && isStarted && (
                <>
                  <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                      <CheckCircle className="h-5 w-5" />
                      <div>
                        <p className="font-medium text-sm">Prêt à clôturer</p>
                        <p className="text-xs mt-1 text-green-600 dark:text-green-400">
                          Vous pouvez clôturer l'intervention.
                        </p>
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={onEndIntervention}
                    disabled={isUpdating}
                    className="w-full"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Clôturer l'intervention
                  </Button>
                </>
              )}
              
              {isCompleted && (
                <div className="text-center space-y-4">
                  <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Intervention terminée</span>
                  </div>
                  <Button variant="outline" className="w-full" onClick={onDownloadPDF}>
                    <FileText className="h-4 w-4 mr-2" />
                    Télécharger le rapport PDF
                  </Button>
                  
                  {/* Return journey button - only if track_journey is enabled */}
                  {matchingType?.track_journey && (
                    <>
                      {intervention.travel_return_arrival_time ? (
                        <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm bg-muted/50 rounded-lg p-3">
                          <CheckCircle className="h-4 w-4" />
                          <span>Trajet retour: {intervention.travel_return_time?.substring(0, 5)} → {intervention.travel_return_arrival_time.substring(0, 5)}</span>
                        </div>
                      ) : intervention.travel_return_time ? (
                        <Button
                          variant="outline"
                          className="w-full border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-950"
                          onClick={async () => {
                            const now = format(new Date(), 'HH:mm:ss');
                            await onTimeUpdate('travel_return_arrival_time', now);
                            toast({ title: "Trajet retour terminé à " + now.substring(0, 5) });
                          }}
                          disabled={isUpdating}
                        >
                          <MapPin className="h-4 w-4 mr-2" />
                          Arrivée - Fin du trajet retour
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          className="w-full border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950"
                          onClick={async () => {
                            const now = format(new Date(), 'HH:mm:ss');
                            await onTimeUpdate('travel_return_time', now);
                            toast({ title: "Trajet retour démarré à " + now.substring(0, 5) });
                          }}
                          disabled={isUpdating}
                        >
                          <Car className="h-4 w-4 mr-2" />
                          Démarrer le trajet retour
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </WorkflowStep>
    </div>
    <MapsChooser address={mapsChooser.address} open={mapsChooser.open} onOpenChange={mapsChooser.setOpen} />
    <CancelInterventionDialog
      open={showCancelDialog}
      onOpenChange={setShowCancelDialog}
      interventionId={intervention.id}
      onConfirm={async (data) => {
        await onCancelIntervention(data);
        setShowCancelDialog(false);
      }}
      isUpdating={isUpdating}
    />
    </>
  );
};

export default InterventionWorkflow;
