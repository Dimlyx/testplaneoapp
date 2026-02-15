import { useInterventions } from "@/hooks/useInterventions";
import { useInterventionTypes } from "@/hooks/useInterventionTypes";
import { useClients } from "@/hooks/useClients";
import { useTechnicians } from "@/hooks/useTechnicians";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart3, 
  Users, 
  Wrench, 
  TrendingUp,
  Calendar,
  CheckCircle,
  RefreshCw,
  Target,
  Award,
  UserCheck,
  Clock,
  Car,
  LineChart
} from "lucide-react";
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PerformanceCharts } from "@/components/admin/PerformanceCharts";

interface TechnicianStats {
  id: string;
  name: string;
  totalInterventions: number;
  completedInterventions: number;
  resolutionRate: number;
  avgTravelTime: number;
  avgInterventionTime: number;
}

export default function Statistics() {
  const queryClient = useQueryClient();
  const { data: interventions = [], isLoading: loadingInterventions } = useInterventions();
  const { data: clients = [] } = useClients();
  const { data: technicians = [] } = useTechnicians();
  const [isRealtime, setIsRealtime] = useState(true);

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
          // Refresh interventions data when any change occurs
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
  // Use scheduled_date if available, otherwise fall back to created_at
  const monthStart = startOfMonth(new Date(selectedMonth + '-01'));
  const monthEnd = endOfMonth(monthStart);
  
  const monthInterventions = interventions.filter(i => {
    const dateString = i.scheduled_date || i.created_at;
    if (!dateString) return false;
    const date = parseISO(dateString);
    return isWithinInterval(date, { start: monthStart, end: monthEnd });
  });

  // Calculate statistics
  const completedInterventions = monthInterventions.filter(i => 
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

  // === KPIs ===
  
  // Resolution rate (completed vs total assigned)
  const assignedInterventions = monthInterventions.filter(i => i.technician_id);
  const resolutionRate = assignedInterventions.length > 0
    ? (completedInterventions.length / assignedInterventions.length) * 100
    : 0;

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

  // Performance by technician
  const technicianStats: TechnicianStats[] = technicians.map(tech => {
    const techInterventions = monthInterventions.filter(i => i.technician_id === tech.id);
    const techCompleted = techInterventions.filter(i => 
      ['completed', 'to_invoice', 'archived'].includes(i.status)
    );

    // Calculate tech travel time
    const techTravelTimes = techInterventions
      .map(i => calculateTimeDiff(i.travel_departure_time, i.arrival_time))
      .filter((t): t is number => t !== null);
    const techAvgTravel = techTravelTimes.length > 0 
      ? Math.round(techTravelTimes.reduce((a, b) => a + b, 0) / techTravelTimes.length) 
      : 0;

    // Calculate tech intervention time
    const techIntTimes = techInterventions
      .map(i => calculateTimeDiff(i.arrival_time, i.departure_time))
      .filter((t): t is number => t !== null);
    const techAvgInt = techIntTimes.length > 0 
      ? Math.round(techIntTimes.reduce((a, b) => a + b, 0) / techIntTimes.length) 
      : 0;

    return {
      id: tech.id,
      name: tech.full_name || tech.email,
      totalInterventions: techInterventions.length,
      completedInterventions: techCompleted.length,
      resolutionRate: techInterventions.length > 0 
        ? (techCompleted.length / techInterventions.length) * 100 
        : 0,
      avgTravelTime: techAvgTravel,
      avgInterventionTime: techAvgInt,
    };
  }).filter(t => t.totalInterventions > 0).sort((a, b) => b.completedInterventions - a.completedInterventions);

  // Best performer
  const bestPerformer = technicianStats.length > 0 
    ? technicianStats.reduce((best, current) => 
        current.resolutionRate > best.resolutionRate ? current : best
      )
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
          <TabsTrigger value="charts" className="flex items-center gap-1">
            <LineChart className="h-4 w-4" />
            Graphiques
          </TabsTrigger>
          <TabsTrigger value="technicians">Performance techniciens</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Interventions du mois</CardTitle>
                <Wrench className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{monthInterventions.length}</div>
                <p className="text-xs text-muted-foreground">
                  {completedInterventions.length} terminées
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Taux de résolution</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Math.round(resolutionRate)}%</div>
                <Progress value={resolutionRate} className="h-2 mt-2" />
              </CardContent>
            </Card>

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
                <CardTitle className="text-sm font-medium">Meilleur technicien</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold truncate">
                  {bestPerformer?.name || '-'}
                </div>
                {bestPerformer && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {Math.round(bestPerformer.resolutionRate)}% résolution
                  </p>
                )}
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
                  {Object.keys(interventionsByStatus).length === 0 && (
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
                    <span className="text-xl font-bold">{technicianStats.length}</span>
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
                    <div className="text-2xl font-bold">{technicianStats.length}</div>
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
                      {(monthInterventions.length / technicianStats.length).toFixed(1)}
                    </div>
                    <p className="text-xs text-muted-foreground">moyenne mensuelle</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Résolution moyenne</CardTitle>
                    <Target className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {Math.round(technicianStats.reduce((a, b) => a + b.resolutionRate, 0) / technicianStats.length)}%
                    </div>
                    <p className="text-xs text-muted-foreground">tous techniciens</p>
                  </CardContent>
                </Card>
              </div>

              {/* Technician cards */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {technicianStats.map((tech, index) => (
                  <Card key={tech.id} className={index === 0 ? 'border-2 border-amber-400' : ''}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {index === 0 && <Award className="h-5 w-5 text-amber-500" />}
                          <CardTitle className="text-base truncate">{tech.name}</CardTitle>
                        </div>
                        <span className="text-xs bg-muted px-2 py-1 rounded-full">
                          #{index + 1}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="bg-muted/50 p-2 rounded">
                          <p className="text-muted-foreground text-xs">Total</p>
                          <p className="font-bold">{tech.totalInterventions}</p>
                        </div>
                        <div className="bg-muted/50 p-2 rounded">
                          <p className="text-muted-foreground text-xs">Terminées</p>
                          <p className="font-bold">{tech.completedInterventions}</p>
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
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Taux résolution</span>
                          <span className="font-medium">{Math.round(tech.resolutionRate)}%</span>
                        </div>
                        <Progress value={tech.resolutionRate} className="h-2" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
