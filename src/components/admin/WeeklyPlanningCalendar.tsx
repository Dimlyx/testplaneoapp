import { useState, useMemo, DragEvent } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Plus, Minus, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, isSameDay, parseISO, isToday, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Intervention, useUpdateIntervention } from '@/hooks/useInterventions';
import { useInterventionTypes } from '@/hooks/useInterventionTypes';
import { useCustomStatuses } from '@/hooks/useCustomStatuses';
import { Technician } from '@/hooks/useTechnicians';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface WeeklyPlanningCalendarProps {
  interventions: Intervention[];
  technicians: Technician[];
  onCellClick?: (technicianId: string, date: Date) => void;
  onInterventionClick?: (intervention: Intervention) => void;
}

const defaultTypeColors: Record<string, string> = {
  red: 'bg-red-600',
  blue: 'bg-blue-600',
  green: 'bg-green-600',
  yellow: 'bg-yellow-600',
  purple: 'bg-purple-600',
  orange: 'bg-orange-600',
  pink: 'bg-pink-600',
  gray: 'bg-gray-600',
};

export function WeeklyPlanningCalendar({ 
  interventions, 
  technicians, 
  onCellClick,
  onInterventionClick 
}: WeeklyPlanningCalendarProps) {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [expandedTechnicians, setExpandedTechnicians] = useState<Set<string>>(new Set());
  const [draggedIntervention, setDraggedIntervention] = useState<Intervention | null>(null);
  const [startHour, setStartHour] = useState(7);
  const [endHour, setEndHour] = useState(18);
  
  const updateIntervention = useUpdateIntervention();
  const { data: interventionTypesData = [] } = useInterventionTypes();
  const { data: customStatuses = [] } = useCustomStatuses();

  const getTypeColor = (typeName: string) => {
    const found = interventionTypesData.find(t => t.name === typeName);
    return found ? (defaultTypeColors[found.color] || 'bg-gray-600') : 'bg-gray-600';
  };

  const defaultStatusColors: Record<string, string> = {
    to_plan: '#f59e0b',
    planned: '#3b82f6',
    in_progress: '#8b5cf6',
    completed: '#10b981',
    to_invoice: '#f97316',
    archived: '#6b7280',
  };

  const getStatusBorderStyle = (intervention: Intervention): React.CSSProperties => {
    if (intervention.custom_status_id) {
      const custom = customStatuses.find(s => s.id === intervention.custom_status_id);
      if (custom) return { border: `2.5px solid ${custom.color}`, boxShadow: `0 0 6px ${custom.color}40` };
    }
    const color = defaultStatusColors[intervention.status] || '#6b7280';
    return { border: `2.5px solid ${color}`, boxShadow: `0 0 6px ${color}40` };
  };

  const getTypeLabel = (typeName: string) => {
    const found = interventionTypesData.find(t => t.name === typeName);
    return found ? found.label : typeName;
  };

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Group interventions by technician and date
  const interventionsByTechAndDate = useMemo(() => {
    const map = new Map<string, Map<string, Intervention[]>>();
    
    interventions.forEach(intervention => {
      if (!intervention.scheduled_date) return;
      
      const techId = intervention.technician_id || 'unassigned';
      const dateKey = intervention.scheduled_date;
      
      if (!map.has(techId)) {
        map.set(techId, new Map());
      }
      const techMap = map.get(techId)!;
      
      if (!techMap.has(dateKey)) {
        techMap.set(dateKey, []);
      }
      techMap.get(dateKey)!.push(intervention);
    });
    
    // Sort interventions by time within each day
    map.forEach(techMap => {
      techMap.forEach(dayInterventions => {
        dayInterventions.sort((a, b) => {
          const timeA = a.scheduled_time || '00:00';
          const timeB = b.scheduled_time || '00:00';
          return timeA.localeCompare(timeB);
        });
      });
    });
    
    return map;
  }, [interventions]);

  const goToPreviousWeek = () => setCurrentWeek(subWeeks(currentWeek, 1));
  const goToNextWeek = () => setCurrentWeek(addWeeks(currentWeek, 1));
  const goToCurrentWeek = () => setCurrentWeek(new Date());

  const toggleTechnician = (techId: string) => {
    setExpandedTechnicians(prev => {
      const newSet = new Set(prev);
      if (newSet.has(techId)) {
        newSet.delete(techId);
      } else {
        newSet.add(techId);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    setExpandedTechnicians(new Set(technicians.map(t => t.id)));
  };

  const collapseAll = () => {
    setExpandedTechnicians(new Set());
  };

  const handleDragStart = (e: DragEvent<HTMLDivElement>, intervention: Intervention) => {
    setDraggedIntervention(intervention);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', intervention.id);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>, technicianId: string, date: Date) => {
    e.preventDefault();
    
    if (!draggedIntervention) return;
    
    const newDate = format(date, 'yyyy-MM-dd');
    const hasChanged = 
      draggedIntervention.technician_id !== technicianId ||
      draggedIntervention.scheduled_date !== newDate;
    
    if (hasChanged) {
      updateIntervention.mutate({
        id: draggedIntervention.id,
        technician_id: technicianId,
        scheduled_date: newDate,
      });
    }
    
    setDraggedIntervention(null);
  };

  const handleDragEnd = () => {
    setDraggedIntervention(null);
  };

  const getInterventionsForCell = (techId: string, date: Date): Intervention[] => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return interventionsByTechAndDate.get(techId)?.get(dateKey) || [];
  };

  const hasAnyExpanded = expandedTechnicians.size > 0;
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => i + startHour);
  const allHourOptions = Array.from({ length: 24 }, (_, i) => i);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Planning Hebdomadaire
          </CardTitle>
          
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 mr-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <Select value={String(startHour)} onValueChange={(v) => { const h = Number(v); setStartHour(h); if (h >= endHour) setEndHour(h + 1); }}>
                <SelectTrigger className="w-[72px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allHourOptions.filter(h => h < endHour).map(h => (
                    <SelectItem key={h} value={String(h)}>{String(h).padStart(2, '0')}:00</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">à</span>
              <Select value={String(endHour)} onValueChange={(v) => { const h = Number(v); setEndHour(h); if (h <= startHour) setStartHour(h - 1); }}>
                <SelectTrigger className="w-[72px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allHourOptions.filter(h => h > startHour).map(h => (
                    <SelectItem key={h} value={String(h)}>{String(h).padStart(2, '0')}:00</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-1 mr-4">
              <Button variant="outline" size="sm" onClick={expandAll}>
                <Plus className="h-4 w-4 mr-1" />
                Tout
              </Button>
              <Button variant="outline" size="sm" onClick={collapseAll}>
                <Minus className="h-4 w-4 mr-1" />
                Tout
              </Button>
            </div>
            
            <Button variant="outline" size="icon" onClick={goToPreviousWeek}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={goToCurrentWeek} className="min-w-[200px]">
              Semaine du {format(weekStart, 'd MMM', { locale: fr })} au {format(weekEnd, 'd MMM yyyy', { locale: fr })}
            </Button>
            <Button variant="outline" size="icon" onClick={goToNextWeek}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="overflow-x-auto">
        <div className="min-w-[1000px]">
          {/* Header with days */}
          <div className="grid grid-cols-[150px_repeat(7,1fr)] border-b">
            <div className="p-2 font-medium text-sm border-r bg-muted/50">
              {hasAnyExpanded && <span className="text-xs text-muted-foreground">Heures</span>}
            </div>
            {daysInWeek.map(day => (
              <div 
                key={day.toISOString()} 
                className={cn(
                  "p-2 text-center border-r last:border-r-0",
                  isToday(day) && "bg-primary/10"
                )}
              >
                <div className="font-medium text-sm capitalize">
                  {format(day, 'EEEE', { locale: fr })}
                </div>
                <div className={cn(
                  "text-xs text-muted-foreground",
                  isToday(day) && "text-primary font-medium"
                )}>
                  {format(day, 'd MMM yyyy', { locale: fr })}
                </div>
              </div>
            ))}
          </div>

          {/* Technician rows */}
          {technicians.map(tech => {
            const isExpanded = expandedTechnicians.has(tech.id);
            const techInterventionsThisWeek = daysInWeek.reduce((acc, day) => {
              return acc + getInterventionsForCell(tech.id, day).length;
            }, 0);
            
            return (
              <div key={tech.id} className="border-b last:border-b-0">
                {/* Technician name row */}
                <div className="grid grid-cols-[150px_repeat(7,1fr)]">
                  <div 
                    className="p-2 border-r bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => toggleTechnician(tech.id)}
                  >
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                        {isExpanded ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                      </Button>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {tech.full_name || tech.email}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {techInterventionsThisWeek} intervention{techInterventionsThisWeek !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="mt-2 space-y-0">
                        {hours.map(hour => (
                          <div key={hour} className="h-[28px] flex items-center border-t border-border/30 first:border-t-0">
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {String(hour).padStart(2, '0')}:00
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Day cells */}
                  {daysInWeek.map(day => {
                    const cellInterventions = getInterventionsForCell(tech.id, day);
                    const isDragOver = draggedIntervention !== null;
                    
                    return (
                      <div
                        key={day.toISOString()}
                        className={cn(
                          "border-r last:border-r-0 transition-colors",
                          isToday(day) && "bg-primary/5",
                          !isExpanded && "min-h-[60px] p-0.5",
                          isDragOver && "hover:bg-primary/10"
                        )}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, tech.id, day)}
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest('.intervention-card')) return;
                          onCellClick?.(tech.id, day);
                        }}
                      >
                        {isExpanded ? (
                          <div className="relative">
                            {/* Hour grid lines */}
                            <div className="mt-2">
                              {hours.map(hour => (
                                <div key={hour} className="h-[28px] border-t border-border/30 first:border-t-0" />
                              ))}
                            </div>
                            {/* Interventions positioned by time */}
                            <div className="absolute inset-0 mt-2 px-0.5">
                              <TooltipProvider>
                                {cellInterventions.map(intervention => {
                                  const time = intervention.scheduled_time || `${String(startHour).padStart(2, '0')}:00`;
                                  const [h, m] = time.split(':').map(Number);
                                  const hourIndex = Math.max(0, Math.min(h - startHour, hours.length - 1));
                                  const topPx = hourIndex * 28 + (m / 60) * 28;
                                  const durationMin = intervention.estimated_duration || 30;
                                  const heightPx = Math.max(24, (durationMin / 60) * 28);
                                  
                                  return (
                                    <Tooltip key={intervention.id}>
                                      <TooltipTrigger asChild>
                                        <div
                                          className={cn(
                                            "intervention-card absolute left-0.5 right-0.5 text-xs p-1 rounded cursor-pointer text-white truncate transition-opacity z-10 overflow-hidden",
                                            getTypeColor(intervention.intervention_type),
                                            draggedIntervention?.id === intervention.id && "opacity-50"
                                          )}
                                          style={{ top: `${topPx}px`, height: `${heightPx}px`, minHeight: '24px', ...getCustomStatusBorderStyle(intervention) }}
                                          draggable
                                          onDragStart={(e) => handleDragStart(e, intervention)}
                                          onDragEnd={handleDragEnd}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onInterventionClick?.(intervention);
                                          }}
                                        >
                                          <div className="font-medium truncate text-[10px]">
                                            {intervention.scheduled_time?.slice(0, 5)} {intervention.title}
                                          </div>
                                          {heightPx > 30 && intervention.estimated_duration && (
                                            <div className="text-[9px] opacity-80">{intervention.estimated_duration} min</div>
                                          )}
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent side="right" className="max-w-[250px]">
                                        <div className="space-y-1">
                                          <p className="font-medium">{intervention.title}</p>
                                          <Badge variant="secondary" className="text-xs">
                                            {getTypeLabel(intervention.intervention_type)}
                                          </Badge>
                                          {intervention.clients?.name && (
                                            <p className="text-sm">Client: {intervention.clients.name}</p>
                                          )}
                                          {intervention.scheduled_time && (
                                            <p className="text-sm">Heure: {intervention.scheduled_time.slice(0, 5)}</p>
                                          )}
                                          {intervention.estimated_duration && (
                                            <p className="text-sm">Durée: {intervention.estimated_duration} min</p>
                                          )}
                                          {intervention.intervention_city && (
                                            <p className="text-sm text-muted-foreground">{intervention.intervention_city}</p>
                                          )}
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  );
                                })}
                              </TooltipProvider>
                            </div>
                          </div>
                        ) : (
                          <div className="h-full flex items-center justify-center gap-0.5 flex-wrap">
                            {cellInterventions.map(intervention => (
                              <div
                                key={intervention.id}
                                className={cn(
                                  "w-2.5 h-2.5 rounded-full",
                                  getTypeColor(intervention.intervention_type)
                                )}
                                style={intervention.custom_status_id ? {
                                  ...(() => { const c = customStatuses.find(s => s.id === intervention.custom_status_id); return c ? { outline: `2px solid ${c.color}`, outlineOffset: '1px' } : {}; })()
                                } : {}}
                                title={intervention.title}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Unassigned row */}
          {(() => {
            const unassignedInterventionsThisWeek = daysInWeek.reduce((acc, day) => {
              return acc + getInterventionsForCell('unassigned', day).length;
            }, 0);
            
            if (unassignedInterventionsThisWeek === 0) return null;
            
            return (
              <div className="border-t-2 border-amber-400">
                <div className="grid grid-cols-[150px_repeat(7,1fr)]">
                  <div className="p-2 border-r bg-amber-50 dark:bg-amber-950/20">
                    <div className="font-medium text-sm text-amber-700 dark:text-amber-400">
                      Non assignées
                    </div>
                    <div className="text-xs text-amber-600 dark:text-amber-500">
                      {unassignedInterventionsThisWeek} intervention{unassignedInterventionsThisWeek !== 1 ? 's' : ''}
                    </div>
                  </div>
                  
                  {daysInWeek.map(day => {
                    const cellInterventions = getInterventionsForCell('unassigned', day);
                    
                    return (
                      <div
                        key={day.toISOString()}
                        className={cn(
                          "border-r last:border-r-0 p-1 min-h-[60px] bg-amber-50/50 dark:bg-amber-950/10",
                          isToday(day) && "bg-amber-100/50 dark:bg-amber-900/20"
                        )}
                      >
                        <div className="space-y-1">
                          <TooltipProvider>
                            {cellInterventions.map(intervention => (
                              <Tooltip key={intervention.id}>
                                <TooltipTrigger asChild>
                                  <div
                                    className={cn(
                                      "intervention-card text-xs p-1.5 rounded cursor-pointer text-white truncate border-2 border-dashed border-amber-400",
                                      getTypeColor(intervention.intervention_type),
                                      draggedIntervention?.id === intervention.id && "opacity-50"
                                    )}
                                    style={getCustomStatusBorderStyle(intervention)}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, intervention)}
                                    onDragEnd={handleDragEnd}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onInterventionClick?.(intervention);
                                    }}
                                  >
                                    <div className="font-medium truncate">
                                      {intervention.title}
                                    </div>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-[250px]">
                                  <div className="space-y-1">
                                    <p className="font-medium">{intervention.title}</p>
                                    <p className="text-sm text-amber-600">⚠️ Non assignée</p>
                                    {intervention.clients?.name && (
                                      <p className="text-sm">Client: {intervention.clients.name}</p>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            ))}
                          </TooltipProvider>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t text-sm">
          {interventionTypesData.map((t) => (
            <div key={t.id} className="flex items-center gap-2">
              <div className={cn("w-3 h-3 rounded", defaultTypeColors[t.color] || 'bg-gray-600')} />
              <span>{t.label}</span>
            </div>
          ))}
          <div className="text-muted-foreground">
            | Glissez-déposez pour réassigner
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
