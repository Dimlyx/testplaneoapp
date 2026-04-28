import { useEffect, useMemo, useState, useCallback } from "react";
import { MapsChooser, useMapsChooser } from "@/components/technician/MapsChooser";
import { useNavigate } from "react-router-dom";
import { useTechnicianInterventions } from "@/hooks/useInterventions";
import { useClients } from "@/hooks/useClients";
import { useAuth } from "@/lib/auth-context";
import { useOffline } from "@/hooks/useOfflineSync";
import { Card, CardContent } from "@/components/ui/card";
import { TypeBadge } from "@/components/ui/status-badge";
import { Clock, Calendar, MapPin, CalendarOff, CheckCircle2 } from "lucide-react";
import { InterventionDayGroup } from "@/components/technician/InterventionDayGroup";
import type { Intervention } from "@/hooks/useInterventions";
import { markInterventionAsViewed, isInterventionViewed } from "@/lib/intervention-viewed";

function formatTimeRange(time: string, duration?: number | null): string {
  const hhmm = time.substring(0, 5);
  if (!duration) return hhmm;
  const [h, m] = hhmm.split(":").map(Number);
  const endMin = h * 60 + m + duration;
  const endH = String(Math.floor(endMin / 60) % 24).padStart(2, "0");
  const endM = String(endMin % 60).padStart(2, "0");
  return `${hhmm} - ${endH}:${endM}`;
}

type Category = "planning" | "en-cours" | "non-planifie" | "terminees";

function groupByDate(interventions: Intervention[]): Record<string, Intervention[]> {
  const groups: Record<string, Intervention[]> = {};
  interventions.forEach((i) => {
    const key = i.scheduled_date || "no-date";
    if (!groups[key]) groups[key] = [];
    groups[key].push(i);
  });
  return groups;
}

