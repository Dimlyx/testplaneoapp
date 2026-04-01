import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useIntervention, useUpdateIntervention } from "@/hooks/useInterventions";
import { useClient } from "@/hooks/useClients";
import { useCompanySettings, useDocumentSettings } from "@/hooks/useAppSettings";
import { useInterventionTypes } from "@/hooks/useInterventionTypes";
import { useWorkflowSteps } from "@/hooks/useWorkflowSteps";
import { useStepCompletions } from "@/hooks/useStepCompletions";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { StatusBadge, TypeBadge } from "@/components/ui/status-badge";
import { ArrowLeft, Calendar, Clock, Eye } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";

function formatTimeRange(time: string, duration?: number | null): string {
  const hhmm = time.substring(0, 5);
  if (!duration) return hhmm;
  const [h, m] = hhmm.split(":").map(Number);
  const endMin = h * 60 + m + duration;
  const endH = String(Math.floor(endMin / 60) % 24).padStart(2, "0");
  const endM = String(endMin % 60).padStart(2, "0");
  return `${hhmm} - ${endH}:${endM}`;
}
import { generateInterventionPDF } from "@/lib/pdf-generator";
import { supabase } from "@/integrations/supabase/client";
import { useInterventionPhotos } from "@/hooks/useInterventionPhotos";
import InterventionWorkflow from "@/components/technician/InterventionWorkflow";

const TechnicianInterventionDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const { data: intervention, isLoading } = useIntervention(id || "");
  const { data: client } = useClient(intervention?.client_id || "");
  const { data: photos = [] } = useInterventionPhotos(id || "");
  const { data: companySettings } = useCompanySettings();
  const { data: documentSettings } = useDocumentSettings();
  const updateIntervention = useUpdateIntervention();

  // Determine if the current user is a team member (not the leader)
  const isTeamMember = intervention?.team_id && intervention?.technician_id !== user?.id;
  
  // For PDF generation with step data
  const { data: interventionTypes = [] } = useInterventionTypes();
  const matchingType = interventionTypes.find(
    t => t.name === intervention?.intervention_type
  );
  const { data: workflowSteps = [] } = useWorkflowSteps(matchingType?.id);
  const { data: stepCompletions = [] } = useStepCompletions(id || "");

  const [status, setStatus] = useState<string>("");
  const [report, setReport] = useState<string>("");
  const [clientSignatureName, setClientSignatureName] = useState<string>("");
  const [clientSignatureUrl, setClientSignatureUrl] = useState<string | null>(null);
  const [isUploadingSignature, setIsUploadingSignature] = useState(false);

  // Initialize form when data loads
  useEffect(() => {
    if (intervention) {
      setStatus(intervention.status);
      setReport(intervention.report || "");
      setClientSignatureName(intervention.client_signature_name || "");
      setClientSignatureUrl(intervention.client_signature_url || null);
    }
  }, [intervention]);

  const handleSignatureComplete = async (signatureDataUrl: string, signerName: string) => {
    if (!id) return;
    
    setIsUploadingSignature(true);
    try {
      const response = await fetch(signatureDataUrl);
      const blob = await response.blob();
      
      const fileName = `signatures/${id}-${Date.now()}.png`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('intervention-photos')
        .upload(fileName, blob, {
          contentType: 'image/png',
          upsert: false
        });
      
      if (uploadError) throw uploadError;
      
      // Store the public URL path in DB (will be resolved to signed URL on display)
      const { data: urlData } = supabase.storage
        .from('intervention-photos')
        .getPublicUrl(fileName);
      
      const signatureUrl = urlData.publicUrl;
      
      // Record departure time and complete intervention when client signs
      const departureTime = format(new Date(), 'HH:mm:ss');
      
      await updateIntervention.mutateAsync({
        id,
        client_signature_name: signerName,
        client_signature_url: signatureUrl,
        status: 'completed',
        departure_time: departureTime,
        report,
      });
      
      setClientSignatureUrl(signatureUrl);
      setClientSignatureName(signerName);
      setStatus('completed');
      toast({ title: "Signature enregistrée - Intervention terminée" });
    } catch (error) {
      console.error('Error uploading signature:', error);
      toast({ title: "Erreur lors de l'enregistrement de la signature", variant: "destructive" });
    } finally {
      setIsUploadingSignature(false);
    }
  };

  const handleEndIntervention = async () => {
    if (!id) return;
    setStatus('completed');
    const departureTime = format(new Date(), 'HH:mm:ss');
    try {
      await updateIntervention.mutateAsync({
        id,
        status: 'completed',
        report,
        client_signature_name: clientSignatureName,
        departure_time: departureTime,
      });
      toast({ title: "Intervention terminée" });
    } catch (error) {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!id) return;
    setStatus(newStatus);
    try {
      await updateIntervention.mutateAsync({
        id,
        status: newStatus as any,
      });
      toast({ title: "Statut mis à jour" });
    } catch (error) {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  const handleTimeUpdate = async (field: string, value: string) => {
    if (!id) return;
    try {
      await updateIntervention.mutateAsync({
        id,
        [field]: value,
      });
      toast({ title: "Temps enregistré" });
    } catch (error) {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  const handleSave = async () => {
    if (!id) return;
    try {
      await updateIntervention.mutateAsync({
        id,
        status: status as any,
        report,
        client_signature_name: clientSignatureName,
      });
      toast({ title: "Intervention mise à jour" });
    } catch (error) {
      toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
    }
  };

  const handleDownloadPDF = async () => {
    if (intervention && client) {
      toast({ title: "Génération du rapport en cours..." });
      await generateInterventionPDF(
        intervention, 
        client, 
        undefined,
        intervention.profiles?.full_name || undefined,
        photos,
        [],
        { company: companySettings!, report: { primaryColor: documentSettings?.primaryColor || '#003057', accentColor: documentSettings?.accentColor || '#0050A0', footerText: documentSettings?.footerText || '' }, documents: documentSettings! },
        stepCompletions,
        workflowSteps,
        interventionTypes
      );
      toast({ title: "Rapport téléchargé" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!intervention) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Intervention non trouvée</p>
        <Button className="mt-4" onClick={() => navigate("/technician")}>
          Retour
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{intervention.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <TypeBadge type={intervention.intervention_type} />
            <StatusBadge status={status as any || intervention.status} />
          </div>
        </div>
      </div>

      {/* Read-only banner for team members */}
      {isTeamMember && (
        <div className="flex items-center gap-2 bg-muted/70 border rounded-lg p-3 text-sm text-muted-foreground">
          <Eye className="h-4 w-4" />
          <span>Consultation seule — seul le chef d'équipe peut modifier cette intervention</span>
        </div>
      )}

      {/* Schedule info */}
      {(intervention.scheduled_date || intervention.scheduled_time) && (
        <div className="flex items-center gap-4 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
          {intervention.scheduled_date && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>
                {format(new Date(intervention.scheduled_date), 'dd/MM/yyyy', { locale: fr })}
              </span>
            </div>
          )}
          {intervention.scheduled_time && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>RDV: {formatTimeRange(intervention.scheduled_time, intervention.estimated_duration)}</span>
            </div>
          )}
        </div>
      )}

      {/* Workflow Steps */}
      <InterventionWorkflow
        intervention={intervention}
        client={client}
        report={report}
        clientSignatureName={clientSignatureName}
        clientSignatureUrl={clientSignatureUrl}
        onEndIntervention={handleEndIntervention}
        onSave={handleSave}
        onSignatureComplete={handleSignatureComplete}
        onReportChange={(v) => setReport(v)}
        onClientSignatureNameChange={setClientSignatureName}
        onDownloadPDF={handleDownloadPDF}
        onStatusChange={handleStatusChange}
        onTimeUpdate={handleTimeUpdate}
        isUpdating={updateIntervention.isPending}
        readOnly={!!isTeamMember}
      />
    </div>
  );
};

export default TechnicianInterventionDetail;
