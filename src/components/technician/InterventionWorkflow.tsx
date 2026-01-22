import { useState, useEffect } from "react";
import { 
  Play, 
  MapPin, 
  Wrench, 
  CheckCircle, 
  FileText, 
  PenTool,
  User,
  Save,
  MessageSquare,
  AlertCircle,
  Car,
  Home,
  Info,
} from "lucide-react";
import WorkflowStep from "./WorkflowStep";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import SignaturePad from "@/components/SignaturePad";
import AddEquipmentDialog from "@/components/AddEquipmentDialog";
import EquipmentLoopCard from "@/components/EquipmentLoopCard";
import AttachmentsList from "@/components/technician/AttachmentsList";
import { InterventionEquipment } from "@/hooks/useInterventionEquipment";
import { Tables } from "@/integrations/supabase/types";

type Client = Tables<"clients">;
type Intervention = Tables<"interventions">;

interface InterventionWorkflowProps {
  intervention: Intervention;
  client: Client | undefined;
  interventionEquipment: InterventionEquipment[];
  arrivalTime: string;
  departureTime: string;
  travelDepartureTime: string;
  travelReturnTime: string;
  report: string;
  observations: string;
  clientSignatureName: string;
  clientSignatureUrl: string | null;
  onStartIntervention: () => Promise<void>;
  onEndIntervention: () => Promise<void>;
  onStartTravel: () => Promise<void>;
  onEndTravel: () => Promise<void>;
  onSave: () => Promise<void>;
  onSignatureComplete: (signatureDataUrl: string, signerName: string) => Promise<void>;
  onArrivalTimeChange: (value: string) => void;
  onDepartureTimeChange: (value: string) => void;
  onTravelDepartureTimeChange: (value: string) => void;
  onTravelReturnTimeChange: (value: string) => void;
  onReportChange: (value: string) => void;
  onObservationsChange: (value: string) => void;
  onClientSignatureNameChange: (value: string) => void;
  onDownloadPDF: () => Promise<void>;
  isUpdating: boolean;
}

