import { useInterventions } from "@/hooks/useInterventions";
import { useClients } from "@/hooks/useClients";
import { useTechnicians } from "@/hooks/useTechnicians";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart3, 
  Clock, 
  Users, 
  Wrench, 
  TrendingUp,
  Car,
  Calendar,
  CheckCircle
} from "lucide-react";
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

// Helper to calculate duration in minutes between two time strings
const getMinutesBetween = (start: string | null, end: string | null): number => {
  if (!start || !end) return 0;
  const [startHours, startMinutes] = start.split(':').map(Number);
  const [endHours, endMinutes] = end.split(':').map(Number);
  let totalMinutes = (endHours * 60 + endMinutes) - (startHours * 60 + startMinutes);
  if (totalMinutes < 0) totalMinutes += 24 * 60;
  return totalMinutes;
};

// Format minutes to hours and minutes string
const formatDuration = (minutes: number): string => {
  if (minutes === 0) return "0min";
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours === 0) return `${mins}min`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h${mins.toString().padStart(2, '0')}`;
};

export default function Statistics() {
  const { data: interventions = [], isLoading: loadingInterventions } = useInterventions();
  const { data: clients = [] } = useClients();
  const { data: technicians = [] } = useTechnicians();
  
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
    if (!i.scheduled_date) return false;
    const date = parseISO(i.scheduled_date);
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

  // Average intervention duration
  const interventionDurations = completedInterventions
    .map(i => getMinutesBetween(i.arrival_time, i.departure_time))
    .filter(d => d > 0);
  
  const avgInterventionDuration = interventionDurations.length > 0
    ? interventionDurations.reduce((a, b) => a + b, 0) / interventionDurations.length
    : 0;

  // Travel times
  const travelToTimes = completedInterventions
    .map(i => getMinutesBetween(i.travel_departure_time, i.arrival_time))
    .filter(d => d > 0);
  
  const travelReturnTimes = completedInterventions
    .map(i => getMinutesBetween(i.departure_time, i.travel_return_time))
    .filter(d => d > 0);

  const avgTravelToTime = travelToTimes.length > 0
    ? travelToTimes.reduce((a, b) => a + b, 0) / travelToTimes.length
    : 0;

  const avgTravelReturnTime = travelReturnTimes.length > 0
    ? travelReturnTimes.reduce((a, b) => a + b, 0) / travelReturnTimes.length
    : 0;

  const totalTravelTime = [...travelToTimes, ...travelReturnTimes].reduce((a, b) => a + b, 0);

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

  const typeLabels: Record<string, string> = {
    sav: 'SAV',
    maintenance: 'Maintenance',
    installation: 'Installation'
  };

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
            <p className="text-muted-foreground">Analyse des interventions</p>
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

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
            <CardTitle className="text-sm font-medium">Durée moyenne</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(avgInterventionDuration)}</div>
            <p className="text-xs text-muted-foreground">
              par intervention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Temps de route moyen</CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDuration((avgTravelToTime + avgTravelReturnTime) / 2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Aller: {formatDuration(avgTravelToTime)} / Retour: {formatDuration(avgTravelReturnTime)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total temps de route</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(totalTravelTime)}</div>
            <p className="text-xs text-muted-foreground">
              sur le mois
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
                    <div className={`w-3 h-3 rounded-full ${
                      type === 'sav' ? 'bg-red-500' : 
                      type === 'maintenance' ? 'bg-blue-500' : 'bg-green-500'
                    }`} />
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
                <span className="text-sm">Taux de complétion</span>
                <span className="text-xl font-bold">
                  {monthInterventions.length > 0 
                    ? Math.round(completedInterventions.length / monthInterventions.length * 100)
                    : 0}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
