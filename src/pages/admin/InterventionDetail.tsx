import { useNavigate, useParams, Link } from "react-router-dom";
import { useIntervention } from "@/hooks/useInterventions";
import { useClient } from "@/hooks/useClients";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, TypeBadge } from "@/components/ui/status-badge";
import { 
  ArrowLeft, 
  Edit, 
  FileText, 
  User, 
  Wrench, 
  Calendar,
  Clock,
  ExternalLink,
  Copy
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { generateInterventionPDF } from "@/lib/pdf-generator";

const InterventionDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { data: intervention, isLoading } = useIntervention(id || "");
  const { data: client } = useClient(intervention?.client_id || "");

  const handleCopyLink = () => {
    if (intervention?.public_token) {
      const publicUrl = `${window.location.origin}/intervention/${intervention.public_token}`;
      navigator.clipboard.writeText(publicUrl);
      toast({ title: "Lien copié dans le presse-papiers" });
    }
  };

  const handleDownloadPDF = () => {
    if (intervention && client) {
      generateInterventionPDF(
        intervention, 
        client, 
        intervention.equipment as any,
        intervention.profiles?.full_name || undefined
      );
      toast({ title: "PDF généré avec succès" });
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
        <Button className="mt-4" onClick={() => navigate("/admin/interventions")}>
          Retour à la liste
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">{intervention.title}</h1>
            <div className="flex items-center gap-2 mt-2">
              <TypeBadge type={intervention.intervention_type} />
              <StatusBadge status={intervention.status} />
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownloadPDF}>
            <FileText className="h-4 w-4 mr-2" />
            Télécharger PDF
          </Button>
          <Button onClick={() => navigate(`/admin/interventions/${id}/edit`)}>
            <Edit className="h-4 w-4 mr-2" />
            Modifier
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Informations client */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Client
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {client ? (
              <>
                <div>
                  <p className="text-sm text-muted-foreground">Nom</p>
                  <p className="font-medium">{client.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <p className="font-medium">
                    {client.client_type === 'individual' ? 'Particulier' : 'Professionnel'}
                  </p>
                </div>
                {client.email && (
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{client.email}</p>
                  </div>
                )}
                {client.phone && (
                  <div>
                    <p className="text-sm text-muted-foreground">Téléphone</p>
                    <p className="font-medium">{client.phone}</p>
                  </div>
                )}
                {client.address && (
                  <div>
                    <p className="text-sm text-muted-foreground">Adresse</p>
                    <p className="font-medium">
                      {client.address}
                      {client.postal_code && `, ${client.postal_code}`}
                      {client.city && ` ${client.city}`}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">Client non trouvé</p>
            )}
          </CardContent>
        </Card>

        {/* Planification */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Planification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Date prévue</p>
              <p className="font-medium">
                {intervention.scheduled_date 
                  ? format(new Date(intervention.scheduled_date), 'EEEE dd MMMM yyyy', { locale: fr })
                  : "Non planifiée"}
              </p>
            </div>
            {intervention.scheduled_time && (
              <div>
                <p className="text-sm text-muted-foreground">Heure prévue</p>
                <p className="font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {intervention.scheduled_time}
                </p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Technicien assigné</p>
              <p className="font-medium">
                {intervention.technician_id ? "Assigné" : "Non assigné"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Description */}
        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              {intervention.description || "Aucune description"}
            </p>
          </CardContent>
        </Card>

        {/* Lien public */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5" />
              Lien client (extranet)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {intervention.public_token ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Partagez ce lien avec le client pour qu'il puisse suivre l'intervention
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopyLink}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copier le lien
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => window.open(`/intervention/${intervention.public_token}`, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Ouvrir
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">Lien non disponible</p>
            )}
          </CardContent>
        </Card>

        {/* Rapport */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Compte rendu d'intervention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">
              {intervention.report || "Aucun compte rendu pour le moment"}
            </p>
          </CardContent>
        </Card>

        {/* Commentaires techniques */}
        {intervention.technical_comments && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Commentaires techniques
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{intervention.technical_comments}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default InterventionDetail;