const InterventionWorkflow = ({
  intervention,
  client,
  interventionEquipment,
  arrivalTime,
  departureTime,
  travelDepartureTime,
  travelReturnTime,
  report,
  observations,
  clientSignatureName,
  clientSignatureUrl,
  onStartIntervention,
  onEndIntervention,
  onStartTravel,
  onEndTravel,
  onSave,
  onSignatureComplete,
  onArrivalTimeChange,
  onDepartureTimeChange,
  onTravelDepartureTimeChange,
  onTravelReturnTimeChange,
  onReportChange,
  onObservationsChange,
  onClientSignatureNameChange,
  onDownloadPDF,
  isUpdating,
}: InterventionWorkflowProps) => {
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const existingEquipmentIds = interventionEquipment.map(ie => ie.equipment_id);
  
  // Determine completed steps based on data
  const hasTravelDeparture = !!travelDepartureTime;
  const isStarted = intervention.status === 'in_progress' || intervention.status === 'completed';
  const hasEquipment = interventionEquipment.length > 0;
  const hasReport = !!report.trim();
  const hasObservations = !!observations.trim();
  const hasSignature = !!clientSignatureUrl;
  const isCompleted = intervention.status === 'completed';
  const isToInvoice = intervention.status === 'to_invoice';
  const isArchived = intervention.status === 'archived';
  const hasTravelReturn = !!travelReturnTime;
  
  // Check if intervention is locked (completed, to_invoice, or archived)
  const isLocked = isCompleted || isToInvoice || isArchived;

  // Auto-open first incomplete step
  useEffect(() => {
    if (isLocked && !hasTravelReturn) {
      setActiveStep('travel-return');
    } else if (isLocked) {
      setActiveStep('finish');
    } else if (!hasTravelDeparture) {
      setActiveStep('travel-start');
    } else if (!isStarted) {
      setActiveStep('start');
    } else if (!hasEquipment) {
      setActiveStep('equipment');
    } else if (!hasReport) {
      setActiveStep('report');
    } else if (!hasSignature) {
      setActiveStep('signature');
    } else {
      setActiveStep('finish');
    }
  }, [isStarted, hasEquipment, hasReport, hasSignature, isLocked, hasTravelDeparture, hasTravelReturn]);

  const handleStepClick = (step: string) => {
    setActiveStep(activeStep === step ? null : step);
  };

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

      {/* Step 0: General Info */}
      <WorkflowStep
        icon={Info}
        label="Informations générales"
        isActive={activeStep === 'general-info'}
        isCompleted={true}
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
            <div className="border-t pt-4">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 block">
                Pièces jointes
              </label>
              <AttachmentsList interventionId={intervention.id} isReadOnly={true} />
            </div>
          </CardContent>
        </Card>
      </WorkflowStep>

      {/* Step 1: Travel Start */}
      <WorkflowStep
        icon={Car}
        label="Départ du domicile/hôtel"
        isActive={activeStep === 'travel-start'}
        isCompleted={hasTravelDeparture}
        onClick={() => handleStepClick('travel-start')}
      >
        {!hasTravelDeparture ? (
          <Button onClick={onStartTravel} className="w-full" size="lg" disabled={isLocked}>
            <Car className="h-5 w-5 mr-2" />
            Démarrer le trajet
          </Button>
        ) : (
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span>Départ enregistré: {travelDepartureTime}</span>
              </div>
              {!isLocked && (
                <div>
                  <label className="text-sm text-muted-foreground">Modifier l'heure de départ</label>
                  <Input
                    type="time"
                    value={travelDepartureTime}
                    onChange={(e) => onTravelDepartureTimeChange(e.target.value)}
                    className="mt-1"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </WorkflowStep>

      {/* Step 1: Start Intervention */}
      <WorkflowStep
        icon={Play}
        label="Arrivée chez le client"
        isActive={activeStep === 'start'}
        isCompleted={isStarted}
        onClick={() => handleStepClick('start')}
      >
        {!isStarted ? (
          <Button onClick={onStartIntervention} className="w-full" size="lg" disabled={isLocked}>
            <Play className="h-5 w-5 mr-2" />
            Confirmer l'arrivée
          </Button>
        ) : (
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span>Arrivée enregistrée: {arrivalTime}</span>
              </div>
              {!isLocked && (
                <div>
                  <label className="text-sm text-muted-foreground">Modifier l'heure d'arrivée</label>
                  <Input
                    type="time"
                    value={arrivalTime}
                    onChange={(e) => onArrivalTimeChange(e.target.value)}
                    className="mt-1"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </WorkflowStep>

      {/* Step 2: Client Info */}
      <WorkflowStep
        icon={User}
        label="Informations client"
        isActive={activeStep === 'client'}
        isCompleted={isStarted}
        onClick={() => handleStepClick('client')}
      >
        {client && (
          <Card>
            <CardContent className="p-4 space-y-2">
              <p className="font-medium">{client.name}</p>
              {client.address && (
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{client.address}, {client.postal_code} {client.city}</span>
                </div>
              )}
              {client.phone && (
                <a href={`tel:${client.phone}`} className="flex items-center gap-2 text-sm text-primary">
                  📞 {client.phone}
                </a>
              )}
            </CardContent>
          </Card>
        )}
      </WorkflowStep>

      {/* Step 3: Equipment */}
      <WorkflowStep
        icon={Wrench}
        label={`Équipements (${interventionEquipment.length})`}
        isActive={activeStep === 'equipment'}
        isCompleted={hasEquipment}
        onClick={() => handleStepClick('equipment')}
      >
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
      </WorkflowStep>

      {/* Step 4: Report */}
      <WorkflowStep
        icon={FileText}
        label="Compte rendu"
        isActive={activeStep === 'report'}
        isCompleted={hasReport}
        onClick={() => handleStepClick('report')}
      >
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
      </WorkflowStep>

      {/* Step 5: Observations */}
      <WorkflowStep
        icon={MessageSquare}
        label="Observations"
        isActive={activeStep === 'observations'}
        isCompleted={hasObservations}
        onClick={() => handleStepClick('observations')}
      >
        <Card>
          <CardContent className="p-4 space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Remarques, recommandations</label>
              <Textarea
                placeholder="Observations pour le client..."
                value={observations}
                onChange={(e) => onObservationsChange(e.target.value)}
                className="min-h-[100px]"
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
      </WorkflowStep>

      {/* Step 6: Signature */}
      <WorkflowStep
        icon={PenTool}
        label="Signature client"
        isActive={activeStep === 'signature'}
        isCompleted={hasSignature}
        onClick={() => handleStepClick('signature')}
      >
        <SignaturePad
          onSignatureComplete={onSignatureComplete}
          signerName={clientSignatureName}
          onSignerNameChange={onClientSignatureNameChange}
          existingSignature={clientSignatureUrl}
        />
      </WorkflowStep>

      {/* Step 7: Finish */}
      <WorkflowStep
        icon={CheckCircle}
        label="Terminer l'intervention"
        isActive={activeStep === 'finish'}
        isCompleted={isCompleted}
        onClick={() => handleStepClick('finish')}
      >
        <Card>
          <CardContent className="p-4 space-y-4">
            {!isCompleted && isStarted && (
              <>
                <div>
                  <label className="text-sm font-medium mb-2 block">Heure de départ du client</label>
                  <Input
                    type="time"
                    value={departureTime}
                    onChange={(e) => onDepartureTimeChange(e.target.value)}
                  />
                </div>
                <Button 
                  onClick={onEndIntervention} 
                  className="w-full bg-green-600 hover:bg-green-700" 
                  size="lg"
                  disabled={isUpdating}
                >
                  <CheckCircle className="h-5 w-5 mr-2" />
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
      </WorkflowStep>

      {/* Step 8: Travel Return */}
      <WorkflowStep
        icon={Home}
        label="Retour au domicile/hôtel"
        isActive={activeStep === 'travel-return'}
        isCompleted={hasTravelReturn}
        isLast
        onClick={() => handleStepClick('travel-return')}
      >
        {!hasTravelReturn ? (
          <Button onClick={onEndTravel} className="w-full" size="lg" disabled={!isCompleted}>
            <Home className="h-5 w-5 mr-2" />
            Confirmer le retour
          </Button>
        ) : (
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span>Retour enregistré: {travelReturnTime}</span>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Modifier l'heure de retour</label>
                <Input
                  type="time"
                  value={travelReturnTime}
                  onChange={(e) => onTravelReturnTimeChange(e.target.value)}
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>
        )}
      </WorkflowStep>
    </div>
  );
};

export default InterventionWorkflow;
