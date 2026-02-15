import { useState, useEffect } from "react";
import { 
  MapPin, 
  Wrench, 
  CheckCircle, 
  FileText, 
  PenTool,
  Save,
  AlertCircle,
  Info,
  Lock,
  ClipboardList,
} from "lucide-react";
import WorkflowStep from "./WorkflowStep";
import DynamicStepContent from "./DynamicStepContent";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import SignaturePad from "@/components/SignaturePad";
import AddEquipmentDialog from "@/components/AddEquipmentDialog";
import EquipmentLoopCard from "@/components/EquipmentLoopCard";
import AttachmentsList from "@/components/technician/AttachmentsList";
import JourneyTracker from "@/components/technician/JourneyTracker";
import { InterventionEquipment } from "@/hooks/useInterventionEquipment";
import { Tables } from "@/integrations/supabase/types";
import { useInterventionTypes } from "@/hooks/useInterventionTypes";
import { useWorkflowSteps } from "@/hooks/useWorkflowSteps";
import { useStepCompletions, useCompleteStep } from "@/hooks/useStepCompletions";

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

  // Determine completed steps based on data
  const isStarted = intervention.status === 'in_progress' || intervention.status === 'completed' || intervention.status === 'to_invoice' || intervention.status === 'archived';
  const hasSignature = !!clientSignatureUrl;
  const isCompleted = intervention.status === 'completed';
  const isToInvoice = intervention.status === 'to_invoice';
  const isArchived = intervention.status === 'archived';
  
  const isLocked = isCompleted || isToInvoice || isArchived;
  const stepsLocked = !isStarted;

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

  const LockedOverlay = () => (
    <div className="absolute inset-0 bg-background/80 backdrop-blur-[1px] flex items-center justify-center z-10 rounded-lg">
      <div className="flex items-center gap-2 text-muted-foreground bg-muted/90 px-4 py-2 rounded-full text-sm">
        <Lock className="h-4 w-4" />
        <span>Démarrez l'intervention d'abord</span>
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

      {stepsLocked && !isLocked && (
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
                onSignatureComplete={step.requires_signature ? onSignatureComplete : undefined}
                isLocked={isLocked}
                isCompleting={completeStep.isPending}
                signerName={clientSignatureName}
                onSignerNameChange={onClientSignatureNameChange}
                existingSignature={clientSignatureUrl}
              />
            </div>
          </WorkflowStep>
        );
      })}

      {/* If no dynamic steps configured, show fallback equipment + report + signature */}
      {workflowSteps.length === 0 && (
        <>
          {/* Equipment */}
          <WorkflowStep
            icon={Wrench}
            label={`Équipements (${interventionEquipment.length})`}
            isActive={activeStep === 'equipment'}
            isCompleted={interventionEquipment.length > 0}
            onClick={() => handleStepClick('equipment')}
            isDisabled={stepsLocked}
          >
            <div className="relative">
              {stepsLocked && <LockedOverlay />}
              <div className="space-y-4">
                {interventionEquipment.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <Wrench className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground mb-4">Aucun équipement ajouté</p>
                    </CardContent>
                  </Card>
                ) : (
                  interventionEquipment.map((ie, idx) => (
                    <EquipmentLoopCard
                      key={ie.id}
                      interventionEquipment={ie}
                      interventionId={intervention.id}
                      index={idx}
                      isReadOnly={isLocked}
                    />
                  ))
                )}
                {client && !isLocked && (
                  <AddEquipmentDialog
                    clientId={client.id}
                    interventionId={intervention.id}
                    existingEquipmentIds={existingEquipmentIds}
                    organizationId={intervention.organization_id}
                  />
                )}
              </div>
            </div>
          </WorkflowStep>

          {/* Report */}
          <WorkflowStep
            icon={FileText}
            label="Compte rendu"
            isActive={activeStep === 'report'}
            isCompleted={!!report.trim()}
            onClick={() => handleStepClick('report')}
            isDisabled={stepsLocked}
          >
            <div className="relative">
              {stepsLocked && <LockedOverlay />}
              <Card>
                <CardContent className="p-4 space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Travaux effectués</label>
                    <Textarea
                      placeholder="Décrivez les travaux réalisés..."
                      value={report}
                      onChange={(e) => onReportChange(e.target.value)}
                      className="min-h-[120px]"
                      disabled={isLocked}
                    />
                  </div>
                  {!isLocked && (
                    <Button onClick={onSave} disabled={isUpdating} className="w-full">
                      <Save className="h-4 w-4 mr-2" />
                      Enregistrer
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          </WorkflowStep>

          {/* Signature */}
          <WorkflowStep
            icon={PenTool}
            label="Signature client"
            isActive={activeStep === 'signature'}
            isCompleted={hasSignature}
            onClick={() => handleStepClick('signature')}
            isDisabled={stepsLocked}
          >
            <div className="relative">
              {stepsLocked && <LockedOverlay />}
              <SignaturePad
                onSignatureComplete={onSignatureComplete}
                signerName={clientSignatureName}
                onSignerNameChange={onClientSignatureNameChange}
                existingSignature={clientSignatureUrl}
              />
            </div>
          </WorkflowStep>
        </>
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
