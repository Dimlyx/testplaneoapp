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
} from "lucide-react";
import WorkflowStep from "./WorkflowStep";
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
  
  // Determine completed steps based on data
  const isStarted = intervention.status === 'in_progress' || intervention.status === 'completed' || intervention.status === 'to_invoice' || intervention.status === 'archived';
  const hasEquipment = interventionEquipment.length > 0;
  const hasReport = !!report.trim();
  const hasSignature = !!clientSignatureUrl;
  const isCompleted = intervention.status === 'completed';
  const isToInvoice = intervention.status === 'to_invoice';
  const isArchived = intervention.status === 'archived';
  
  // Check if intervention is locked (completed, to_invoice, or archived)
  const isLocked = isCompleted || isToInvoice || isArchived;

  // Steps are locked until intervention is started
  const stepsLocked = !isStarted;

  // Auto-open first incomplete step
  useEffect(() => {
    if (isLocked) {
      setActiveStep('finish');
    } else if (!isStarted) {
      setActiveStep('general-info');
    } else if (!hasEquipment) {
      setActiveStep('equipment');
    } else if (!hasReport) {
      setActiveStep('report');
    } else if (!hasSignature) {
      setActiveStep('signature');
    } else {
      setActiveStep('finish');
    }
  }, [isStarted, hasEquipment, hasReport, hasSignature, isLocked]);

  const handleStepClick = (step: string) => {
    // Block other steps if intervention not started (except general-info)
    if (stepsLocked && step !== 'general-info') {
      return;
    }
    setActiveStep(activeStep === step ? null : step);
  };

  // Locked step indicator component
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

      {/* Warning banner when intervention not started */}
      {stepsLocked && !isLocked && (
        <Card className="mb-4 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">Démarrez l'intervention pour débloquer les étapes</span>
            </div>
            <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
              Cliquez sur "Démarrer l'intervention" dans les informations générales pour accéder aux équipements, compte rendu et signature.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Step 0: General Info + Client */}
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
            
            {/* Client info section */}
            {client && (
              <div className="border-t pt-4">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">Client</label>
                <p className="font-medium">{client.name}</p>
                
                {/* Show intervention address if available, otherwise client address */}
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
                
                {/* Phone: intervention phone or client phone */}
                {(intervention.intervention_phone || client.phone) && (
                  <a 
                    href={`tel:${intervention.intervention_phone || client.phone}`} 
                    className="flex items-center gap-2 text-sm text-primary mt-2"
                  >
                    📞 {intervention.intervention_phone || client.phone}
                  </a>
                )}
                
                {/* Email: intervention email or client email */}
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

            {/* Journey tracker buttons */}
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

      {/* Step 1: Equipment */}
      <WorkflowStep
        icon={Wrench}
        label={`Équipements (${interventionEquipment.length})`}
        isActive={activeStep === 'equipment'}
        isCompleted={hasEquipment}
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
                  <p className="text-sm text-muted-foreground mb-4">
                    Aucun équipement ajouté
                  </p>
                </CardContent>
              </Card>
            ) : (
              interventionEquipment.map((ie, index) => (
                <EquipmentLoopCard
                  key={ie.id}
                  interventionEquipment={ie}
                  interventionId={intervention.id}
                  index={index}
                  isReadOnly={isLocked}
                />
              ))
            )}
            
            {client && !isLocked && (
              <AddEquipmentDialog
                clientId={client.id}
                interventionId={intervention.id}
                existingEquipmentIds={existingEquipmentIds}
              />
            )}
          </div>
        </div>
      </WorkflowStep>

      {/* Step 2: Report */}
      <WorkflowStep
        icon={FileText}
        label="Compte rendu"
        isActive={activeStep === 'report'}
        isCompleted={hasReport}
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

      {/* Step 3: Signature */}
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

      {/* Step 4: Finish */}
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
                  {!hasSignature ? (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <div className="flex items-start gap-2 text-amber-700 dark:text-amber-300">
                        <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium text-sm">Signature requise</p>
                          <p className="text-xs mt-1 text-amber-600 dark:text-amber-400">
                            La signature du client est nécessaire pour clôturer l'intervention.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                      <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                        <CheckCircle className="h-5 w-5" />
                        <div>
                          <p className="font-medium text-sm">Intervention clôturée</p>
                          <p className="text-xs mt-1 text-green-600 dark:text-green-400">
                            La signature du client a été enregistrée et l'intervention est terminée.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
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