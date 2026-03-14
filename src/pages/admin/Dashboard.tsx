import { useState, useMemo, useEffect, useCallback, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
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
  ClipboardList, Users, UserCheck, Calendar,
  AlertTriangle, CheckCircle, Clock, Receipt, Archive,
  Search, X, Bell, Wrench, Building2, Settings2, MapPin,
  Settings, Eye, EyeOff, Move,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { AnnouncementBanner } from "@/components/admin/AnnouncementBanner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import InterventionsMap from "@/components/admin/InterventionsMap";
import { DashboardSortableSection } from "@/components/admin/DashboardSortableSection";

type InterventionStatus = 'to_plan' | 'planned' | 'in_progress' | 'completed' | 'to_invoice' | 'archived';

type SectionKey = 'maintenanceAlerts' | 'statsCards' | 'statusFilters' | 'searchBar' | 'recentInterventions' | 'toPlanList' | 'interventionsMap';

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
const STATUS_VISIBILITY_KEY = 'planeo-dashboard-visible-statuses';
const SECTION_ORDER_KEY = 'planeo-dashboard-section-order';
const COLLAPSED_SECTIONS_KEY = 'planeo-dashboard-collapsed-sections';
const SECTION_SIZES_KEY = 'planeo-dashboard-section-sizes';

const DEFAULT_VISIBLE_STATUSES = ['to_plan', 'planned', 'in_progress', 'completed', 'to_invoice'];

const DEFAULT_SECTION_ORDER: SectionKey[] = [
  'maintenanceAlerts',
  'statsCards',
  'statusFilters',
  'searchBar',
  'recentInterventions',
  'toPlanList',
  'interventionsMap',
];

const SECTION_LABELS: Record<SectionKey, string> = {
  maintenanceAlerts: "Alertes de maintenance",
  statsCards: "Statistiques",
  statusFilters: "Filtres par statut",
  searchBar: "Recherche",
  recentInterventions: "Interventions récentes",
  toPlanList: "À planifier",
  interventionsMap: "Carte des interventions",
};

const visibilityLabels: Record<keyof DashboardVisibility, { label: string; icon: any }> = {
  companyInfo: { label: "Entreprise", icon: Building2 },
  statsCards: { label: "Statistiques", icon: ClipboardList },
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

  // --- Visibility ---
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

  // --- Section order ---
  const [sectionOrder, setSectionOrder] = useState<SectionKey[]>(() => {
    try {
      const saved = localStorage.getItem(SECTION_ORDER_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as SectionKey[];
        // Ensure all default sections are present
        const merged = [...parsed];
        for (const key of DEFAULT_SECTION_ORDER) {
          if (!merged.includes(key)) merged.push(key);
        }
        return merged.filter(k => DEFAULT_SECTION_ORDER.includes(k));
      }
    } catch {}
    return DEFAULT_SECTION_ORDER;
  });

  useEffect(() => {
    localStorage.setItem(SECTION_ORDER_KEY, JSON.stringify(sectionOrder));
  }, [sectionOrder]);

  const [isDragMode, setIsDragMode] = useState(false);

  // --- Status filters ---
  const [selectedStatus, setSelectedStatus] = useState<InterventionStatus | null>(null);
  const [selectedCustomStatus, setSelectedCustomStatus] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState("");

  // --- Collapsed sections ---
  const [collapsedSections, setCollapsedSections] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(COLLAPSED_SECTIONS_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  useEffect(() => {
    localStorage.setItem(COLLAPSED_SECTIONS_KEY, JSON.stringify(collapsedSections));
  }, [collapsedSections]);

  const toggleCollapse = (key: string) => {
    setCollapsedSections(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const [visibleStatuses, setVisibleStatuses] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STATUS_VISIBILITY_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_VISIBLE_STATUSES;
  });

  useEffect(() => {
    localStorage.setItem(STATUS_VISIBILITY_KEY, JSON.stringify(visibleStatuses));
  }, [visibleStatuses]);

  const toggleStatusVisibility = (key: string) => {
    setVisibleStatuses(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  // --- Computed ---
  const stats = {
    total: interventions.length,
    toPlan: interventions.filter(i => i.status === 'to_plan').length,
    planned: interventions.filter(i => i.status === 'planned').length,
    inProgress: interventions.filter(i => i.status === 'in_progress').length,
    completed: interventions.filter(i => i.status === 'completed').length,
    toInvoice: interventions.filter(i => i.status === 'to_invoice').length,
    archived: interventions.filter(i => i.status === 'archived').length,
  };

  const getClientName = useCallback((clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client?.name || "Client inconnu";
  }, [clients]);

  const filteredInterventions = useMemo(() => {
    let filtered = interventions;
    if (selectedStatus) filtered = filtered.filter(i => i.status === selectedStatus);
    if (selectedCustomStatus) filtered = filtered.filter(i => i.custom_status_id === selectedCustomStatus);
    if (clientSearch.trim()) {
      const searchLower = clientSearch.toLowerCase();
      filtered = filtered.filter(i => {
        const clientName = getClientName(i.client_id).toLowerCase();
        return clientName.includes(searchLower) || i.title.toLowerCase().includes(searchLower);
      });
    }
    return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [interventions, selectedStatus, selectedCustomStatus, clientSearch, getClientName]);

  const recentInterventions = useMemo(() =>
    [...interventions].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5),
    [interventions]
  );

  const urgentInterventions = useMemo(() =>
    interventions.filter(i => i.status === 'to_plan'),
    [interventions]
  );

  const handleStatusClick = (status: InterventionStatus) => {
    setSelectedStatus(prev => prev === status ? null : status);
    setSelectedCustomStatus(null);
  };

  const handleCustomStatusClick = (customStatusId: string) => {
    setSelectedCustomStatus(prev => prev === customStatusId ? null : customStatusId);
    setSelectedStatus(null);
  };

  const clearFilters = () => {
    setSelectedStatus(null);
    setSelectedCustomStatus(null);
    setClientSearch("");
  };

  const hasActiveFilters = selectedStatus !== null || selectedCustomStatus !== null || clientSearch.trim() !== "";

  // --- DnD ---
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSectionOrder(prev => {
        const oldIndex = prev.indexOf(active.id as SectionKey);
        const newIndex = prev.indexOf(over.id as SectionKey);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  // --- Loading ---
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

  // --- Section renderers ---
  const sectionRenderers: Record<SectionKey, () => ReactNode> = {
    maintenanceAlerts: () => {
      if (!visibility.maintenanceAlerts || overdueAlerts.length === 0) return null;
      return (
        <Card className="border-red-500 border-2 bg-red-50 dark:bg-red-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <Bell className="h-5 w-5 animate-pulse" />
                Maintenances en retard
                <Badge variant="destructive" className="ml-2">{overdueAlerts.length}</Badge>
              </span>
              <Link to="/admin/maintenance-alerts" className="text-sm text-primary hover:underline font-normal">Voir tout</Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-48 overflow-y-auto">
              {overdueAlerts.slice(0, 5).map((alert) => {
                const daysOverdue = differenceInDays(new Date(), new Date(alert.alert_date));
                return (
                  <Link key={alert.id} to="/admin/maintenance-alerts" className="flex items-center justify-between p-3 bg-background rounded-lg border border-red-200 dark:border-red-900 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/50">
                        <Wrench className="h-4 w-4 text-red-600 dark:text-red-400" />
                      </div>
                      <div>
                        <p className="font-medium">{alert.title}</p>
                        <p className="text-sm text-muted-foreground">{alert.clients?.name || "Client non spécifié"}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="destructive" className="text-xs">
                        {daysOverdue === 0 ? "Aujourd'hui" : `${daysOverdue} jour${daysOverdue > 1 ? 's' : ''} de retard`}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">Prévu le {format(new Date(alert.alert_date), 'dd/MM/yyyy', { locale: fr })}</p>
                    </div>
                  </Link>
                );
              })}
              {overdueAlerts.length > 5 && (
                <p className="text-sm text-center text-muted-foreground pt-2">Et {overdueAlerts.length - 5} autre(s) alerte(s)...</p>
              )}
            </div>
          </CardContent>
        </Card>
      );
    },

    statsCards: () => {
      if (!visibility.statsCards) return null;
      return (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Interventions</CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">{stats.inProgress} en cours</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clients</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{clients.length}</div>
              <p className="text-xs text-muted-foreground">Particuliers et professionnels</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Techniciens</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{technicians.length}</div>
              <p className="text-xs text-muted-foreground">Techniciens actifs</p>
            </CardContent>
          </Card>
        </div>
      );
    },

    statusFilters: () => {
      if (!visibility.statusFilters) return null;
      return (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Filtrer par statut</h2>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8">
                  <Settings className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-0">
                <div className="p-3 border-b">
                  <p className="text-sm font-semibold">Statuts visibles</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Choisissez les statuts affichés</p>
                </div>
                <div className="p-2 space-y-0.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 pt-1 pb-1.5 font-medium">Statuts de base</p>
                  {statusCards.map(({ status, label, icon: Icon }) => (
                    <button key={status} onClick={() => toggleStatusVisibility(status)} className="flex items-center gap-2.5 w-full px-2 py-1.5 rounded-md text-sm transition-colors hover:bg-muted">
                      {visibleStatuses.includes(status) ? <Eye className="h-3.5 w-3.5 text-primary shrink-0" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className={cn(!visibleStatuses.includes(status) && "text-muted-foreground")}>{label}</span>
                    </button>
                  ))}
                  {customStatuses.length > 0 && (
                    <>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 pt-2 pb-1.5 font-medium">Personnalisés</p>
                      {customStatuses.map((cs) => (
                        <button key={cs.id} onClick={() => toggleStatusVisibility(cs.id)} className="flex items-center gap-2.5 w-full px-2 py-1.5 rounded-md text-sm transition-colors hover:bg-muted">
                          {visibleStatuses.includes(cs.id) ? <Eye className="h-3.5 w-3.5 text-primary shrink-0" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cs.color }} />
                          <span className={cn(!visibleStatuses.includes(cs.id) && "text-muted-foreground")}>{cs.label}</span>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            {statusCards.filter(({ status }) => visibleStatuses.includes(status)).map(({ status, label, count, icon: Icon, colorClass }) => {
              const isSelected = selectedStatus === status;
              return (
                <Card key={status} className={cn("cursor-pointer transition-all hover:shadow-md", isSelected && "ring-2 ring-primary ring-offset-2")} onClick={() => handleStatusClick(status)}>
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
            {customStatuses.filter((cs) => visibleStatuses.includes(cs.id)).map((cs) => {
              const count = interventions.filter(i => i.custom_status_id === cs.id).length;
              const isSelected = selectedCustomStatus === cs.id;
              return (
                <Card key={cs.id} className={cn("cursor-pointer transition-all hover:shadow-md", isSelected && "ring-2 ring-primary ring-offset-2")} style={{ borderLeft: `4px solid ${cs.color}` }} onClick={() => handleCustomStatusClick(cs.id)}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="p-2 rounded-lg" style={{ backgroundColor: `${cs.color}20`, color: cs.color }}>
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
      );
    },

    searchBar: () => {
      if (!visibility.searchBar) return null;
      return (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher une intervention ou un client..." className="pl-9" value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} />
              {clientSearch && (
                <button onClick={() => setClientSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
            {hasActiveFilters && (
              <div className="flex items-center gap-2">
                {(selectedStatus || selectedCustomStatus) && (
                  <Badge variant="secondary" className="gap-1">
                    Filtre actif
                    <button onClick={() => { setSelectedStatus(null); setSelectedCustomStatus(null); }}><X className="h-3 w-3" /></button>
                  </Badge>
                )}
                <Button variant="ghost" size="sm" onClick={clearFilters}>Réinitialiser</Button>
              </div>
            )}
          </div>
          {hasActiveFilters && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Résultats ({filteredInterventions.length} intervention{filteredInterventions.length > 1 ? 's' : ''})</CardTitle>
              </CardHeader>
              <CardContent>
                {filteredInterventions.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Aucune intervention ne correspond aux critères sélectionnés.</p>
                ) : (
                  <div className="space-y-3">
                    {filteredInterventions.map((intervention) => (
                      <Link key={intervention.id} to={`/admin/interventions/${intervention.id}`} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                        <div>
                          <p className="font-medium">{intervention.title}</p>
                          <p className="text-sm text-muted-foreground">{getClientName(intervention.client_id)}</p>
                        </div>
                        <StatusBadge status={intervention.status} customStatusId={intervention.custom_status_id} />
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      );
    },

    recentInterventions: () => {
      if (!visibility.recentInterventions) return null;
      return (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Interventions récentes</CardTitle>
            <Link to="/admin/interventions" className="text-sm text-primary hover:underline">Voir tout</Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentInterventions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Aucune intervention pour le moment.</p>
              ) : (
                recentInterventions.map((intervention) => (
                  <Link key={intervention.id} to={`/admin/interventions/${intervention.id}`} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                    <div>
                      <p className="font-medium">{intervention.title}</p>
                      <p className="text-sm text-muted-foreground">{getClientName(intervention.client_id)} • {format(new Date(intervention.created_at), 'dd/MM/yyyy', { locale: fr })}</p>
                    </div>
                    <StatusBadge status={intervention.status} customStatusId={intervention.custom_status_id} />
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      );
    },

    toPlanList: () => {
      if (!visibility.toPlanList || urgentInterventions.length === 0) return null;
      return (
        <Card className="border-amber-500 border-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Interventions à planifier
              <Badge variant="secondary">{urgentInterventions.length}</Badge>
            </CardTitle>
            <Link to="/admin/interventions" className="text-sm text-primary hover:underline">Voir tout</Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {urgentInterventions.slice(0, 5).map((intervention) => (
                <Link key={intervention.id} to={`/admin/interventions/${intervention.id}`} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <div>
                    <p className="font-medium">{intervention.title}</p>
                    <p className="text-sm text-muted-foreground">{getClientName(intervention.client_id)}</p>
                  </div>
                  <StatusBadge status={intervention.status} customStatusId={intervention.custom_status_id} />
                </Link>
              ))}
              {urgentInterventions.length > 5 && (
                <p className="text-sm text-center text-muted-foreground pt-2">Et {urgentInterventions.length - 5} autre(s) intervention(s)...</p>
              )}
            </div>
          </CardContent>
        </Card>
      );
    },

    interventionsMap: () => {
      if (!visibility.interventionsMap) return null;
      return (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Carte des interventions</CardTitle>
            <Link to="/admin/calendar" className="text-sm text-primary hover:underline">Voir le planning</Link>
          </CardHeader>
          <CardContent>
            <div className="h-[400px] rounded-lg overflow-hidden border">
              <InterventionsMap
                interventions={interventions}
                clients={clients.map(c => ({ id: c.id, name: c.name }))}
                technicians={technicians.map(t => ({ id: t.id, full_name: t.full_name, email: t.email }))}
              />
            </div>
          </CardContent>
        </Card>
      );
    },
  };

  return (
    <div className="space-y-6">
      <AnnouncementBanner />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Tableau de bord</h1>
          <p className="text-muted-foreground">Vue d'ensemble de l'activité</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Drag mode toggle */}
          <Button
            variant={isDragMode ? "default" : "outline"}
            size="sm"
            onClick={() => setIsDragMode(prev => !prev)}
            className="gap-1.5"
          >
            <Move className="h-4 w-4" />
            {isDragMode ? "Terminer" : "Réorganiser"}
          </Button>

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
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => { setVisibility(DEFAULT_VISIBILITY); setSectionOrder(DEFAULT_SECTION_ORDER); setCollapsedSections([]); }}>
                    Réinitialiser
                  </Button>
                </div>
                <div className="space-y-3">
                  {(Object.entries(visibilityLabels) as [keyof DashboardVisibility, { label: string; icon: any }][]).map(([key, { label, icon: Icon }]) => (
                    <div key={key} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <Label htmlFor={`vis-${key}`} className="text-sm cursor-pointer truncate">{label}</Label>
                      </div>
                      <Switch id={`vis-${key}`} checked={visibility[key]} onCheckedChange={() => toggleVisibility(key)} />
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

      {isDragMode && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-primary/10 border border-primary/20 text-sm text-primary">
          <Move className="h-4 w-4" />
          <span>Mode réorganisation activé — glissez les sections pour les déplacer, puis cliquez « Terminer ».</span>
        </div>
      )}

      {/* Sortable sections */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={sectionOrder} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {sectionOrder.map((sectionKey) => {
              const content = sectionRenderers[sectionKey]();
              const isCollapsed = collapsedSections.includes(sectionKey);
              // Full-width sections
              const fullWidthSections: SectionKey[] = ['statusFilters', 'searchBar', 'interventionsMap'];
              const isFullWidth = fullWidthSections.includes(sectionKey);
              if (!content && !isCollapsed) return null;
              return (
                <div key={sectionKey} className={cn(isFullWidth && "lg:col-span-2")}>
                  <DashboardSortableSection
                    id={sectionKey}
                    isDragMode={isDragMode}
                    isCollapsed={isCollapsed}
                    onToggleCollapse={() => toggleCollapse(sectionKey)}
                    label={SECTION_LABELS[sectionKey]}
                  >
                    {content}
                  </DashboardSortableSection>
                </div>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};

export default Dashboard;
