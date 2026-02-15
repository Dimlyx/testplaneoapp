import { useState, useEffect } from "react";
import { 
  MapPin, 
  Wrench, 
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
} from "lucide-react";
import WorkflowStep from "./WorkflowStep";
import DynamicStepContent from "./DynamicStepContent";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import AddEquipmentDialog from "@/components/AddEquipmentDialog";
import EquipmentLoopCard from "@/components/EquipmentLoopCard";
import AttachmentsList from "@/components/technician/AttachmentsList";
import JourneyTracker from "@/components/technician/JourneyTracker";
import { InterventionEquipment } from "@/hooks/useInterventionEquipment";
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

interface InterventionWorkflowProps {
  intervention: Intervention;
  client: Client | undefined;
  interventionEquipment: InterventionEquipment[];
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
  isUpdating: boolean;
}

const InterventionWorkflow = ({
  intervention,
  client,
  interventionEquipment,
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
  isUpdating,
}: InterventionWorkflowProps) => {
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const existingEquipmentIds = interventionEquipment.map(ie => ie.equipment_id);
  
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
  const isPaused = !!activePause;

  // Determine completed steps based on data
  const isStarted = intervention.status === 'in_progress' || intervention.status === 'completed' || intervention.status === 'to_invoice' || intervention.status === 'archived';
  const hasSignature = !!clientSignatureUrl;
  const isCompleted = intervention.status === 'completed';
  const isToInvoice = intervention.status === 'to_invoice';
  const isArchived = intervention.status === 'archived';
  
  const isLocked = isCompleted || isToInvoice || isArchived;
  const stepsLocked = !isStarted || isPaused;

  // Check if all dynamic steps are completed
  const allDynamicStepsCompleted = workflowSteps.length === 0 || workflowSteps.every(
    step => stepCompletions.some(c => c.step_id === step.id && c.completed_at)
  );

  // Auto-open first incomplete step
  useEffect(() => {
    if (isLocked) {
      setActiveStep('finish');
      return;
    }
    if (!isStarted) {
      setActiveStep('general-info');
      return;
    }
    // Find first incomplete dynamic step
    const firstIncomplete = workflowSteps.find(
      step => !stepCompletions.some(c => c.step_id === step.id && c.completed_at)
    );
    if (firstIncomplete) {
      setActiveStep(`step-${firstIncomplete.id}`);
    } else {
      setActiveStep('finish');
    }
  }, [isStarted, isLocked, workflowSteps.length, stepCompletions.length]);

  const handleStepClick = (step: string) => {
    if (stepsLocked && step !== 'general-info') return;
    setActiveStep(activeStep === step ? null : step);
  };

  const handleCompleteStep = async (stepId: string, comment?: string, photoUrl?: string) => {
    await completeStep.mutateAsync({
      interventionId: intervention.id,
      stepId,
      comment,
      photoUrl,
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
    <div className="space-y-0">
      {/* Locked banner for completed interventions */}
      {isLocked && (
        <Card className="mb-4 border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-amber-700">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">Intervention terminée - Modification impossible</span>
            </div>
            <p className="text-sm text-amber-600 mt-1">
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
                    <span className="text-xs font-medium text-orange-600">En cours</span>
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
            {intervention.description && (
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Description</label>
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{intervention.description}</p>
              </div>
            )}
            
            {client && (
              <div className="border-t pt-4">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">Contact</label>
                <p className="font-medium">
                  {intervention.intervention_contact_name || client.name}
                </p>
                
                {(intervention.intervention_address || client.address) && (
                  <div className="flex items-start gap-2 text-sm text-muted-foreground mt-2">
                    <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>
                      {intervention.intervention_address 
                        ? `${intervention.intervention_address}, ${intervention.intervention_postal_code || ''} ${intervention.intervention_city || ''}`.trim()
                        : `${client.address}, ${client.postal_code || ''} ${client.city || ''}`.trim()
                      }
                    </span>
                  </div>
                )}

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
                    className="flex items-center gap-2 text-sm text-primary mt-2"
                  >
                    📞 {intervention.intervention_phone || client.phone}
                  </a>
                )}
                
                {(intervention.intervention_email || client.email) && (
                  <a 
                    href={`mailto:${intervention.intervention_email || client.email}`} 
                    className="flex items-center gap-2 text-sm text-primary mt-1"
                  >
                    ✉️ {intervention.intervention_email || client.email}
                  </a>
                )}
              </div>
            )}

            <div className="border-t pt-4">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 block">
                Pièces jointes
              </label>
              <AttachmentsList interventionId={intervention.id} isReadOnly={true} />
            </div>

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
          </CardContent>
        </Card>
      </WorkflowStep>

      {/* Dynamic workflow steps from intervention type */}
      {workflowSteps.map((step, index) => {
        const completion = stepCompletions.find(c => c.step_id === step.id);
        const isStepCompleted = !!completion?.completed_at;
        const isLastDynamicStep = index === workflowSteps.length - 1;
        const stepKey = `step-${step.id}`;

        return (
          <WorkflowStep
            key={step.id}
            icon={step.requires_signature ? PenTool : step.requires_photo ? Wrench : ClipboardList}
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
                onComplete={handleCompleteStep}
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
                  <div className="flex items-center justify-center gap-2 text-green-600">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Intervention terminée</span>
                  </div>
                  <Button variant="outline" className="w-full" onClick={onDownloadPDF}>
                    <FileText className="h-4 w-4 mr-2" />
                    Télécharger le rapport PDF
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </WorkflowStep>
    </div>
  );
};

export default InterventionWorkflow;
