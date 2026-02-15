import { useState, useMemo } from "react";
import { useInterventions, Intervention } from "@/hooks/useInterventions";
import { useTechnicians } from "@/hooks/useTechnicians";
import { useClients } from "@/hooks/useClients";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge, TypeBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock, MapPin, User, LayoutGrid, List } from "lucide-react";
import { format, isSameDay, parseISO, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { fr } from "date-fns/locale";
import { Link, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { WeeklyPlanningCalendar } from "@/components/admin/WeeklyPlanningCalendar";
import { QuickInterventionDialog } from "@/components/admin/QuickInterventionDialog";

const AdminCalendar = () => {
  const { data: interventions = [], isLoading: loadingInterventions } = useInterventions();
  const { data: organizationId } = useUserOrganization();
  const { data: technicians = [], isLoading: loadingTechnicians } = useTechnicians(organizationId);
  const { data: clients = [] } = useClients();
  const navigate = useNavigate();
  
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [technicianFilter, setTechnicianFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<string>("calendar");
  
  // Quick intervention dialog state
  const [quickDialogOpen, setQuickDialogOpen] = useState(false);
  const [quickDialogTechId, setQuickDialogTechId] = useState<string | undefined>();
  const [quickDialogDate, setQuickDialogDate] = useState<Date | undefined>();

  // Filter interventions by technician
  const filteredInterventions = useMemo(() => {
    return interventions.filter((intervention) => {
      if (technicianFilter === "all") return true;
      if (technicianFilter === "unassigned") return !intervention.technician_id;
      return intervention.technician_id === technicianFilter;
    });
  }, [interventions, technicianFilter]);

  // Get interventions for selected date
  const selectedDateInterventions = useMemo(() => {
    if (!selectedDate) return [];
    return filteredInterventions.filter((intervention) => {
      if (!intervention.scheduled_date) return false;
      return isSameDay(parseISO(intervention.scheduled_date), selectedDate);
    });
  }, [filteredInterventions, selectedDate]);

  // Get dates with interventions for calendar highlighting
  const datesWithInterventions = useMemo(() => {
    const dateMap = new Map<string, { count: number; hasUrgent: boolean }>();
    
    filteredInterventions.forEach((intervention) => {
      if (intervention.scheduled_date) {
        const dateKey = intervention.scheduled_date;
        const existing = dateMap.get(dateKey) || { count: 0, hasUrgent: false };
        dateMap.set(dateKey, {
          count: existing.count + 1,
          hasUrgent: existing.hasUrgent || intervention.status === 'to_plan',
        });
      }
    });
    
    return dateMap;
  }, [filteredInterventions]);

  const getTechnicianName = (technicianId: string | null) => {
    if (!technicianId) return "Non assigné";
    const technician = technicians.find((t) => t.id === technicianId);
    return technician?.full_name || technician?.email || "Inconnu";
  };

  const getClientName = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    return client?.name || "Client inconnu";
  };

  const handleCellClick = (technicianId: string, date: Date) => {
    setQuickDialogTechId(technicianId);
    setQuickDialogDate(date);
    setQuickDialogOpen(true);
  };

  const handleInterventionClick = (intervention: Intervention) => {
    navigate(`/admin/interventions/${intervention.id}`);
  };

  if (loadingInterventions || loadingTechnicians) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Calendrier</h1>
          <p className="text-muted-foreground">Planning des interventions</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Tabs value={viewMode} onValueChange={setViewMode}>
            <TabsList>
              <TabsTrigger value="planning" className="flex items-center gap-1">
                <LayoutGrid className="h-4 w-4" />
                Planning
              </TabsTrigger>
              <TabsTrigger value="calendar" className="flex items-center gap-1">
                <CalendarDays className="h-4 w-4" />
                Calendrier
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          {viewMode === "calendar" && (
            <Select value={technicianFilter} onValueChange={setTechnicianFilter}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Filtrer par technicien" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les techniciens</SelectItem>
                <SelectItem value="unassigned">Non assignées</SelectItem>
                {technicians.map((tech) => (
                  <SelectItem key={tech.id} value={tech.id}>
                    {tech.full_name || tech.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {viewMode === "planning" ? (
        <WeeklyPlanningCalendar
          interventions={interventions}
          technicians={technicians}
          onCellClick={handleCellClick}
          onInterventionClick={handleInterventionClick}
        />
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
            {/* Calendar */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5" />
                  Sélectionner une date
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  onMonthChange={setSelectedMonth}
                  locale={fr}
                  className="rounded-md border pointer-events-auto"
                  modifiers={{
                    hasIntervention: (date) => {
                      const dateKey = format(date, 'yyyy-MM-dd');
                      return datesWithInterventions.has(dateKey);
                    },
                  }}
                  modifiersStyles={{
                    hasIntervention: {
                      fontWeight: 'bold',
                      backgroundColor: 'hsl(var(--primary) / 0.1)',
                      borderRadius: '50%',
                    },
                  }}
                  components={{
                    DayContent: ({ date }) => {
                      const dateKey = format(date, 'yyyy-MM-dd');
                      const info = datesWithInterventions.get(dateKey);
                      
                      return (
                        <div className="relative w-full h-full flex items-center justify-center">
                          <span>{date.getDate()}</span>
                          {info && (
                            <span 
                              className={cn(
                                "absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full",
                                info.hasUrgent ? "bg-amber-500" : "bg-primary"
                              )}
                            />
                          )}
                        </div>
                      );
                    },
                  }}
                />
                
                {/* Legend */}
                <div className="mt-4 flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-primary" />
                    <span className="text-muted-foreground">Interventions planifiées</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-amber-500" />
                    <span className="text-muted-foreground">À planifier</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Interventions list for selected date */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {selectedDate 
                    ? format(selectedDate, "EEEE d MMMM yyyy", { locale: fr })
                    : "Sélectionnez une date"
                  }
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedDateInterventions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Aucune intervention planifiée pour cette date</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selectedDateInterventions.map((intervention) => (
                      <Link
                        key={intervention.id}
                        to={`/admin/interventions/${intervention.id}`}
                        className="block"
                      >
                        <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                          <CardContent className="p-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="font-semibold">{intervention.title}</h3>
                                  <TypeBadge type={intervention.intervention_type} />
                                  <StatusBadge status={intervention.status} />
                                </div>
                                
                                <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-sm text-muted-foreground">
                                  {intervention.scheduled_time && (
                                    <div className="flex items-center gap-1">
                                      <Clock className="h-4 w-4" />
                                      {intervention.scheduled_time}
                                    </div>
                                  )}
                                  <div className="flex items-center gap-1">
                                    <User className="h-4 w-4" />
                                    {getClientName(intervention.client_id)}
                                  </div>
                                  {(intervention.intervention_city || intervention.intervention_address) && (
                                    <div className="flex items-center gap-1">
                                      <MapPin className="h-4 w-4" />
                                      {intervention.intervention_city || intervention.intervention_address}
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              <Badge variant="outline" className="shrink-0">
                                {getTechnicianName(intervention.technician_id)}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Monthly overview */}
          <Card>
            <CardHeader>
              <CardTitle>
                Aperçu du mois - {format(selectedMonth, "MMMM yyyy", { locale: fr })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {technicians.map((tech) => {
                  const techInterventions = filteredInterventions.filter((i) => {
                    if (!i.scheduled_date) return false;
                    const date = parseISO(i.scheduled_date);
                    return (
                      i.technician_id === tech.id &&
                      date >= startOfMonth(selectedMonth) &&
                      date <= endOfMonth(selectedMonth)
                    );
                  });
                  
                  return (
                    <div key={tech.id} className="p-3 border rounded-lg">
                      <div className="font-medium truncate">{tech.full_name || tech.email}</div>
                      <div className="text-2xl font-bold text-primary">{techInterventions.length}</div>
                      <div className="text-xs text-muted-foreground">interventions ce mois</div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Quick intervention dialog */}
      <QuickInterventionDialog
        open={quickDialogOpen}
        onOpenChange={setQuickDialogOpen}
        defaultTechnicianId={quickDialogTechId}
        defaultDate={quickDialogDate}
        technicians={technicians}
      />
    </div>
  );
};

export default AdminCalendar;
