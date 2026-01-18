import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useIntervention, useUpdateIntervention } from "@/hooks/useInterventions";
import { useClient } from "@/hooks/useClients";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge, TypeBadge } from "@/components/ui/status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  ArrowLeft, 
  User, 
  Calendar, 
  Clock, 
  MapPin, 
  Phone, 
  Mail,
  FileText,
  Save,
  Wrench
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { generateInterventionPDF } from "@/lib/pdf-generator";

const TechnicianInterventionDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { data: intervention, isLoading } = useIntervention(id || "");
  const { data: client } = useClient(intervention?.client_id || "");
  const updateIntervention = useUpdateIntervention();

  const [status, setStatus] = useState<string>("");
  const [report, setReport] = useState<string>("");
  const [technicalComments, setTechnicalComments] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);

  // Initialize form when data loads
  useState(() => {
    if (intervention) {
      setStatus(intervention.status);
      setReport(intervention.report || "");
      setTechnicalComments(intervention.technical_comments || "");
    }
  });

  const handleSave = async () => {
    if (!id) return;
    try {
      await updateIntervention.mutateAsync({
        id,
        status: status as any,
        report,
        technical_comments: technicalComments,
      });
      toast({ title: "Intervention mise à jour" });
      setIsEditing(false);
    } catch (error) {
      toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
    }
  };

  const handleDownloadPDF = () => {
    if (intervention && client) {
      generateInterventionPDF(intervention, client);
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

  const currentStatus = status || intervention.status;
  const currentReport = isEditing ? report : (intervention.report || "");
  const currentComments = isEditing ? technicalComments : (intervention.technical_comments || "");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{intervention.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <TypeBadge type={intervention.intervention_type} />
            <StatusBadge status={currentStatus as any} />
          </div>
        </div>
      </div>

      {/* Planification */}
      <Card>
        <CardContent className="p-4 space-y-3">
          {intervention.scheduled_date && (
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>
                {format(new Date(intervention.scheduled_date), 'EEEE dd MMMM yyyy', { locale: fr })}
              </span>
            </div>
          )}
          {intervention.scheduled_time && (
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{intervention.scheduled_time}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Client */}
      {client && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              Client
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="font-medium">{client.name}</p>
            {client.address && (
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{client.address}, {client.postal_code} {client.city}</span>
              </div>
            )}
            {client.phone && (
              <a href={`tel:${client.phone}`} className="flex items-center gap-2 text-sm text-primary">
                <Phone className="h-4 w-4" />
                {client.phone}
              </a>
            )}
            {client.email && (
              <a href={`mailto:${client.email}`} className="flex items-center gap-2 text-sm text-primary">
                <Mail className="h-4 w-4" />
                {client.email}
              </a>
            )}
          </CardContent>
        </Card>
      )}

      {/* Description */}
      {intervention.description && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{intervention.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Mise à jour
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Statut</label>
            <Select 
              value={currentStatus} 
              onValueChange={(value) => {
                setStatus(value);
                setIsEditing(true);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="to_plan">À planifier</SelectItem>
                <SelectItem value="planned">Planifiée</SelectItem>
                <SelectItem value="in_progress">En cours</SelectItem>
                <SelectItem value="completed">Terminée</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Compte rendu</label>
            <Textarea
              placeholder="Décrivez l'intervention réalisée..."
              value={isEditing ? report : (intervention.report || "")}
              onChange={(e) => {
                setReport(e.target.value);
                setIsEditing(true);
              }}
              className="min-h-[100px]"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Commentaires techniques</label>
            <Textarea
              placeholder="Notes techniques internes..."
              value={isEditing ? technicalComments : (intervention.technical_comments || "")}
              onChange={(e) => {
                setTechnicalComments(e.target.value);
                setIsEditing(true);
              }}
              className="min-h-[80px]"
            />
          </div>

          {isEditing && (
            <Button 
              onClick={handleSave} 
              className="w-full"
              disabled={updateIntervention.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              Enregistrer
            </Button>
          )}
        </CardContent>
      </Card>

      {/* PDF */}
      <Button variant="outline" className="w-full" onClick={handleDownloadPDF}>
        <FileText className="h-4 w-4 mr-2" />
        Télécharger le rapport
      </Button>
    </div>
  );
};

export default TechnicianInterventionDetail;
