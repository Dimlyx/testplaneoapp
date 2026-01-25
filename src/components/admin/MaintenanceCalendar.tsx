import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, parseISO, addMonths, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { MaintenanceAlert, AlertStatus } from '@/hooks/useMaintenanceAlerts';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MaintenanceCalendarProps {
  alerts: MaintenanceAlert[];
  onAlertClick?: (alert: MaintenanceAlert) => void;
}

const statusColors: Record<AlertStatus, string> = {
  pending: 'bg-amber-500',
  acknowledged: 'bg-blue-500',
  completed: 'bg-green-500',
  dismissed: 'bg-gray-400',
};

const statusLabels: Record<AlertStatus, string> = {
  pending: 'En attente',
  acknowledged: 'Pris en compte',
  completed: 'Terminé',
  dismissed: 'Ignoré',
};

export function MaintenanceCalendar({ alerts, onAlertClick }: MaintenanceCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get day of week for the first day (0 = Sunday, 1 = Monday, etc.)
  // In French locale, week starts on Monday, so we adjust
  const startDayOfWeek = monthStart.getDay();
  const adjustedStartDay = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

  // Create empty slots for days before the first day of the month
  const emptyDays = Array.from({ length: adjustedStartDay }, (_, i) => i);

  // Group alerts by date
  const alertsByDate = useMemo(() => {
    const map = new Map<string, MaintenanceAlert[]>();
    alerts.forEach(alert => {
      const dateKey = alert.alert_date;
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(alert);
    });
    return map;
  }, [alerts]);

  // Get alerts for current month
  const monthAlerts = useMemo(() => {
    return alerts.filter(alert => {
      const alertDate = parseISO(alert.alert_date);
      return isSameMonth(alertDate, currentMonth);
    });
  }, [alerts, currentMonth]);

  // Summary counts for the month
  const monthSummary = useMemo(() => {
    const pending = monthAlerts.filter(a => a.status === 'pending').length;
    const acknowledged = monthAlerts.filter(a => a.status === 'acknowledged').length;
    const completed = monthAlerts.filter(a => a.status === 'completed' || a.status === 'dismissed').length;
    return { pending, acknowledged, completed, total: monthAlerts.length };
  }, [monthAlerts]);

  const goToPreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const goToCurrentMonth = () => setCurrentMonth(new Date());

  const weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Vue Calendrier
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={goToCurrentMonth} className="min-w-[160px]">
              {format(currentMonth, 'MMMM yyyy', { locale: fr })}
            </Button>
            <Button variant="outline" size="icon" onClick={goToNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Month summary */}
        <div className="flex flex-wrap gap-2 mt-3">
          <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100">
            {monthSummary.pending} en attente
          </Badge>
          <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100">
            {monthSummary.acknowledged} pris en compte
          </Badge>
          <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100">
            {monthSummary.completed} terminées
          </Badge>
          <Badge variant="outline">
            {monthSummary.total} total
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Week day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map(day => (
            <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells for alignment */}
          {emptyDays.map(i => (
            <div key={`empty-${i}`} className="min-h-[80px] p-1" />
          ))}

          {/* Days of the month */}
          {daysInMonth.map(day => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayAlerts = alertsByDate.get(dateKey) || [];
            const hasAlerts = dayAlerts.length > 0;
            const activeAlerts = dayAlerts.filter(a => a.status === 'pending' || a.status === 'acknowledged');

            return (
              <div
                key={dateKey}
                className={cn(
                  "min-h-[80px] p-1 border rounded-md transition-colors",
                  isToday(day) && "border-primary bg-primary/5",
                  !isToday(day) && "border-border hover:bg-muted/50"
                )}
              >
                <div className={cn(
                  "text-sm font-medium mb-1 text-center",
                  isToday(day) && "text-primary"
                )}>
                  {format(day, 'd')}
                </div>

                {hasAlerts && (
                  <div className="space-y-1">
                    <TooltipProvider>
                      {dayAlerts.slice(0, 2).map(alert => (
                        <Tooltip key={alert.id}>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => onAlertClick?.(alert)}
                              className={cn(
                                "w-full text-left text-xs p-1 rounded truncate transition-opacity",
                                statusColors[alert.status],
                                "text-white hover:opacity-80"
                              )}
                            >
                              {alert.title}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-[250px]">
                            <div className="space-y-1">
                              <p className="font-medium">{alert.title}</p>
                              {alert.clients?.name && (
                                <p className="text-sm text-muted-foreground">Client: {alert.clients.name}</p>
                              )}
                              <p className="text-sm">Statut: {statusLabels[alert.status]}</p>
                              {alert.description && (
                                <p className="text-sm text-muted-foreground">{alert.description}</p>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </TooltipProvider>
                    
                    {dayAlerts.length > 2 && (
                      <div className="text-xs text-muted-foreground text-center">
                        +{dayAlerts.length - 2} autres
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t text-sm">
          <div className="flex items-center gap-2">
            <div className={cn("w-3 h-3 rounded", statusColors.pending)} />
            <span>En attente</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn("w-3 h-3 rounded", statusColors.acknowledged)} />
            <span>Pris en compte</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn("w-3 h-3 rounded", statusColors.completed)} />
            <span>Terminé</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn("w-3 h-3 rounded", statusColors.dismissed)} />
            <span>Ignoré</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
