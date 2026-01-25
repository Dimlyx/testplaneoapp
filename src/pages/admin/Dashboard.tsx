import { useState, useMemo } from "react";
import { useInterventions } from "@/hooks/useInterventions";
import { useClients } from "@/hooks/useClients";
import { useTechnicians } from "@/hooks/useTechnicians";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, TypeBadge } from "@/components/ui/status-badge";
import { Input } from "@/components/ui/input";
import { 
  ClipboardList, 
  Users, 
  UserCheck, 
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  Receipt,
  Archive,
  Search,
  X
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type InterventionStatus = 'to_plan' | 'planned' | 'in_progress' | 'completed' | 'to_invoice' | 'archived';

const Dashboard = () => {
  const { data: interventions = [], isLoading: loadingInterventions } = useInterventions();
  const { data: clients = [], isLoading: loadingClients } = useClients();
  const { data: technicians = [], isLoading: loadingTechnicians } = useTechnicians();

  const [selectedStatus, setSelectedStatus] = useState<InterventionStatus | null>(null);
  const [clientSearch, setClientSearch] = useState("");

  const stats = {
    total: interventions.length,
    toPlan: interventions.filter(i => i.status === 'to_plan').length,
    planned: interventions.filter(i => i.status === 'planned').length,
    inProgress: interventions.filter(i => i.status === 'in_progress').length,
    completed: interventions.filter(i => i.status === 'completed').length,
    toInvoice: interventions.filter(i => i.status === 'to_invoice').length,
    archived: interventions.filter(i => i.status === 'archived').length,
  };

  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client?.name || "Client inconnu";
  };

  // Filter interventions based on selected status and client search
  const filteredInterventions = useMemo(() => {
    let filtered = interventions;

    if (selectedStatus) {
      filtered = filtered.filter(i => i.status === selectedStatus);
    }

    if (clientSearch.trim()) {
      const searchLower = clientSearch.toLowerCase();
      filtered = filtered.filter(i => {
        const clientName = getClientName(i.client_id).toLowerCase();
        return clientName.includes(searchLower) || i.title.toLowerCase().includes(searchLower);
      });
    }

    return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [interventions, selectedStatus, clientSearch, clients]);

  const recentInterventions = interventions
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const urgentInterventions = interventions.filter(i => i.status === 'to_plan');

  const handleStatusClick = (status: InterventionStatus) => {
    setSelectedStatus(prev => prev === status ? null : status);
  };

  const clearFilters = () => {
    setSelectedStatus(null);
    setClientSearch("");
  };

  const hasActiveFilters = selectedStatus !== null || clientSearch.trim() !== "";

  if (loadingInterventions || loadingClients || loadingTechnicians) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const statusCards = [
    { status: 'to_plan' as InterventionStatus, label: 'À planifier', count: stats.toPlan, icon: AlertTriangle, colorClass: 'amber' },
    { status: 'planned' as InterventionStatus, label: 'Planifiées', count: stats.planned, icon: Calendar, colorClass: 'blue' },
    { status: 'in_progress' as InterventionStatus, label: 'En cours', count: stats.inProgress, icon: Clock, colorClass: 'purple' },
    { status: 'completed' as InterventionStatus, label: 'Terminées', count: stats.completed, icon: CheckCircle, colorClass: 'green' },
    { status: 'to_invoice' as InterventionStatus, label: 'À facturer', count: stats.toInvoice, icon: Receipt, colorClass: 'orange' },
    { status: 'archived' as InterventionStatus, label: 'Archivées', count: stats.archived, icon: Archive, colorClass: 'gray' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Tableau de bord</h1>
        <p className="text-muted-foreground">Vue d'ensemble de l'activité</p>
      </div>

      {/* Statistiques principales */}
      <div className="grid gap-4 md:grid-cols-3">
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

      {/* Statuts des interventions - Cliquables */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Filtrer par statut</h2>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
              <X className="h-4 w-4 mr-1" />
              Effacer les filtres
            </Button>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          {statusCards.map(({ status, label, count, icon: Icon, colorClass }) => (
            <Card 
              key={status}
              className={cn(
                `border-l-4 cursor-pointer transition-all hover:shadow-md`,
                `border-l-${colorClass}-500`,
                selectedStatus === status && "ring-2 ring-primary ring-offset-2 bg-muted/50"
              )}
              onClick={() => handleStatusClick(status)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Icon className={`h-4 w-4 text-${colorClass}-500`} />
                  {label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold text-${colorClass}-600`}>{count}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Barre de recherche par client */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher par client ou titre d'intervention..."
          value={clientSearch}
          onChange={(e) => setClientSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Résultats filtrés */}
      {hasActiveFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>
                Résultats 
                {selectedStatus && (
                  <StatusBadge status={selectedStatus} className="ml-2" />
                )}
                {clientSearch && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    - Recherche: "{clientSearch}"
                  </span>
                )}
              </span>
              <span className="text-sm font-normal text-muted-foreground">
                {filteredInterventions.length} résultat{filteredInterventions.length > 1 ? 's' : ''}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {filteredInterventions.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">Aucune intervention trouvée</p>
              ) : (
                filteredInterventions.map((intervention) => (
                  <Link
                    key={intervention.id}
                    to={`/admin/interventions/${intervention.id}`}
                    className="flex items-center justify-between border-b pb-3 last:border-0 hover:bg-muted/50 -mx-2 px-2 py-2 rounded transition-colors"
                  >
                    <div className="space-y-1">
                      <p className="font-medium">{intervention.title}</p>
                      <p className="text-sm text-muted-foreground">{getClientName(intervention.client_id)}</p>
                      <div className="flex items-center gap-2">
                        <TypeBadge type={intervention.intervention_type} />
                        <StatusBadge status={intervention.status} />
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground text-right">
                      <div>{format(new Date(intervention.created_at), 'dd MMM yyyy', { locale: fr })}</div>
                      {intervention.scheduled_date && (
                        <div className="text-xs">
                          Prévu: {format(new Date(intervention.scheduled_date), 'dd/MM/yyyy', { locale: fr })}
                        </div>
                      )}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

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
                  <Link
                    key={intervention.id}
                    to={`/admin/interventions/${intervention.id}`}
                    className="flex items-center justify-between border-b pb-3 last:border-0 hover:bg-muted/50 -mx-2 px-2 py-1 rounded transition-colors block"
                  >
                    <div className="space-y-1">
                      <p className="font-medium">{intervention.title}</p>
                      <p className="text-sm text-muted-foreground">{getClientName(intervention.client_id)}</p>
                      <div className="flex items-center gap-2">
                        <TypeBadge type={intervention.intervention_type} />
                        <StatusBadge status={intervention.status} />
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(intervention.created_at), 'dd MMM', { locale: fr })}
                    </div>
                  </Link>
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
                      <p className="text-sm text-muted-foreground">{getClientName(intervention.client_id)}</p>
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
