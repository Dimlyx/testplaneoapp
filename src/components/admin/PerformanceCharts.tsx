import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  Legend,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { TrendingUp, Clock, BarChart3, PieChart as PieChartIcon } from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, subMonths } from "date-fns";
import { fr } from "date-fns/locale";
import { Tables } from "@/integrations/supabase/types";

type Intervention = Tables<"interventions">;

interface PerformanceChartsProps {
  interventions: Intervention[];
}

const COLORS = {
  sav: "#ef4444",
  maintenance: "#3b82f6", 
  installation: "#22c55e"
};

const TYPE_LABELS: Record<string, string> = {
  sav: "SAV",
  maintenance: "Maintenance",
  installation: "Installation"
};

export function PerformanceCharts({ interventions }: PerformanceChartsProps) {
  // Calculate time difference in minutes
  const calculateTimeDiff = (start: string | null, end: string | null): number | null => {
    if (!start || !end) return null;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const diff = (eh * 60 + em) - (sh * 60 + sm);
    return diff > 0 ? diff : null;
  };

  // Monthly evolution data (last 6 months)
  const monthlyData = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => {
      const date = subMonths(new Date(), 5 - i);
      return {
        date,
        label: format(date, 'MMM yy', { locale: fr }),
        fullLabel: format(date, 'MMMM yyyy', { locale: fr })
      };
    });

    return months.map(({ date, label, fullLabel }) => {
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);

      const monthInterventions = interventions.filter(i => {
        const dateString = i.scheduled_date || i.created_at;
        if (!dateString) return false;
        const interventionDate = parseISO(dateString);
        return isWithinInterval(interventionDate, { start: monthStart, end: monthEnd });
      });

      const completed = monthInterventions.filter(i => 
        ['completed', 'to_invoice', 'archived'].includes(i.status)
      ).length;

      const savCount = monthInterventions.filter(i => i.intervention_type === 'sav').length;
      const maintenanceCount = monthInterventions.filter(i => i.intervention_type === 'maintenance').length;
      const installationCount = monthInterventions.filter(i => i.intervention_type === 'installation').length;

      return {
        name: label,
        fullName: fullLabel,
        total: monthInterventions.length,
        completed,
        sav: savCount,
        maintenance: maintenanceCount,
        installation: installationCount
      };
    });
  }, [interventions]);

  // Average times by intervention type
  const timesByType = useMemo(() => {
    const types = ['sav', 'maintenance', 'installation'] as const;
    
    return types.map(type => {
      const typeInterventions = interventions.filter(i => i.intervention_type === type);
      
      const travelTimes = typeInterventions
        .map(i => calculateTimeDiff(i.travel_departure_time, i.arrival_time))
        .filter((t): t is number => t !== null);
      
      const interventionTimes = typeInterventions
        .map(i => calculateTimeDiff(i.arrival_time, i.departure_time))
        .filter((t): t is number => t !== null);

      const avgTravel = travelTimes.length > 0 
        ? Math.round(travelTimes.reduce((a, b) => a + b, 0) / travelTimes.length)
        : 0;

      const avgIntervention = interventionTimes.length > 0 
        ? Math.round(interventionTimes.reduce((a, b) => a + b, 0) / interventionTimes.length)
        : 0;

      return {
        type,
        name: TYPE_LABELS[type],
        trajet: avgTravel,
        intervention: avgIntervention,
        total: avgTravel + avgIntervention,
        count: typeInterventions.length
      };
    }).filter(t => t.count > 0);
  }, [interventions]);

  // Distribution by type (for pie chart)
  const typeDistribution = useMemo(() => {
    const distribution: Record<string, number> = {};
    interventions.forEach(i => {
      distribution[i.intervention_type] = (distribution[i.intervention_type] || 0) + 1;
    });

    return Object.entries(distribution).map(([type, count]) => ({
      name: TYPE_LABELS[type] || type,
      value: count,
      color: COLORS[type as keyof typeof COLORS] || "#6b7280"
    }));
  }, [interventions]);

  // Monthly trend - resolution rate
  const resolutionTrend = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => {
      const date = subMonths(new Date(), 5 - i);
      return {
        date,
        label: format(date, 'MMM yy', { locale: fr })
      };
    });

    return months.map(({ date, label }) => {
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);

      const monthInterventions = interventions.filter(i => {
        const dateString = i.scheduled_date || i.created_at;
        if (!dateString) return false;
        const interventionDate = parseISO(dateString);
        return isWithinInterval(interventionDate, { start: monthStart, end: monthEnd });
      });

      const assigned = monthInterventions.filter(i => i.technician_id).length;
      const completed = monthInterventions.filter(i => 
        ['completed', 'to_invoice', 'archived'].includes(i.status)
      ).length;

      const rate = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;

      return {
        name: label,
        taux: rate
      };
    });
  }, [interventions]);

  const formatMinutes = (minutes: number): string => {
    if (minutes === 0) return "0min";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h${m > 0 ? ` ${m}min` : ''}` : `${m}min`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="font-medium mb-1">{payload[0]?.payload?.fullName || label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const TimeTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="font-medium mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {formatMinutes(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Evolution mensuelle */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Évolution mensuelle
            </CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyData.some(d => d.total > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="sav" name="SAV" fill={COLORS.sav} stackId="a" />
                  <Bar dataKey="maintenance" name="Maintenance" fill={COLORS.maintenance} stackId="a" />
                  <Bar dataKey="installation" name="Installation" fill={COLORS.installation} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Aucune donnée disponible
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Taux de résolution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {resolutionTrend.some(d => d.taux > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={resolutionTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip 
                    formatter={(value: number) => [`${value}%`, 'Taux de résolution']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="taux" 
                    name="Taux" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Aucune donnée disponible
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Temps moyens et distribution */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Temps moyens par type
            </CardTitle>
          </CardHeader>
          <CardContent>
            {timesByType.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={timesByType} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" className="text-xs" tickFormatter={(v) => formatMinutes(v)} />
                  <YAxis dataKey="name" type="category" className="text-xs" width={100} />
                  <Tooltip content={<TimeTooltip />} />
                  <Legend />
                  <Bar dataKey="trajet" name="Trajet" fill="#3b82f6" stackId="time" />
                  <Bar dataKey="intervention" name="Intervention" fill="#22c55e" stackId="time" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Aucune donnée de temps disponible
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5" />
              Répartition par type
            </CardTitle>
          </CardHeader>
          <CardContent>
            {typeDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={typeDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {typeDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Aucune donnée disponible
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tableau récapitulatif des temps */}
      <Card>
        <CardHeader>
          <CardTitle>Récapitulatif des temps moyens</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium">Type</th>
                  <th className="text-center py-3 px-4 font-medium">Interventions</th>
                  <th className="text-center py-3 px-4 font-medium">Temps trajet</th>
                  <th className="text-center py-3 px-4 font-medium">Temps intervention</th>
                  <th className="text-center py-3 px-4 font-medium">Temps total</th>
                </tr>
              </thead>
              <tbody>
                {timesByType.length > 0 ? (
                  timesByType.map((row) => (
                    <tr key={row.type} className="border-b last:border-0">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: COLORS[row.type as keyof typeof COLORS] }}
                          />
                          {row.name}
                        </div>
                      </td>
                      <td className="text-center py-3 px-4 font-medium">{row.count}</td>
                      <td className="text-center py-3 px-4 text-blue-600">{formatMinutes(row.trajet)}</td>
                      <td className="text-center py-3 px-4 text-green-600">{formatMinutes(row.intervention)}</td>
                      <td className="text-center py-3 px-4 font-bold">{formatMinutes(row.total)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-muted-foreground">
                      Aucune donnée de temps disponible
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
