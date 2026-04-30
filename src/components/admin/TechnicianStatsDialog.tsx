import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Award, Car, Clock, Wrench, CheckCircle, CalendarClock, TrendingUp, Timer, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, parseISO, startOfWeek, endOfWeek, isWithinInterval, startOfMonth, endOfMonth, addWeeks, subWeeks } from "date-fns";
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

/**
 * Calculate total work minutes for a day's interventions.
 * Uses travel_departure_time of the first intervention as start.
 * Uses travel_return_time if available, otherwise departure_time of the last intervention as end.
 */
function getDayWorkInfo(dayInterventions: Intervention[]): { minutes: number; startTime: string | null; endTime: string | null } {
  if (dayInterventions.length === 0) return { minutes: 0, startTime: null, endTime: null };

  const starts = dayInterventions
    .map(i => timeToMinutes(i.travel_departure_time))
    .filter((t): t is number => t !== null);
  if (starts.length === 0) return { minutes: 0, startTime: null, endTime: null };
  const dayStart = Math.min(...starts);

  // Prefer travel_return_arrival_time (actual arrival back), then travel_return_time, then departure_time
  const returnArrivalTimes = dayInterventions
    .map(i => timeToMinutes((i as any).travel_return_arrival_time) ?? timeToMinutes(i.travel_return_time))
    .filter((t): t is number => t !== null);
  const returnTimes = returnArrivalTimes;
  
  let dayEnd: number | null = null;
  if (returnTimes.length > 0) {
    dayEnd = Math.max(...returnTimes);
  } else {
    const departureTimes = dayInterventions
      .map(i => timeToMinutes(i.departure_time))
      .filter((t): t is number => t !== null);
    if (departureTimes.length > 0) {
      dayEnd = Math.max(...departureTimes);
    }
  }

  if (dayEnd === null) return { minutes: 0, startTime: minutesToHM(dayStart), endTime: null };
  const diff = dayEnd - dayStart;
  return { 
    minutes: diff > 0 ? diff : 0, 
    startTime: minutesToHM(dayStart), 
    endTime: minutesToHM(dayEnd) 
  };
}

function minutesToHM(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function formatHM(totalMinutes: number): string {
  if (totalMinutes === 0) return "0h";
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export function TechnicianStatsDialog({ open, onOpenChange, tech, rank, formatMinutes, interventions }: TechnicianStatsDialogProps) {
  const [activeTab, setActiveTab] = useState("stats");
  const [weekOffset, setWeekOffset] = useState(0);

  const techInterventions = useMemo(
    () => (tech ? interventions.filter(i => i.technician_id === tech.id) : []),
    [interventions, tech]
  );

  const today = useMemo(() => new Date(), []);
  const todayStr = format(today, "yyyy-MM-dd");
  const referenceDate = useMemo(() => weekOffset === 0 ? today : addWeeks(today, weekOffset), [today, weekOffset]);
  const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(referenceDate, { weekStartsOn: 1 });
  const mStart = startOfMonth(referenceDate);
  const mEnd = endOfMonth(referenceDate);

  const dailyHours = useMemo(() => {
    const days: { date: string; label: string; minutes: number; count: number; startTime: string | null; endTime: string | null }[] = [];
    const d = new Date(weekStart);
    while (d <= weekEnd) {
      const dateStr = format(d, "yyyy-MM-dd");
      const dayInts = techInterventions.filter(i => i.scheduled_date === dateStr);
      const info = getDayWorkInfo(dayInts);
      days.push({
        date: dateStr,
        label: format(d, "EEE dd", { locale: fr }),
        minutes: info.minutes,
        count: dayInts.length,
        startTime: info.startTime,
        endTime: info.endTime,
      });
      d.setDate(d.getDate() + 1);
    }
    return days;
  }, [techInterventions, weekStart, weekEnd]);

  const todayMinutes = dailyHours.find(d => d.date === todayStr)?.minutes ?? 0;
  const weekMinutes = dailyHours.reduce((sum, d) => sum + d.minutes, 0);

  const monthMinutes = useMemo(() => {
    // Group by date then sum daily work
    const byDate: Record<string, Intervention[]> = {};
    techInterventions.forEach(i => {
      if (!i.scheduled_date) return;
      const d = parseISO(i.scheduled_date);
      if (!isWithinInterval(d, { start: mStart, end: mEnd })) return;
      if (!byDate[i.scheduled_date]) byDate[i.scheduled_date] = [];
      byDate[i.scheduled_date].push(i);
    });
    return Object.values(byDate).reduce((sum, dayInts) => sum + getDayWorkInfo(dayInts).minutes, 0);
  }, [techInterventions, mStart, mEnd]);

  const maxDailyMin = Math.max(...dailyHours.map(d => d.minutes), 1);

  if (!tech) return null;

  const completionRate = tech.totalInterventions > 0
    ? Math.round((tech.completedInterventions / tech.totalInterventions) * 100)
    : 0;
  const totalAvgTime = tech.avgTravelTime + tech.avgInterventionTime;

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

            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Taux de complétion</span>
                <span className="font-medium">{completionRate}%</span>
              </div>
              <Progress value={completionRate} className="h-2" />
            </div>

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
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-muted/50 p-3 rounded-lg text-center">
                <p className="text-xs text-muted-foreground mb-1">Aujourd'hui</p>
                <p className="text-xl font-bold">{formatHM(todayMinutes)}</p>
              </div>
              <div className="bg-muted/50 p-3 rounded-lg text-center">
                <p className="text-xs text-muted-foreground mb-1">Semaine</p>
                <p className="text-xl font-bold">{formatHM(weekMinutes)}</p>
              </div>
              <div className="bg-muted/50 p-3 rounded-lg text-center">
                <p className="text-xs text-muted-foreground mb-1">Mois</p>
                <p className="text-xl font-bold">{formatHM(monthMinutes)}</p>
              </div>
            </div>

            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setWeekOffset(o => o - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <p className="text-sm font-medium capitalize">
                    {format(weekStart, "dd MMM", { locale: fr })} — {format(weekEnd, "dd MMM yyyy", { locale: fr })}
                  </p>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setWeekOffset(o => o + 1)} disabled={weekOffset >= 0}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {dailyHours.map(day => (
                    <div key={day.date} className="flex items-center gap-2">
                      <span className={`text-xs w-14 shrink-0 capitalize ${day.date === todayStr ? 'font-bold text-primary' : 'text-muted-foreground'}`}>
                        {day.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground w-[90px] shrink-0 text-center">
                        {day.startTime && day.endTime 
                          ? `${day.startTime} → ${day.endTime}` 
                          : day.startTime 
                            ? `${day.startTime} → …` 
                            : ''}
                      </span>
                      <div className="flex-1 h-6 bg-muted/50 rounded-full overflow-hidden">
                        {day.minutes > 0 && (
                          <div
                            className="h-full bg-primary/80 rounded-full transition-all"
                            style={{ width: `${Math.max((day.minutes / maxDailyMin) * 100, 5)}%` }}
                          />
                        )}
                      </div>
                      <span className={`text-xs w-14 text-right shrink-0 ${day.date === todayStr ? 'font-bold' : ''}`}>
                        {day.minutes > 0 ? formatHM(day.minutes) : '—'}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="border-t pt-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground font-medium">Total semaine</span>
                  <span className="font-bold">{formatHM(weekMinutes)}</span>
                </div>
              </CardContent>
            </Card>

            {weekMinutes === 0 && monthMinutes === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                Aucune donnée de temps enregistrée. Les heures sont calculées du départ trajet jusqu'au retour.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
