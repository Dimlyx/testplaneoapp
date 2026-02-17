import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  ResponsiveContainer, 
  PieChart, 
  Pie,
  Cell,
  AreaChart,
  Area
} from "recharts";
import { TrendingUp, Clock, PieChart as PieChartIcon, Filter, X, Calendar, UserCheck, Timer } from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, subMonths, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { Tables } from "@/integrations/supabase/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useInterventionTypes } from "@/hooks/useInterventionTypes";
import { Badge } from "@/components/ui/badge";
import { ChartClickInfo } from "@/components/charts/ChartClickInfo";

type Intervention = Tables<"interventions">;

interface Technician {
  id: string;
  full_name: string | null;
  email: string;
}

interface PerformanceChartsProps {
  interventions: Intervention[];
  technicians?: Technician[];
}

interface ClickInfo {
  label: string;
  entries: { name: string; value: string | number; color?: string }[];
}

const COLOR_MAP: Record<string, string> = {
  red: "#ef4444",
  blue: "#3b82f6",
  green: "#22c55e",
  yellow: "#eab308",
  purple: "#a855f7",
  orange: "#f97316",
  pink: "#ec4899",
  gray: "#6b7280",
};

export function PerformanceCharts({ interventions, technicians = [] }: PerformanceChartsProps) {
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const { data: interventionTypes = [] } = useInterventionTypes();

  // Click info states for each chart
  const [trendClickInfo, setTrendClickInfo] = useState<ClickInfo | null>(null);
  const [pieClickInfo, setPieClickInfo] = useState<ClickInfo | null>(null);
  const [stackedClickInfo, setStackedClickInfo] = useState<ClickInfo | null>(null);
  const [timeClickInfo, setTimeClickInfo] = useState<ClickInfo | null>(null);

  const filteredInterventions = useMemo(() => {
    let filtered = interventions;
    if (selectedTechnicianId && selectedTechnicianId !== "all") {
      filtered = filtered.filter(i => i.technician_id === selectedTechnicianId);
    }
    if (dateFrom || dateTo) {
      filtered = filtered.filter(i => {
        const dateString = i.scheduled_date || i.created_at;
        if (!dateString) return false;
        const interventionDate = parseISO(dateString);
        if (dateFrom && isBefore(interventionDate, startOfDay(dateFrom))) return false;
        if (dateTo && isAfter(interventionDate, endOfDay(dateTo))) return false;
        return true;
      });
    }
    return filtered;
  }, [interventions, selectedTechnicianId, dateFrom, dateTo]);

  const hasActiveFilters = selectedTechnicianId !== "all" || dateFrom || dateTo;

  const clearFilters = () => {
    setSelectedTechnicianId("all");
    setDateFrom(undefined);
    setDateTo(undefined);
  };

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
      const mStart = startOfMonth(date);
      const mEnd = endOfMonth(date);

      const monthInterventions = filteredInterventions.filter(i => {
        const dateString = i.scheduled_date || i.created_at;
        if (!dateString) return false;
        return isWithinInterval(parseISO(dateString), { start: mStart, end: mEnd });
      });

      const completed = monthInterventions.filter(i => 
        ['completed', 'to_invoice', 'archived'].includes(i.status)
      ).length;

      const typeCounts: Record<string, number> = {};
      interventionTypes.forEach(t => {
        typeCounts[t.name] = monthInterventions.filter(i => i.intervention_type === t.name).length;
      });

      return {
        name: label,
        fullName: fullLabel,
        total: monthInterventions.length,
        completed,
        ...typeCounts,
      };
    });
  }, [filteredInterventions, interventionTypes]);

  // Monthly area trend (total + completed)
  const trendData = useMemo(() => {
    return monthlyData.map(d => ({
      name: d.name,
      fullName: d.fullName,
      total: d.total,
      completed: d.completed,
    }));
  }, [monthlyData]);

  // Average times by intervention type
  const timesByType = useMemo(() => {
    return interventionTypes.map(typeObj => {
      const type = typeObj.name;
      const typeInterventions = filteredInterventions.filter(i => i.intervention_type === type);
      
      const travelTimes = typeInterventions
        .map(i => calculateTimeDiff(i.travel_departure_time, i.arrival_time))
        .filter((t): t is number => t !== null);
      
      const intTimes = typeInterventions
        .map(i => calculateTimeDiff(i.arrival_time, i.departure_time))
        .filter((t): t is number => t !== null);

      const avgTravel = travelTimes.length > 0 
        ? Math.round(travelTimes.reduce((a, b) => a + b, 0) / travelTimes.length) : 0;
      const avgInt = intTimes.length > 0 
        ? Math.round(intTimes.reduce((a, b) => a + b, 0) / intTimes.length) : 0;

      return {
        type,
        name: typeObj.label,
        trajet: avgTravel,
        intervention: avgInt,
        total: avgTravel + avgInt,
        count: typeInterventions.length,
        color: COLOR_MAP[typeObj.color || 'gray'] || '#6b7280',
      };
    }).filter(t => t.count > 0);
  }, [filteredInterventions, interventionTypes]);

  // Distribution by type (for pie chart)
  const typeDistribution = useMemo(() => {
    const distribution: Record<string, number> = {};
    filteredInterventions.forEach(i => {
      distribution[i.intervention_type] = (distribution[i.intervention_type] || 0) + 1;
    });
    return Object.entries(distribution).map(([type, count]) => {
      const found = interventionTypes.find(t => t.name === type);
      return {
        name: found?.label || type,
        value: count,
        color: COLOR_MAP[found?.color || 'gray'] || "#6b7280"
      };
    });
  }, [filteredInterventions, interventionTypes]);

  const totalInterventions = filteredInterventions.length;

  const formatMinutes = (minutes: number): string => {
    if (minutes === 0) return "0min";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h${m > 0 ? ` ${m}min` : ''}` : `${m}min`;
  };

  const selectedTechnician = technicians.find(t => t.id === selectedTechnicianId);

  const handleTrendClick = (state: any) => {
    if (state?.activePayload?.[0]) {
      const d = state.activePayload[0].payload;
      setTrendClickInfo({
        label: d.fullName || d.name,
        entries: [
          { name: 'Total', value: d.total, color: 'hsl(var(--primary))' },
          { name: 'Terminées', value: d.completed, color: '#22c55e' },
        ],
      });
    }
  };

  const handleStackedClick = (state: any) => {
    if (state?.activePayload) {
      const payload = state.activePayload;
      const d = payload[0]?.payload;
      setStackedClickInfo({
        label: d?.fullName || d?.name || '',
        entries: payload.map((entry: any) => ({
          name: entry.name,
          value: entry.value,
          color: entry.color || entry.fill,
        })).filter((e: any) => e.value > 0),
      });
    }
  };

  const handleTimeClick = (state: any) => {
    if (state?.activePayload) {
      const payload = state.activePayload;
      const d = payload[0]?.payload;
      setTimeClickInfo({
        label: d?.name || '',
        entries: [
          { name: 'Trajet', value: formatMinutes(d?.trajet || 0), color: '#3b82f6' },
          { name: 'Intervention', value: formatMinutes(d?.intervention || 0), color: '#22c55e' },
          { name: 'Total', value: formatMinutes(d?.total || 0) },
        ],
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters - compact inline bar */}
      <div className="flex flex-wrap items-end gap-3 p-4 rounded-xl border bg-card">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Filter className="h-4 w-4" />
          Filtres
        </div>

        <Select value={selectedTechnicianId} onValueChange={setSelectedTechnicianId}>
          <SelectTrigger className="w-[180px] h-9">
            <UserCheck className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Tous les techniciens" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les techniciens</SelectItem>
            {technicians.map(tech => (
              <SelectItem key={tech.id} value={tech.id}>
                {tech.full_name || tech.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn("h-9 gap-1.5", !dateFrom && "text-muted-foreground")}
            >
              <Calendar className="h-3.5 w-3.5" />
              {dateFrom ? format(dateFrom, "dd/MM/yy") : "Début"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="pointer-events-auto" />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn("h-9 gap-1.5", !dateTo && "text-muted-foreground")}
            >
              <Calendar className="h-3.5 w-3.5" />
              {dateTo ? format(dateTo, "dd/MM/yy") : "Fin"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="pointer-events-auto" />
          </PopoverContent>
        </Popover>

        {hasActiveFilters && (
          <>
            <Button variant="ghost" size="sm" className="h-9" onClick={clearFilters}>
              <X className="h-3.5 w-3.5 mr-1" />
              Réinitialiser
            </Button>
            <Badge variant="secondary" className="h-7">
              {filteredInterventions.length} résultat{filteredInterventions.length > 1 ? 's' : ''}
              {selectedTechnicianId !== "all" && selectedTechnician && (
                <span className="ml-1">· {selectedTechnician.full_name || selectedTechnician.email}</span>
              )}
            </Badge>
          </>
        )}
      </div>

      {/* Row 1: Trend + Pie side by side */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Area chart - wider */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Tendance sur 6 mois
            </CardTitle>
            <CardDescription>Appuyez sur un point pour voir le détail</CardDescription>
          </CardHeader>
          <CardContent>
            {trendData.some(d => d.total > 0) ? (
              <>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={trendData} onClick={handleTrendClick}>
                    <defs>
                      <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradCompleted" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                    <XAxis dataKey="name" className="text-xs" tick={{ fontSize: 12 }} />
                    <YAxis className="text-xs" tick={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="total" name="Total" stroke="hsl(var(--primary))" fill="url(#gradTotal)" strokeWidth={2} dot={{ r: 4, fill: "hsl(var(--primary))" }} />
                    <Area type="monotone" dataKey="completed" name="Terminées" stroke="#22c55e" fill="url(#gradCompleted)" strokeWidth={2} dot={{ r: 4, fill: "#22c55e" }} />
                  </AreaChart>
                </ResponsiveContainer>
                {trendClickInfo && (
                  <ChartClickInfo label={trendClickInfo.label} entries={trendClickInfo.entries} />
                )}
              </>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                Aucune donnée disponible
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pie chart - narrower */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <PieChartIcon className="h-4 w-4 text-primary" />
              Répartition par type
            </CardTitle>
            <CardDescription>{totalInterventions} intervention{totalInterventions > 1 ? 's' : ''} · Appuyez pour le détail</CardDescription>
          </CardHeader>
          <CardContent>
            {typeDistribution.length > 0 ? (
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={typeDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                      onClick={(data) => {
                        setPieClickInfo({
                          label: data.name,
                          entries: [{ name: data.name, value: data.value, color: data.color }],
                        });
                      }}
                    >
                      {typeDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                {/* Legend below */}
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center mt-2">
                  {typeDistribution.map(entry => (
                    <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                      <span className="text-muted-foreground">{entry.name}</span>
                      <span className="font-semibold">{entry.value}</span>
                    </div>
                  ))}
                </div>
                {pieClickInfo && (
                  <ChartClickInfo label={pieClickInfo.label} entries={pieClickInfo.entries} />
                )}
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                Aucune donnée disponible
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Stacked bar by type + Time chart */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Évolution par type
            </CardTitle>
            <CardDescription>Appuyez sur une barre pour le détail</CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyData.some(d => d.total > 0) ? (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyData} barCategoryGap="20%" onClick={handleStackedClick}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                    <XAxis dataKey="name" className="text-xs" tick={{ fontSize: 12 }} />
                    <YAxis className="text-xs" tick={{ fontSize: 12 }} />
                    {interventionTypes.map((t) => (
                      <Bar key={t.name} dataKey={t.name} name={t.label} fill={COLOR_MAP[t.color] || "#6b7280"} stackId="a" radius={[0, 0, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
                {stackedClickInfo && (
                  <ChartClickInfo label={stackedClickInfo.label} entries={stackedClickInfo.entries} />
                )}
              </>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Aucune donnée disponible
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Temps moyens par type
            </CardTitle>
            <CardDescription>Appuyez sur une barre pour le détail</CardDescription>
          </CardHeader>
          <CardContent>
            {timesByType.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={timesByType} layout="vertical" barCategoryGap="25%" onClick={handleTimeClick}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                    <XAxis type="number" className="text-xs" tick={{ fontSize: 12 }} tickFormatter={(v) => formatMinutes(v)} />
                    <YAxis dataKey="name" type="category" className="text-xs" tick={{ fontSize: 12 }} width={90} />
                    <Bar dataKey="trajet" name="Trajet" fill="#3b82f6" stackId="time" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="intervention" name="Intervention" fill="#22c55e" stackId="time" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                {timeClickInfo && (
                  <ChartClickInfo label={timeClickInfo.label} entries={timeClickInfo.entries} />
                )}
              </>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Aucune donnée de temps disponible
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Summary table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Timer className="h-4 w-4 text-primary" />
            Récapitulatif des temps moyens
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nb</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Trajet</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Intervention</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {timesByType.length > 0 ? (
                  timesByType.map((row, idx) => (
                    <tr key={row.type} className={cn(idx % 2 === 0 ? "bg-background" : "bg-muted/10")}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
                          <span className="font-medium text-sm">{row.name}</span>
                        </div>
                      </td>
                      <td className="text-center py-3 px-4">
                        <Badge variant="secondary" className="font-semibold">{row.count}</Badge>
                      </td>
                      <td className="text-center py-3 px-4 text-sm font-medium text-blue-600">{formatMinutes(row.trajet)}</td>
                      <td className="text-center py-3 px-4 text-sm font-medium text-green-600">{formatMinutes(row.intervention)}</td>
                      <td className="text-center py-3 px-4 text-sm font-bold">{formatMinutes(row.total)}</td>
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
