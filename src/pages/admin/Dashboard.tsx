import { useState, useMemo, useEffect, lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useInterventions } from "@/hooks/useInterventions";
import { useClients } from "@/hooks/useClients";
import { useTechnicians } from "@/hooks/useTechnicians";
import { usePendingAlerts } from "@/hooks/useMaintenanceAlerts";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { useCustomStatuses } from "@/hooks/useCustomStatuses";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  X,
  Bell,
  Wrench,
  Building2,
  Settings2,
  MapPin,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { AnnouncementBanner } from "@/components/admin/AnnouncementBanner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import InterventionsMap from "@/components/admin/InterventionsMap";

type InterventionStatus = 'to_plan' | 'planned' | 'in_progress' | 'completed' | 'to_invoice' | 'archived';

interface DashboardVisibility {
  statsCards: boolean;
  statusFilters: boolean;
  searchBar: boolean;
  recentInterventions: boolean;
  toPlanList: boolean;
  maintenanceAlerts: boolean;
  companyInfo: boolean;
  interventionsMap: boolean;
}

const DEFAULT_VISIBILITY: DashboardVisibility = {
  statsCards: true,
  statusFilters: true,
  searchBar: true,
  recentInterventions: true,
  toPlanList: true,
  maintenanceAlerts: true,
  companyInfo: true,
  interventionsMap: true,
};

const STORAGE_KEY = 'planeo-dashboard-visibility';

const visibilityLabels: Record<keyof DashboardVisibility, { label: string; icon: any }> = {
  companyInfo: { label: "Entreprise", icon: Building2 },
  statsCards: { label: "Statistiques (Interventions, Clients, Techniciens)", icon: ClipboardList },
  maintenanceAlerts: { label: "Alertes de maintenance", icon: Bell },
  statusFilters: { label: "Filtres par statut", icon: Calendar },
  searchBar: { label: "Barre de recherche", icon: Search },
  recentInterventions: { label: "Interventions récentes", icon: Clock },
  interventionsMap: { label: "Carte des interventions", icon: MapPin },
  toPlanList: { label: "Interventions à planifier", icon: AlertTriangle },
};

