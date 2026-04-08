import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Award, Car, Clock, Wrench, CheckCircle, CalendarClock, TrendingUp, Timer } from "lucide-react";
import { format, parseISO, startOfWeek, endOfWeek, isWithinInterval, startOfMonth, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { Tables } from "@/integrations/supabase/types";

type Intervention = Tables<"interventions">;

interface TechnicianStatsData {
  id: string;
  name: string;
  totalInterventions: number;
  completedInterventions: number;
  avgTravelTime: number;
  avgInterventionTime: number;
  upcomingCount: number;
}

interface TechnicianStatsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tech: TechnicianStatsData | null;
  rank: number;
  formatMinutes: (minutes: number) => string;
  interventions: Intervention[];
}

function timeToMinutes(time: string | null): number | null {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function getWorkMinutes(intervention: Intervention): number {
  // Work time = travel_departure_time to travel_return_time (or departure_time fallback)
  const start = timeToMinutes(intervention.travel_departure_time);
  const end = timeToMinutes(intervention.travel_return_time) ?? timeToMinutes(intervention.departure_time);
  if (start === null || end === null) return 0;
  const diff = end - start;
  return diff > 0 ? diff : 0;
}

function formatHoursMinutes(totalMinutes: number): string {
  if (totalMinutes === 0) return "0h";
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export function TechnicianStatsDialog({ open, onOpenChange, tech, rank, formatMinutes, interventions }: TechnicianStatsDialogProps) {
  const [activeTab, setActiveTab] = useState("stats");

  const completionRate = tech
    ? (tech.totalInterventions > 0 ? Math.round((tech.completedInterventions / tech.totalInterventions) * 100) : 0)
    : 0;

  const totalAvgTime = tech ? tech.avgTravelTime + tech.avgInterventionTime : 0;

  const techInterventions = tech ? interventions.filter(i => i.technician_id === tech.id) : [];

  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const monthStartDate = startOfMonth(today);
  const monthEndDate = endOfMonth(today);

  // Filter interventions for this technician that have time data
  const techInterventions = interventions.filter(i => i.technician_id === tech.id);

  // --- Work hours calculations ---
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  // Daily breakdown for the current week
  const dailyHours = useMemo(() => {
    const days: { date: string; label: string; minutes: number; count: number }[] = [];
    for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
      const dateStr = format(d, "yyyy-MM-dd");
      const dayInterventions = techInterventions.filter(i => i.scheduled_date === dateStr);
      const totalMin = dayInterventions.reduce((sum, i) => sum + getWorkMinutes(i), 0);
      days.push({
        date: dateStr,
        label: format(d, "EEE dd", { locale: fr }),
        minutes: totalMin,
        count: dayInterventions.filter(i => getWorkMinutes(i) > 0).length,
      });
    }
    return days;
  }, [techInterventions, weekStart, weekEnd]);

  // Today total
  const todayMinutes = dailyHours.find(d => d.date === todayStr)?.minutes ?? 0;

  // This week total
  const weekMinutes = dailyHours.reduce((sum, d) => sum + d.minutes, 0);

  // This month total
  const monthMinutes = useMemo(() => {
    return techInterventions
      .filter(i => {
        if (!i.scheduled_date) return false;
        const d = parseISO(i.scheduled_date);
        return isWithinInterval(d, { start: monthStart, end: monthEnd });
      })
      .reduce((sum, i) => sum + getWorkMinutes(i), 0);
  }, [techInterventions, monthStart, monthEnd]);

  // Max daily minutes for bar chart scaling
  const maxDailyMin = Math.max(...dailyHours.map(d => d.minutes), 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {rank === 1 && tech.completedInterventions > 0 && <Award className="h-5 w-5 text-amber-500" />}
            <span className="truncate">{tech.name}</span>
            <span className="text-xs bg-muted px-2 py-1 rounded-full shrink-0">#{rank}</span>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="stats" className="flex-1">Performance</TabsTrigger>
            <TabsTrigger value="hours" className="flex-1 flex items-center gap-1">
              <Timer className="h-3.5 w-3.5" />
              Heures de travail
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stats" className="space-y-4 mt-4">
            {/* KPI cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/50 p-3 rounded-lg text-center">
                <Wrench className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-2xl font-bold">{tech.totalInterventions}</p>
                <p className="text-xs text-muted-foreground">Interventions</p>
              </div>
              <div className="bg-muted/50 p-3 rounded-lg text-center">
                <CheckCircle className="h-4 w-4 mx-auto mb-1 text-green-600" />
                <p className="text-2xl font-bold">{tech.completedInterventions}</p>
                <p className="text-xs text-muted-foreground">Terminées</p>
              </div>
              <div className="bg-muted/50 p-3 rounded-lg text-center">
                <CalendarClock className="h-4 w-4 mx-auto mb-1 text-primary" />
                <p className="text-2xl font-bold">{tech.upcomingCount}</p>
                <p className="text-xs text-muted-foreground">À venir</p>
              </div>
              <div className="bg-muted/50 p-3 rounded-lg text-center">
                <TrendingUp className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-2xl font-bold">{completionRate}%</p>
                <p className="text-xs text-muted-foreground">Complétion</p>
              </div>
            </div>

            {/* Completion progress */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Taux de complétion</span>
                <span className="font-medium">{completionRate}%</span>
              </div>
              <Progress value={completionRate} className="h-2" />
            </div>

            {/* Time stats */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <p className="text-sm font-medium">Temps moyens</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                      <Car className="h-4 w-4" />
                      Trajet
                    </span>
                    <span className="font-bold text-sm">{formatMinutes(tech.avgTravelTime)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                      <Clock className="h-4 w-4" />
                      Intervention
                    </span>
                    <span className="font-bold text-sm">{formatMinutes(tech.avgInterventionTime)}</span>
                  </div>
                  <div className="border-t pt-2 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground font-medium">Total moyen</span>
                    <span className="font-bold text-sm">{formatMinutes(totalAvgTime)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="hours" className="space-y-4 mt-4">
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-muted/50 p-3 rounded-lg text-center">
                <p className="text-xs text-muted-foreground mb-1">Aujourd'hui</p>
                <p className="text-xl font-bold">{formatHoursMinutes(todayMinutes)}</p>
              </div>
              <div className="bg-muted/50 p-3 rounded-lg text-center">
                <p className="text-xs text-muted-foreground mb-1">Semaine</p>
                <p className="text-xl font-bold">{formatHoursMinutes(weekMinutes)}</p>
              </div>
              <div className="bg-muted/50 p-3 rounded-lg text-center">
                <p className="text-xs text-muted-foreground mb-1">Mois</p>
                <p className="text-xl font-bold">{formatHoursMinutes(monthMinutes)}</p>
              </div>
            </div>

            {/* Weekly bar chart */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <p className="text-sm font-medium">Semaine en cours</p>
                <div className="space-y-2">
                  {dailyHours.map(day => (
                    <div key={day.date} className="flex items-center gap-3">
                      <span className={`text-xs w-14 shrink-0 capitalize ${day.date === todayStr ? 'font-bold text-primary' : 'text-muted-foreground'}`}>
                        {day.label}
                      </span>
                      <div className="flex-1 h-6 bg-muted/50 rounded-full overflow-hidden relative">
                        {day.minutes > 0 && (
                          <div
                            className="h-full bg-primary/80 rounded-full transition-all"
                            style={{ width: `${Math.max((day.minutes / maxDailyMin) * 100, 5)}%` }}
                          />
                        )}
                      </div>
                      <span className={`text-xs w-16 text-right shrink-0 ${day.date === todayStr ? 'font-bold' : ''}`}>
                        {day.minutes > 0 ? formatHoursMinutes(day.minutes) : '—'}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="border-t pt-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground font-medium">Total semaine</span>
                  <span className="font-bold">{formatHoursMinutes(weekMinutes)}</span>
                </div>
              </CardContent>
            </Card>

            {weekMinutes === 0 && monthMinutes === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                Aucune donnée de temps enregistrée. Les heures sont calculées à partir du départ trajet jusqu'au retour.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
