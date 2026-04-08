import { useInterventions } from "@/hooks/useInterventions";
import { useCustomStatuses } from "@/hooks/useCustomStatuses";
import { useInterventionTypes } from "@/hooks/useInterventionTypes";
import { useClients } from "@/hooks/useClients";
import { useTechnicians } from "@/hooks/useTechnicians";
import { useMaintenanceAlerts, useUpcomingAlerts } from "@/hooks/useMaintenanceAlerts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart3, 
  Users, 
  Wrench, 
  TrendingUp,
  TrendingDown,
  Calendar,
  CheckCircle,
  RefreshCw,
  Award,
  UserCheck,
  Clock,
  Car,
  LineChart,
  AlertTriangle,
  CalendarClock,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  ClipboardList,
  Bell
} from "lucide-react";
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, subMonths, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { TechnicianStatsDialog } from "@/components/admin/TechnicianStatsDialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PerformanceCharts } from "@/components/admin/PerformanceCharts";
import { Badge } from "@/components/ui/badge";

interface TechnicianStats {
  id: string;
  name: string;
  totalInterventions: number;
  completedInterventions: number;
  avgTravelTime: number;
  avgInterventionTime: number;
  upcomingCount: number;
}

export default function Statistics() {
  const queryClient = useQueryClient();
  const { data: interventions = [], isLoading: loadingInterventions } = useInterventions();
  const { data: clients = [] } = useClients();
  const { data: technicians = [] } = useTechnicians();
  const { data: maintenanceAlerts = [] } = useMaintenanceAlerts();
  const { data: upcomingAlerts = [] } = useUpcomingAlerts(30);
  const { data: customStatuses = [] } = useCustomStatuses();
  const [isRealtime, setIsRealtime] = useState(true);
  const [selectedTech, setSelectedTech] = useState<TechnicianStats | null>(null);
  const [selectedTechRank, setSelectedTechRank] = useState(0);

  // Subscribe to realtime updates for interventions
  useEffect(() => {
    const channel = supabase
      .channel('statistics-interventions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'interventions'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['interventions'] });
        }
      )
      .subscribe((status) => {
        setIsRealtime(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
  
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), 'yyyy-MM'));
  
  // Generate last 12 months for dropdown
  const months = Array.from({ length: 12 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    return {
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy', { locale: fr })
    };
  });

  // Filter interventions for selected month
  const monthStart = startOfMonth(new Date(selectedMonth + '-01'));
  const monthEnd = endOfMonth(monthStart);
  
  const monthInterventions = interventions.filter(i => {
    const dateString = i.scheduled_date || i.created_at;
    if (!dateString) return false;
    const date = parseISO(dateString);
    return isWithinInterval(date, { start: monthStart, end: monthEnd });
  });

  // === Previous month for comparison ===
  const prevMonthStart = startOfMonth(subMonths(monthStart, 1));
  const prevMonthEnd = endOfMonth(prevMonthStart);
  
  const prevMonthInterventions = interventions.filter(i => {
    const dateString = i.scheduled_date || i.created_at;
    if (!dateString) return false;
    const date = parseISO(dateString);
    return isWithinInterval(date, { start: prevMonthStart, end: prevMonthEnd });
  });

  // Calculate statistics
  const completedInterventions = monthInterventions.filter(i => 
    ['completed', 'to_invoice', 'archived'].includes(i.status)
  );
  const prevCompletedInterventions = prevMonthInterventions.filter(i => 
    ['completed', 'to_invoice', 'archived'].includes(i.status)
  );
  
  // Interventions by client
  const interventionsByClient: Record<string, number> = {};
  monthInterventions.forEach(i => {
    interventionsByClient[i.client_id] = (interventionsByClient[i.client_id] || 0) + 1;
  });
  
  const avgInterventionsPerClient = Object.keys(interventionsByClient).length > 0
    ? monthInterventions.length / Object.keys(interventionsByClient).length
    : 0;

  // Interventions by type
  const interventionsByType: Record<string, number> = {};
  monthInterventions.forEach(i => {
    interventionsByType[i.intervention_type] = (interventionsByType[i.intervention_type] || 0) + 1;
  });

  // Interventions by status
  const interventionsByStatus: Record<string, number> = {};
  monthInterventions.forEach(i => {
    interventionsByStatus[i.status] = (interventionsByStatus[i.status] || 0) + 1;
  });

  // Top clients
  const topClients = Object.entries(interventionsByClient)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([clientId, count]) => ({
      client: clients.find(c => c.id === clientId),
      count
    }));

  // === NEW KPIs ===

  // 1. Planification: planned vs to_plan
  const toPlanCount = monthInterventions.filter(i => i.status === 'to_plan').length;
  const plannedOrBeyond = monthInterventions.filter(i => i.status !== 'to_plan').length;
  const planificationRate = monthInterventions.length > 0
    ? (plannedOrBeyond / monthInterventions.length) * 100
    : 0;

  // 2. Délai moyen de prise en charge (creation → scheduled_date)
  const handlingDelays = monthInterventions
    .filter(i => i.scheduled_date && i.created_at)
    .map(i => {
      const created = parseISO(i.created_at);
      const scheduled = parseISO(i.scheduled_date!);
      return differenceInDays(scheduled, created);
    })
    .filter(d => d >= 0);
  const avgHandlingDelay = handlingDelays.length > 0
    ? Math.round(handlingDelays.reduce((a, b) => a + b, 0) / handlingDelays.length)
    : 0;

  // 3. Maintenance alerts coming
  const pendingAlerts = maintenanceAlerts.filter(a => a.status === 'pending');
  const overdueAlerts = pendingAlerts.filter(a => {
    const alertDate = parseISO(a.alert_date);
    return alertDate < new Date();
  });

  // 4. Recurring alerts forecast
  const recurringAlerts = maintenanceAlerts.filter(a => a.recurrence !== 'once' && a.status !== 'dismissed');
  const recurrenceLabels: Record<string, string> = {
    weekly: 'Hebdo',
    monthly: 'Mensuel',
    quarterly: 'Trimestriel',
    yearly: 'Annuel'
  };

  // Calculate time statistics
  const calculateTimeDiff = (start: string | null, end: string | null): number | null => {
    if (!start || !end) return null;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const diff = (eh * 60 + em) - (sh * 60 + sm);
    return diff > 0 ? diff : null;
  };

  // Calculate average travel time
  const travelTimes = monthInterventions
    .map(i => calculateTimeDiff(i.travel_departure_time, i.arrival_time))
    .filter((t): t is number => t !== null);
  const avgTravelTime = travelTimes.length > 0 
    ? Math.round(travelTimes.reduce((a, b) => a + b, 0) / travelTimes.length) 
    : 0;

  // Calculate average intervention time
  const interventionTimes = monthInterventions
    .map(i => calculateTimeDiff(i.arrival_time, i.departure_time))
    .filter((t): t is number => t !== null);
  const avgInterventionTime = interventionTimes.length > 0 
    ? Math.round(interventionTimes.reduce((a, b) => a + b, 0) / interventionTimes.length) 
    : 0;

  // Format minutes to readable time
  const formatMinutes = (minutes: number): string => {
    if (minutes === 0) return "—";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}min` : `${m}min`;
  };

  // === Comparison N vs N-1 ===
  const calcEvolution = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const evolutionTotal = calcEvolution(monthInterventions.length, prevMonthInterventions.length);
  const evolutionCompleted = calcEvolution(completedInterventions.length, prevCompletedInterventions.length);

  const EvolutionBadge = ({ value }: { value: number }) => {
    if (value > 0) return (
      <span className="flex items-center gap-0.5 text-xs font-medium text-green-600">
        <ArrowUpRight className="h-3 w-3" />+{value}%
      </span>
    );
    if (value < 0) return (
      <span className="flex items-center gap-0.5 text-xs font-medium text-red-600">
        <ArrowDownRight className="h-3 w-3" />{value}%
      </span>
    );
    return (
      <span className="flex items-center gap-0.5 text-xs font-medium text-muted-foreground">
        <Minus className="h-3 w-3" />0%
      </span>
    );
  };

  // Performance by technician (with upcoming workload)
  const futureInterventions = interventions.filter(i => {
    if (!i.scheduled_date) return false;
    const d = parseISO(i.scheduled_date);
    return d >= new Date() && ['planned', 'to_plan'].includes(i.status);
  });

  const technicianStats: TechnicianStats[] = technicians.map(tech => {
    const techInterventions = monthInterventions.filter(i => i.technician_id === tech.id);
    const techCompleted = techInterventions.filter(i => 
      ['completed', 'to_invoice', 'archived'].includes(i.status)
    );

    const techTravelTimes = techInterventions
      .map(i => calculateTimeDiff(i.travel_departure_time, i.arrival_time))
      .filter((t): t is number => t !== null);
    const techAvgTravel = techTravelTimes.length > 0 
      ? Math.round(techTravelTimes.reduce((a, b) => a + b, 0) / techTravelTimes.length) 
      : 0;

    const techIntTimes = techInterventions
      .map(i => calculateTimeDiff(i.arrival_time, i.departure_time))
      .filter((t): t is number => t !== null);
    const techAvgInt = techIntTimes.length > 0 
      ? Math.round(techIntTimes.reduce((a, b) => a + b, 0) / techIntTimes.length) 
      : 0;

    const upcomingCount = futureInterventions.filter(i => i.technician_id === tech.id).length;

    return {
      id: tech.id,
      name: tech.full_name || tech.email,
      totalInterventions: techInterventions.length,
      completedInterventions: techCompleted.length,
      avgTravelTime: techAvgTravel,
      avgInterventionTime: techAvgInt,
      upcomingCount,
    };
  }).filter(t => t.totalInterventions > 0 || t.upcomingCount > 0).sort((a, b) => b.completedInterventions - a.completedInterventions);

  // Best performer by completed count
  const bestPerformer = technicianStats.length > 0 
    ? technicianStats[0]
    : null;

  const { data: interventionTypesData = [] } = useInterventionTypes();
  const typeLabels: Record<string, string> = Object.fromEntries(
    interventionTypesData.map(t => [t.name, t.label])
  );
  const typeColorMap: Record<string, string> = Object.fromEntries(
    interventionTypesData.map(t => [t.name, {
      red: 'bg-red-500', blue: 'bg-blue-500', green: 'bg-green-500',
      yellow: 'bg-yellow-500', purple: 'bg-purple-500', orange: 'bg-orange-500',
      pink: 'bg-pink-500', gray: 'bg-gray-500',
    }[t.color] || 'bg-gray-500'])
  );

  const statusLabels: Record<string, string> = {
    to_plan: 'À planifier',
    planned: 'Planifiée',
    in_progress: 'En cours',
    completed: 'Terminée',
    to_invoice: 'À facturer',
    archived: 'Archivée'
  };

  if (loadingInterventions) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <BarChart3 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Statistiques</h1>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>Analyse des interventions</span>
              {isRealtime && (
                <span className="flex items-center gap-1 text-xs text-green-600">
                  <RefreshCw className="h-3 w-3 animate-spin" style={{ animationDuration: '3s' }} />
                  Temps réel
                </span>
              )}
            </div>
          </div>
        </div>
        
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[200px]">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map(m => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="technicians">Performance techniciens</TabsTrigger>
          <TabsTrigger value="maintenance" className="flex items-center gap-1">
            <Bell className="h-4 w-4" />
            Maintenance
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Interventions du mois</CardTitle>
                <Wrench className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold">{monthInterventions.length}</span>
                  <EvolutionBadge value={evolutionTotal} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {completedInterventions.length} terminées
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Taux de planification</CardTitle>
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Math.round(planificationRate)}%</div>
                <Progress value={planificationRate} className="h-2 mt-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  {toPlanCount} à planifier
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Délai prise en charge</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {avgHandlingDelay > 0 ? `${avgHandlingDelay}j` : '—'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {handlingDelays.length > 0 ? `sur ${handlingDelays.length} interventions` : 'Aucune donnée'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Meilleur technicien</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold truncate">
                  {bestPerformer?.name || '-'}
                </div>
                {bestPerformer && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {bestPerformer.completedInterventions} terminées
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Secondary stats row */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Temps trajet moyen</CardTitle>
                <Car className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatMinutes(avgTravelTime)}</div>
                <p className="text-xs text-muted-foreground">
                  {travelTimes.length} trajets enregistrés
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Temps intervention moyen</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatMinutes(avgInterventionTime)}</div>
                <p className="text-xs text-muted-foreground">
                  {interventionTimes.length} interventions mesurées
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Alertes en attente</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold">{pendingAlerts.length}</span>
                  {overdueAlerts.length > 0 && (
                    <Badge variant="destructive" className="text-xs">{overdueAlerts.length} en retard</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {upcomingAlerts.length} à venir (30j)
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Terminées vs N-1</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold">{completedInterventions.length}</span>
                  <EvolutionBadge value={evolutionCompleted} />
                </div>
                <p className="text-xs text-muted-foreground">
                  vs {prevCompletedInterventions.length} mois précédent
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Interventions par type */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  Par type d'intervention
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(interventionsByType).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${typeColorMap[type] || 'bg-gray-500'}`} />
                        <span className="font-medium">{typeLabels[type] || type}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold">{count}</span>
                        <span className="text-sm text-muted-foreground">
                          ({Math.round(count / monthInterventions.length * 100)}%)
                        </span>
                      </div>
                    </div>
                  ))}
                  {Object.keys(interventionsByType).length === 0 && (
                    <p className="text-muted-foreground text-center py-4">Aucune donnée</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Interventions par statut */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Par statut
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Base statuses */}
                  {Object.entries(interventionsByStatus).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <span className="text-sm">{statusLabels[status] || status}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${(count / monthInterventions.length) * 100}%` }}
                          />
                        </div>
                        <span className="font-medium w-8 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
                  {/* Custom statuses */}
                  {customStatuses.map((cs) => {
                    const count = monthInterventions.filter(i => i.custom_status_id === cs.id).length;
                    if (count === 0) return null;
                    return (
                      <div key={cs.id} className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-sm">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cs.color }} />
                          {cs.label}
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full"
                              style={{ 
                                width: `${(count / monthInterventions.length) * 100}%`,
                                backgroundColor: cs.color 
                              }}
                            />
                          </div>
                          <span className="font-medium w-8 text-right">{count}</span>
                        </div>
                      </div>
                    );
                  })}
                  {Object.keys(interventionsByStatus).length === 0 && customStatuses.every(cs => monthInterventions.filter(i => i.custom_status_id === cs.id).length === 0) && (
                    <p className="text-muted-foreground text-center py-4">Aucune donnée</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Top clients */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Top clients
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topClients.map(({ client, count }, index) => (
                    <div key={client?.id || index} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-muted-foreground w-5">
                          {index + 1}.
                        </span>
                        <span className="font-medium">{client?.name || 'Client inconnu'}</span>
                      </div>
                      <span className="text-xl font-bold">{count}</span>
                    </div>
                  ))}
                  {topClients.length === 0 && (
                    <p className="text-muted-foreground text-center py-4">Aucune donnée</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Moyennes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Moyennes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm">Interventions par client</span>
                    <span className="text-xl font-bold">{avgInterventionsPerClient.toFixed(1)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm">Clients actifs</span>
                    <span className="text-xl font-bold">{Object.keys(interventionsByClient).length}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm">Techniciens actifs</span>
                    <span className="text-xl font-bold">{technicianStats.filter(t => t.totalInterventions > 0).length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Charts Tab */}
        <TabsContent value="charts" className="space-y-6">
          <PerformanceCharts interventions={interventions} technicians={technicians} />
        </TabsContent>

        {/* Technicians Tab */}
        <TabsContent value="technicians" className="space-y-6">
          {technicianStats.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <UserCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Aucune intervention assignée à un technicien ce mois-ci</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Summary row */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Techniciens actifs</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{technicianStats.filter(t => t.totalInterventions > 0).length}</div>
                    <p className="text-xs text-muted-foreground">sur {technicians.length} total</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Interventions / technicien</CardTitle>
                    <Wrench className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {technicianStats.filter(t => t.totalInterventions > 0).length > 0
                        ? (monthInterventions.length / technicianStats.filter(t => t.totalInterventions > 0).length).toFixed(1)
                        : '0'}
                    </div>
                    <p className="text-xs text-muted-foreground">moyenne mensuelle</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Charge à venir</CardTitle>
                    <ClipboardList className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {futureInterventions.length}
                    </div>
                    <p className="text-xs text-muted-foreground">interventions planifiées</p>
                  </CardContent>
                </Card>
              </div>

              {/* Technician cards */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {technicianStats.map((tech, index) => (
                  <Card key={tech.id} className={`cursor-pointer transition-shadow hover:shadow-md ${index === 0 && tech.completedInterventions > 0 ? 'border-2 border-amber-400' : ''}`} onClick={() => { setSelectedTech(tech); setSelectedTechRank(index + 1); }}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {index === 0 && tech.completedInterventions > 0 && <Award className="h-5 w-5 text-amber-500" />}
                          <CardTitle className="text-base truncate">{tech.name}</CardTitle>
                        </div>
                        <span className="text-xs bg-muted px-2 py-1 rounded-full">
                          #{index + 1}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div className="bg-muted/50 p-2 rounded">
                          <p className="text-muted-foreground text-xs">Total</p>
                          <p className="font-bold">{tech.totalInterventions}</p>
                        </div>
                        <div className="bg-muted/50 p-2 rounded">
                          <p className="text-muted-foreground text-xs">Terminées</p>
                          <p className="font-bold">{tech.completedInterventions}</p>
                        </div>
                        <div className="bg-muted/50 p-2 rounded">
                          <p className="text-muted-foreground text-xs">À venir</p>
                          <p className="font-bold text-primary">{tech.upcomingCount}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="bg-blue-50 p-2 rounded">
                          <p className="text-blue-600 text-xs flex items-center gap-1">
                            <Car className="h-3 w-3" />
                            Trajet moy.
                          </p>
                          <p className="font-bold text-blue-800">{formatMinutes(tech.avgTravelTime)}</p>
                        </div>
                        <div className="bg-green-50 p-2 rounded">
                          <p className="text-green-600 text-xs flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Interv. moy.
                          </p>
                          <p className="font-bold text-green-800">{formatMinutes(tech.avgInterventionTime)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        {/* Maintenance Tab */}
        <TabsContent value="maintenance" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Alertes en attente</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pendingAlerts.length}</div>
                {overdueAlerts.length > 0 && (
                  <p className="text-xs text-destructive font-medium mt-1">
                    {overdueAlerts.length} en retard
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">À venir (30 jours)</CardTitle>
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{upcomingAlerts.length}</div>
                <p className="text-xs text-muted-foreground">maintenances planifiées</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Contrats récurrents</CardTitle>
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{recurringAlerts.length}</div>
                <p className="text-xs text-muted-foreground">alertes automatiques actives</p>
              </CardContent>
            </Card>
          </div>

          {/* Recurring alerts breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Prévision de charge - Alertes récurrentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recurringAlerts.length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(
                    recurringAlerts.reduce((acc, a) => {
                      acc[a.recurrence] = (acc[a.recurrence] || 0) + 1;
                      return acc;
                    }, {} as Record<string, number>)
                  ).map(([recurrence, count]) => (
                    <div key={recurrence} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{recurrenceLabels[recurrence] || recurrence}</Badge>
                      </div>
                      <div className="text-right">
                        <span className="text-xl font-bold">{count}</span>
                        <span className="text-sm text-muted-foreground ml-1">alerte{count > 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">Aucune alerte récurrente configurée</p>
              )}
            </CardContent>
          </Card>

          {/* Upcoming alerts list */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Prochaines maintenances (30 jours)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingAlerts.length > 0 ? (
                <div className="space-y-3">
                  {upcomingAlerts.slice(0, 10).map(alert => (
                    <div key={alert.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{alert.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {alert.clients?.name || 'Client non défini'}
                        </p>
                      </div>
                      <div className="text-right ml-4 shrink-0">
                        <p className="text-sm font-medium">
                          {format(parseISO(alert.alert_date), 'dd MMM yyyy', { locale: fr })}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {recurrenceLabels[alert.recurrence] || alert.recurrence}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {upcomingAlerts.length > 10 && (
                    <p className="text-sm text-muted-foreground text-center">
                      + {upcomingAlerts.length - 10} autres alertes
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">Aucune maintenance prévue dans les 30 prochains jours</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      <TechnicianStatsDialog
        open={!!selectedTech}
        onOpenChange={(open) => { if (!open) setSelectedTech(null); }}
        tech={selectedTech}
        rank={selectedTechRank}
        formatMinutes={formatMinutes}
        interventions={interventions}
      />
    </div>
  );
}