const Dashboard = () => {
  const { data: interventions = [], isLoading: loadingInterventions } = useInterventions();
  const { data: clients = [], isLoading: loadingClients } = useClients();
  const { data: technicians = [], isLoading: loadingTechnicians } = useTechnicians();
  const { data: overdueAlerts = [] } = usePendingAlerts();
  const { data: organizationId } = useUserOrganization();
  const { data: customStatuses = [] } = useCustomStatuses();

  const { data: organization } = useQuery({
    queryKey: ['organization', organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      const { data, error } = await supabase
        .from('organizations')
        .select('name, logo_url')
        .eq('id', organizationId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });

  const [visibility, setVisibility] = useState<DashboardVisibility>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return { ...DEFAULT_VISIBILITY, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_VISIBILITY;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(visibility));
  }, [visibility]);

  const toggleVisibility = (key: keyof DashboardVisibility) => {
    setVisibility(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const [selectedStatus, setSelectedStatus] = useState<InterventionStatus | null>(null);
  const [selectedCustomStatus, setSelectedCustomStatus] = useState<string | null>(null);
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

  const filteredInterventions = useMemo(() => {
    let filtered = interventions;
    if (selectedStatus) {
      filtered = filtered.filter(i => i.status === selectedStatus);
    }
    if (selectedCustomStatus) {
      filtered = filtered.filter(i => i.custom_status_id === selectedCustomStatus);
    }
    if (clientSearch.trim()) {
      const searchLower = clientSearch.toLowerCase();
      filtered = filtered.filter(i => {
        const clientName = getClientName(i.client_id).toLowerCase();
        return clientName.includes(searchLower) || i.title.toLowerCase().includes(searchLower);
      });
    }
    return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [interventions, selectedStatus, selectedCustomStatus, clientSearch, clients]);

  const recentInterventions = interventions
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const urgentInterventions = interventions.filter(i => i.status === 'to_plan');

  const handleStatusClick = (status: InterventionStatus) => {
    if (selectedStatus === status) {
      setSelectedStatus(null);
    } else {
      setSelectedStatus(status);
      setSelectedCustomStatus(null);
    }
  };

  const handleCustomStatusClick = (customStatusId: string) => {
    if (selectedCustomStatus === customStatusId) {
      setSelectedCustomStatus(null);
    } else {
      setSelectedCustomStatus(customStatusId);
      setSelectedStatus(null);
    }
  };

  const clearFilters = () => {
    setSelectedStatus(null);
    setSelectedCustomStatus(null);
    setClientSearch("");
  };

  const hasActiveFilters = selectedStatus !== null || selectedCustomStatus !== null || clientSearch.trim() !== "";

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

  const activeCount = Object.values(visibility).filter(v => v).length;
  const totalCount = Object.keys(visibility).length;

  return (
    <div className="space-y-6">
      <AnnouncementBanner />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Tableau de bord</h1>
          <p className="text-muted-foreground">Vue d'ensemble de l'activité</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Visibility settings popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className="relative">
                <Settings2 className="h-4 w-4" />
                {activeCount < totalCount && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
                    {activeCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm">Personnaliser l'affichage</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => setVisibility(DEFAULT_VISIBILITY)}
                  >
                    Réinitialiser
                  </Button>
                </div>
                <div className="space-y-3">
                  {(Object.entries(visibilityLabels) as [keyof DashboardVisibility, { label: string; icon: any }][]).map(([key, { label, icon: Icon }]) => (
                    <div key={key} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <Label htmlFor={`vis-${key}`} className="text-sm cursor-pointer truncate">
                          {label}
                        </Label>
                      </div>
                      <Switch
                        id={`vis-${key}`}
                        checked={visibility[key]}
                        onCheckedChange={() => toggleVisibility(key)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {visibility.companyInfo && organization && (
            <div className="flex items-center gap-3 bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl px-4 py-3 border border-primary/20">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                {organization.logo_url ? (
                  <img src={organization.logo_url} alt={organization.name} className="w-8 h-8 rounded object-cover" />
                ) : (
                  <Building2 className="h-5 w-5 text-primary" />
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Entreprise</p>
                <p className="font-semibold text-foreground">{organization.name}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Alertes de maintenance en retard */}
      {visibility.maintenanceAlerts && overdueAlerts.length > 0 && (
        <Card className="border-red-500 border-2 bg-red-50 dark:bg-red-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <Bell className="h-5 w-5 animate-pulse" />
                Maintenances en retard
                <Badge variant="destructive" className="ml-2">
                  {overdueAlerts.length}
                </Badge>
              </span>
              <Link to="/admin/maintenance-alerts" className="text-sm text-primary hover:underline font-normal">
                Voir tout
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-48 overflow-y-auto">
              {overdueAlerts.slice(0, 5).map((alert) => {
                const daysOverdue = differenceInDays(new Date(), new Date(alert.alert_date));
                return (
                  <Link
                    key={alert.id}
                    to="/admin/maintenance-alerts"
                    className="flex items-center justify-between p-3 bg-background rounded-lg border border-red-200 dark:border-red-900 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/50">
                        <Wrench className="h-4 w-4 text-red-600 dark:text-red-400" />
                      </div>
                      <div>
                        <p className="font-medium">{alert.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {alert.clients?.name || "Client non spécifié"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="destructive" className="text-xs">
                        {daysOverdue === 0 ? "Aujourd'hui" : `${daysOverdue} jour${daysOverdue > 1 ? 's' : ''} de retard`}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        Prévu le {format(new Date(alert.alert_date), 'dd/MM/yyyy', { locale: fr })}
                      </p>
                    </div>
                  </Link>
                );
              })}
              {overdueAlerts.length > 5 && (
                <p className="text-sm text-center text-muted-foreground pt-2">
                  Et {overdueAlerts.length - 5} autre(s) alerte(s)...
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistiques principales */}
      {visibility.statsCards && (
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
      )}

      {/* Statuts des interventions - Cliquables */}
      {visibility.statusFilters && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Filtrer par statut</h2>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            {statusCards.map(({ status, label, count, icon: Icon, colorClass }) => {
              const isSelected = selectedStatus === status;
              return (
                <Card
                  key={status}
                  className={cn(
                    "cursor-pointer transition-all hover:shadow-md",
                    isSelected && "ring-2 ring-primary ring-offset-2"
                  )}
                  onClick={() => handleStatusClick(status)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className={cn(
                        "p-2 rounded-lg",
                        colorClass === 'amber' && "bg-amber-100 text-amber-600",
                        colorClass === 'blue' && "bg-blue-100 text-blue-600",
                        colorClass === 'purple' && "bg-purple-100 text-purple-600",
                        colorClass === 'green' && "bg-green-100 text-green-600",
                        colorClass === 'orange' && "bg-orange-100 text-orange-600",
                        colorClass === 'gray' && "bg-gray-100 text-gray-600",
                      )}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-2xl font-bold">{count}</span>
                    </div>
                    <p className="text-sm font-medium mt-2">{label}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Cartes des statuts personnalisés */}
          {customStatuses.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Statuts personnalisés</h3>
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
                {customStatuses.map((cs) => {
                  const count = interventions.filter(i => i.custom_status_id === cs.id).length;
                  const isSelected = selectedCustomStatus === cs.id;
                  return (
                    <Card
                      key={cs.id}
                      className={cn(
                        "cursor-pointer transition-all hover:shadow-md",
                        isSelected && "ring-2 ring-primary ring-offset-2"
                      )}
                      style={{ borderLeft: `4px solid ${cs.color}` }}
                      onClick={() => handleCustomStatusClick(cs.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div
                            className="p-2 rounded-lg"
                            style={{ backgroundColor: `${cs.color}20`, color: cs.color }}
                          >
                            <Clock className="h-4 w-4" />
                          </div>
                          <span className="text-2xl font-bold">{count}</span>
                        </div>
                        <p className="text-sm font-medium mt-2">{cs.label}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recherche et résultats */}
      {visibility.searchBar && (
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher une intervention ou un client..."
              className="pl-9"
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
            />
            {clientSearch && (
              <button
                onClick={() => setClientSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
          {hasActiveFilters && (
            <div className="flex items-center gap-2">
              {(selectedStatus || selectedCustomStatus) && (
                <Badge variant="secondary" className="gap-1">
                  Filtre actif
                  <button onClick={() => { setSelectedStatus(null); setSelectedCustomStatus(null); }}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Réinitialiser
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Interventions filtrées */}
      {hasActiveFilters && visibility.searchBar && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Résultats ({filteredInterventions.length} intervention{filteredInterventions.length > 1 ? 's' : ''})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredInterventions.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Aucune intervention ne correspond aux critères sélectionnés.
              </p>
            ) : (
              <div className="space-y-3">
                {filteredInterventions.map((intervention) => (
                  <Link
                    key={intervention.id}
                    to={`/admin/interventions/${intervention.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <p className="font-medium">{intervention.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {getClientName(intervention.client_id)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge 
                        status={intervention.status} 
                        customStatusId={intervention.custom_status_id}
                      />
                      <span className="text-xs text-muted-foreground">
                        {intervention.intervention_type}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Interventions récentes */}
      {visibility.recentInterventions && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Interventions récentes</CardTitle>
            <Link 
              to="/admin/interventions" 
              className="text-sm text-primary hover:underline"
            >
              Voir tout
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentInterventions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Aucune intervention pour le moment.
                </p>
              ) : (
                recentInterventions.map((intervention) => (
                  <Link
                    key={intervention.id}
                    to={`/admin/interventions/${intervention.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <p className="font-medium">{intervention.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {getClientName(intervention.client_id)} • {format(new Date(intervention.created_at), 'dd/MM/yyyy', { locale: fr })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge 
                        status={intervention.status} 
                        customStatusId={intervention.custom_status_id}
                      />
                      <span className="text-xs text-muted-foreground">
                        {intervention.intervention_type}
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Interventions à planifier (urgentes) */}
      {visibility.toPlanList && urgentInterventions.length > 0 && (
        <Card className="border-amber-500 border-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Interventions à planifier
              <Badge variant="secondary">{urgentInterventions.length}</Badge>
            </CardTitle>
            <Link 
              to="/admin/interventions"
              className="text-sm text-primary hover:underline"
            >
              Voir tout
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {urgentInterventions.slice(0, 5).map((intervention) => (
                <Link
                  key={intervention.id}
                  to={`/admin/interventions/${intervention.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <p className="font-medium">{intervention.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {getClientName(intervention.client_id)}
                    </p>
                  </div>
                  <StatusBadge 
                    status={intervention.status} 
                    customStatusId={intervention.custom_status_id}
                  />
                </Link>
              ))}
              {urgentInterventions.length > 5 && (
                <p className="text-sm text-center text-muted-foreground pt-2">
                  Et {urgentInterventions.length - 5} autre(s) intervention(s)...
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Carte des interventions */}
      {visibility.interventionsMap && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Carte des interventions</CardTitle>
            <Link 
              to="/admin/calendar" 
              className="text-sm text-primary hover:underline"
            >
              Voir le planning
            </Link>
          </CardHeader>
          <CardContent>
            <div className="h-[400px] rounded-lg overflow-hidden border">
              <InterventionsMap 
                interventions={interventions} 
                clients={clients.map(c => ({ id: c.id, name: c.name }))}
                technicians={technicians.map(t => ({ 
                  id: t.id, 
                  full_name: t.full_name, 
                  email: t.email 
                }))}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;