export function TechnicianInterventionsByCategory({ category }: { category: Category }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: interventions = [], isLoading } = useTechnicianInterventions(user?.id);
  const { data: clients = [] } = useClients();
  const { cacheInterventions } = useOffline();
  const mapsChooser = useMapsChooser();
  const [viewedIds, setViewedIds] = useState<Set<string>>(() => {
    const set = new Set<string>();
    interventions.forEach((i) => { if (isInterventionViewed(i.id)) set.add(i.id); });
    return set;
  });

  const handleClick = useCallback((id: string) => {
    markInterventionAsViewed(id);
    setViewedIds((prev) => new Set(prev).add(id));
    navigate(`/technician/interventions/${id}`);
  }, [navigate]);

  useEffect(() => {
    if (interventions.length > 0) cacheInterventions(interventions);
  }, [interventions, cacheInterventions]);

  const getClientName = (clientId: string) =>
    clients.find((c) => c.id === clientId)?.name || "Client";

  const getInterventionAddress = (intervention: Intervention) => {
    // Prioritize intervention-specific address over client address
    if (intervention.intervention_address || intervention.intervention_city) {
      const parts = [
        intervention.intervention_address,
        intervention.intervention_postal_code,
        intervention.intervention_city,
      ].filter(Boolean);
      return parts.join(', ') || null;
    }
    const client = clients.find((c) => c.id === intervention.client_id);
    if (!client) return null;
    return client.address
      ? `${client.address}, ${client.postal_code || ""} ${client.city || ""}`
      : client.city;
  };

  const today = new Date().toISOString().split("T")[0];

  const filtered = useMemo(() => {
    switch (category) {
      case "en-cours":
        return interventions.filter((i) => 
          i.status === "in_progress" || 
          // Show completed interventions with return journey in progress
          (i.status === "completed" && i.travel_return_time && !i.travel_return_arrival_time)
        );
      case "planning":
        return interventions
          .filter((i) => i.status === "planned" && i.scheduled_date)
          .sort((a, b) => a.scheduled_date!.localeCompare(b.scheduled_date!));
      case "non-planifie":
        return interventions.filter((i) => i.status === "to_plan");
      case "terminees":
        return interventions
          .filter((i) => {
            if (["to_invoice", "archived"].includes(i.status)) return true;
            // Completed but with return journey still in progress → show in "en-cours" instead
            if (i.status === "completed" && i.travel_return_time && !i.travel_return_arrival_time) return false;
            return i.status === "completed";
          })
          .sort((a, b) => (b.scheduled_date || "").localeCompare(a.scheduled_date || ""))
          .slice(0, 30);
    }
  }, [interventions, category]);

  const needsDayGroup = category === "planning" || category === "terminees";

  const groups = useMemo(() => (needsDayGroup ? groupByDate(filtered) : {}), [filtered, needsDayGroup]);
  const sortedKeys = useMemo(() => {
    const keys = Object.keys(groups);
    return category === "terminees"
      ? keys.sort((a, b) => {
          if (a === "no-date") return 1;
          if (b === "no-date") return -1;
          return b.localeCompare(a);
        })
      : keys.sort();
  }, [groups, category]);

  const titles: Record<Category, string> = {
    planning: "Planifiées",
    "en-cours": "En cours",
    "non-planifie": "À planifier",
    terminees: "Terminées",
  };

  const emptyIcons: Record<Category, React.ReactNode> = {
    planning: <Calendar className="h-12 w-12" />,
    "en-cours": <Clock className="h-12 w-12" />,
    "non-planifie": <CalendarOff className="h-12 w-12" />,
    terminees: <CheckCircle2 className="h-12 w-12" />,
  };

  const emptyTexts: Record<Category, string> = {
    planning: "Aucune intervention planifiée",
    "en-cours": "Aucune intervention en cours",
    "non-planifie": "Aucune intervention à planifier",
    terminees: "Aucune intervention terminée",
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <>
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{titles[category]}</h1>
        <p className="text-sm text-muted-foreground">
          {filtered.length} intervention{filtered.length > 1 ? "s" : ""}
          {category === "terminees" && " (30 dernières)"}
        </p>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-muted-foreground mx-auto mb-4 flex justify-center">{emptyIcons[category]}</div>
            <p className="text-muted-foreground">{emptyTexts[category]}</p>
          </CardContent>
        </Card>
      ) : needsDayGroup ? (
        <div className="space-y-1">
          {sortedKeys.map((dateKey) => (
            <InterventionDayGroup
              key={dateKey}
              date={dateKey === "no-date" ? null : dateKey}
              interventions={groups[dateKey]}
              getClientName={getClientName}
              getInterventionAddress={getInterventionAddress}
              defaultOpen={category === "planning" && (dateKey === today || sortedKeys[0] === dateKey)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((intervention) => (
            <Card
              key={intervention.id}
              className={`cursor-pointer hover:shadow-md transition-shadow ${
                category === "en-cours" ? "border-l-4 border-l-warning" : ""
              }`}
              onClick={() => handleClick(intervention.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg mt-0.5">
                    <Calendar className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-sm truncate">{intervention.title}</h3>
                        <p className="text-xs text-muted-foreground truncate">
                          {getClientName(intervention.client_id)}
                        </p>
                      </div>
                      {!viewedIds.has(intervention.id) && (
                        <div className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 bg-primary dark:bg-info" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {getClientName(intervention.client_id)}
                    </p>
                    <div className="mt-2 space-y-1">
                      {intervention.scheduled_time && (
                        <div className="flex items-center gap-2 text-xs text-primary font-medium">
                          <Clock className="h-3.5 w-3.5" />
                          {formatTimeRange(intervention.scheduled_time, intervention.estimated_duration)}
                        </div>
                      )}
                      <TypeBadge type={intervention.intervention_type} />
                      {getInterventionAddress(intervention) && (
                        <button
                          type="button"
                          className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                          onClick={(e) => { e.stopPropagation(); mapsChooser.openMaps(getInterventionAddress(intervention)!); }}
                        >
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{getInterventionAddress(intervention)}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
    <MapsChooser address={mapsChooser.address} open={mapsChooser.open} onOpenChange={mapsChooser.setOpen} />
    </>
  );
}
