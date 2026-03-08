import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTechnicianInterventions } from "@/hooks/useInterventions";
import { useClients } from "@/hooks/useClients";
import { useAuth } from "@/lib/auth-context";
import { useOffline } from "@/hooks/useOfflineSync";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TypeBadge } from "@/components/ui/status-badge";
import { Clock, Calendar, MapPin, CalendarOff, CheckCircle2 } from "lucide-react";
import { InterventionDayGroup } from "@/components/technician/InterventionDayGroup";
import type { Intervention } from "@/hooks/useInterventions";

function groupByDate(interventions: Intervention[]): Record<string, Intervention[]> {
  const groups: Record<string, Intervention[]> = {};
  interventions.forEach((i) => {
    const key = i.scheduled_date || "no-date";
    if (!groups[key]) groups[key] = [];
    groups[key].push(i);
  });
  return groups;
}

const TechnicianInterventions = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: interventions = [], isLoading } = useTechnicianInterventions(user?.id);
  const { data: clients = [] } = useClients();
  const { cacheInterventions } = useOffline();

  useEffect(() => {
    if (interventions.length > 0) cacheInterventions(interventions);
  }, [interventions, cacheInterventions]);

  const getClientName = (clientId: string) =>
    clients.find((c) => c.id === clientId)?.name || "Client";

  const getClientAddress = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    if (!client) return null;
    return client.address
      ? `${client.address}, ${client.postal_code || ""} ${client.city || ""}`
      : client.city;
  };

  const today = new Date().toISOString().split("T")[0];

  const inProgress = useMemo(() => interventions.filter((i) => i.status === "in_progress"), [interventions]);

  const planned = useMemo(
    () =>
      interventions
        .filter((i) => i.status === "planned" && i.scheduled_date)
        .sort((a, b) => a.scheduled_date!.localeCompare(b.scheduled_date!)),
    [interventions]
  );

  const unplanned = useMemo(() => interventions.filter((i) => i.status === "to_plan"), [interventions]);

  const completed = useMemo(
    () =>
      interventions
        .filter((i) => ["completed", "to_invoice", "archived"].includes(i.status))
        .sort((a, b) => {
          const dA = a.scheduled_date || "";
          const dB = b.scheduled_date || "";
          return dB.localeCompare(dA);
        })
        .slice(0, 30),
    [interventions]
  );

  const plannedGroups = useMemo(() => groupByDate(planned), [planned]);
  const plannedKeys = useMemo(() => Object.keys(plannedGroups).sort(), [plannedGroups]);

  const completedGroups = useMemo(() => groupByDate(completed), [completed]);
  const completedKeys = useMemo(
    () =>
      Object.keys(completedGroups).sort((a, b) => {
        if (a === "no-date") return 1;
        if (b === "no-date") return -1;
        return b.localeCompare(a);
      }),
    [completedGroups]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const InterventionCard = ({
    intervention,
    accentClass = "",
  }: {
    intervention: Intervention;
    accentClass?: string;
  }) => (
    <Card
      className={`cursor-pointer hover:shadow-md transition-shadow ${accentClass}`}
      onClick={() => navigate(`/technician/interventions/${intervention.id}`)}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-primary/10 rounded-lg mt-0.5">
            <Calendar className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{intervention.title}</h3>
            <p className="text-xs text-muted-foreground truncate">
              {getClientName(intervention.client_id)}
            </p>
            <div className="mt-2 space-y-1">
              {intervention.scheduled_time && (
                <div className="flex items-center gap-2 text-xs text-primary font-medium">
                  <Clock className="h-3.5 w-3.5" />
                  {intervention.scheduled_time}
                </div>
              )}
              <TypeBadge type={intervention.intervention_type} />
              {getClientAddress(intervention.client_id) && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate">{getClientAddress(intervention.client_id)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">Mes Interventions</h1>

      <Tabs defaultValue="planning" className="w-full">
        <TabsList className="w-full grid grid-cols-4 h-auto">
          <TabsTrigger value="in_progress" className="flex flex-col gap-0.5 py-2 text-xs">
            <Clock className="h-4 w-4" />
            <span>En cours</span>
            {inProgress.length > 0 && (
              <span className="text-[10px] font-bold bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center">
                {inProgress.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="planning" className="flex flex-col gap-0.5 py-2 text-xs">
            <Calendar className="h-4 w-4" />
            <span>Planning</span>
            {planned.length > 0 && (
              <span className="text-[10px] font-bold bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center">
                {planned.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="unplanned" className="flex flex-col gap-0.5 py-2 text-xs">
            <CalendarOff className="h-4 w-4" />
            <span>Non planifié</span>
            {unplanned.length > 0 && (
              <span className="text-[10px] font-bold bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center">
                {unplanned.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex flex-col gap-0.5 py-2 text-xs">
            <CheckCircle2 className="h-4 w-4" />
            <span>Terminées</span>
          </TabsTrigger>
        </TabsList>

        {/* En cours */}
        <TabsContent value="in_progress" className="mt-4 space-y-3">
          {inProgress.length === 0 ? (
            <EmptyState icon={<Clock className="h-12 w-12" />} text="Aucune intervention en cours" />
          ) : (
            inProgress.map((i) => (
              <InterventionCard key={i.id} intervention={i} accentClass="border-l-4 border-l-yellow-500" />
            ))
          )}
        </TabsContent>

        {/* Planning */}
        <TabsContent value="planning" className="mt-4 space-y-1">
          {plannedKeys.length === 0 ? (
            <EmptyState icon={<Calendar className="h-12 w-12" />} text="Aucune intervention planifiée" />
          ) : (
            plannedKeys.map((dateKey) => (
              <InterventionDayGroup
                key={dateKey}
                date={dateKey}
                interventions={plannedGroups[dateKey]}
                getClientName={getClientName}
                getClientAddress={getClientAddress}
                defaultOpen={dateKey === today || plannedKeys[0] === dateKey}
              />
            ))
          )}
        </TabsContent>

        {/* Non planifié */}
        <TabsContent value="unplanned" className="mt-4 space-y-3">
          {unplanned.length === 0 ? (
            <EmptyState icon={<CalendarOff className="h-12 w-12" />} text="Aucune intervention non planifiée" />
          ) : (
            unplanned.map((i) => <InterventionCard key={i.id} intervention={i} />)
          )}
        </TabsContent>

        {/* Terminées */}
        <TabsContent value="completed" className="mt-4 space-y-1">
          {completedKeys.length === 0 ? (
            <EmptyState icon={<CheckCircle2 className="h-12 w-12" />} text="Aucune intervention terminée" />
          ) : (
            <>
              <p className="text-xs text-muted-foreground px-2 mb-2">30 dernières interventions</p>
              {completedKeys.map((dateKey) => (
                <InterventionDayGroup
                  key={dateKey}
                  date={dateKey === "no-date" ? today : dateKey}
                  interventions={completedGroups[dateKey]}
                  getClientName={getClientName}
                  getClientAddress={getClientAddress}
                />
              ))}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <div className="text-muted-foreground mx-auto mb-4 flex justify-center">{icon}</div>
        <p className="text-muted-foreground">{text}</p>
      </CardContent>
    </Card>
  );
}

export default TechnicianInterventions;
