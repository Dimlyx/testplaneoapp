import { useInterventions } from "@/hooks/useInterventions";
import { useClients } from "@/hooks/useClients";
import { useEquipment } from "@/hooks/useEquipment";
import { useTechnicians } from "@/hooks/useTechnicians";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, TypeBadge } from "@/components/ui/status-badge";
import { 
  ClipboardList, 
  Users, 
  Wrench, 
  UserCheck, 
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Link } from "react-router-dom";

const Dashboard = () => {
  const { data: interventions = [], isLoading: loadingInterventions } = useInterventions();
  const { data: clients = [], isLoading: loadingClients } = useClients();
  const { data: equipment = [], isLoading: loadingEquipment } = useEquipment();
  const { data: technicians = [], isLoading: loadingTechnicians } = useTechnicians();

  const stats = {
    total: interventions.length,
    toPlan: interventions.filter(i => i.status === 'to_plan').length,
    planned: interventions.filter(i => i.status === 'planned').length,
    inProgress: interventions.filter(i => i.status === 'in_progress').length,
    completed: interventions.filter(i => i.status === 'completed').length,
  };

  const recentInterventions = interventions
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const urgentInterventions = interventions.filter(i => i.status === 'to_plan');

  if (loadingInterventions || loadingClients || loadingEquipment || loadingTechnicians) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Tableau de bord</h1>
        <p className="text-muted-foreground">Vue d'ensemble de l'activité</p>
      </div>

      {/* Statistiques principales */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Interventions</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.inProgress} en cours
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clients.length}</div>
            <p className="text-xs text-muted-foreground">
              Particuliers et professionnels
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Équipements</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{equipment.length}</div>
            <p className="text-xs text-muted-foreground">
              Équipements enregistrés
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Techniciens</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{technicians.length}</div>
            <p className="text-xs text-muted-foreground">
              Techniciens actifs
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Statuts des interventions */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-l-4 border-l-status-to-plan">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-status-to-plan" />
              À planifier
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-status-to-plan">{stats.toPlan}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-status-planned">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4 text-status-planned" />
              Planifiées
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-status-planned">{stats.planned}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-status-in-progress">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-status-in-progress" />
              En cours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-status-in-progress">{stats.inProgress}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-status-completed">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-status-completed" />
              Terminées
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-status-completed">{stats.completed}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Interventions récentes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Interventions récentes</span>
              <Link to="/admin/interventions" className="text-sm text-primary hover:underline">
                Voir tout
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentInterventions.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">Aucune intervention</p>
              ) : (
                recentInterventions.map((intervention) => (
                  <div key={intervention.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                    <div className="space-y-1">
                      <p className="font-medium">{intervention.title}</p>
                      <div className="flex items-center gap-2">
                        <TypeBadge type={intervention.intervention_type} />
                        <StatusBadge status={intervention.status} />
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(intervention.created_at), 'dd MMM', { locale: fr })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* À planifier */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-status-to-plan">
              <AlertTriangle className="h-5 w-5" />
              Interventions à planifier
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {urgentInterventions.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">Aucune intervention à planifier</p>
              ) : (
                urgentInterventions.slice(0, 5).map((intervention) => (
                  <div key={intervention.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                    <div className="space-y-1">
                      <p className="font-medium">{intervention.title}</p>
                      <TypeBadge type={intervention.intervention_type} />
                    </div>
                    <Link 
                      to={`/admin/interventions/${intervention.id}`}
                      className="text-sm text-primary hover:underline"
                    >
                      Planifier
                    </Link>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
