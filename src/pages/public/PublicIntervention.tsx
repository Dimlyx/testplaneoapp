import { useParams } from "react-router-dom";
import { usePublicIntervention } from "@/hooks/useInterventions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, TypeBadge } from "@/components/ui/status-badge";
import { 
  User, 
  Calendar, 
  Clock, 
  FileText, 
  CheckCircle,
  AlertTriangle,
  Wrench
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const PublicIntervention = () => {
  const { token } = useParams();
  const { data: intervention, isLoading, error } = usePublicIntervention(token || "");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !intervention) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Intervention non trouvée</h2>
            <p className="text-muted-foreground">
              Le lien que vous avez utilisé n'est pas valide ou l'intervention n'existe plus.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusConfig = {
    to_plan: { icon: AlertTriangle, color: "text-status-to-plan", message: "En attente de planification" },
    planned: { icon: Calendar, color: "text-status-planned", message: "Intervention planifiée" },
    in_progress: { icon: Wrench, color: "text-status-in-progress", message: "Intervention en cours" },
    completed: { icon: CheckCircle, color: "text-status-completed", message: "Intervention terminée" },
  };

  const currentStatus = statusConfig[intervention.status];
  const StatusIcon = currentStatus.icon;

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-primary text-primary-foreground py-6">
        <div className="container max-w-2xl mx-auto px-4">
          <div className="flex items-center gap-3 mb-2">
            <Wrench className="h-6 w-6" />
            <span className="font-semibold">SportEquip Services</span>
          </div>
          <h1 className="text-xl font-bold">Suivi d'intervention</h1>
        </div>
      </header>

      <main className="container max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Statut principal */}
        <Card className="border-2" style={{ borderColor: `hsl(var(--${intervention.status === 'completed' ? 'status-completed' : intervention.status === 'in_progress' ? 'status-in-progress' : intervention.status === 'planned' ? 'status-planned' : 'status-to-plan'}))` }}>
          <CardContent className="py-6 text-center">
            <StatusIcon className={`h-12 w-12 mx-auto mb-3 ${currentStatus.color}`} />
            <p className={`text-lg font-semibold ${currentStatus.color}`}>
              {currentStatus.message}
            </p>
            <div className="flex justify-center gap-2 mt-3">
              <StatusBadge status={intervention.status} />
              <TypeBadge type={intervention.intervention_type} />
            </div>
          </CardContent>
        </Card>

        {/* Détails intervention */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{intervention.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {intervention.description && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Description</p>
                <p>{intervention.description}</p>
              </div>
            )}

            {(intervention.scheduled_date || intervention.scheduled_time) && (
              <div className="flex gap-6">
                {intervention.scheduled_date && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{format(new Date(intervention.scheduled_date), 'dd MMMM yyyy', { locale: fr })}</span>
                  </div>
                )}
                {intervention.scheduled_time && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{intervention.scheduled_time}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Compte rendu */}
        {intervention.report && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Compte rendu
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{intervention.report}</p>
            </CardContent>
          </Card>
        )}

        {/* Info */}
        <Card className="bg-muted/50">
          <CardContent className="py-4 text-center text-sm text-muted-foreground">
            <p>Cette page est mise à jour en temps réel.</p>
            <p>Dernière mise à jour : {format(new Date(intervention.updated_at), 'dd/MM/yyyy à HH:mm', { locale: fr })}</p>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="bg-muted py-4 mt-8">
        <div className="container max-w-2xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} SportEquip Services</p>
        </div>
      </footer>
    </div>
  );
};

export default PublicIntervention;
