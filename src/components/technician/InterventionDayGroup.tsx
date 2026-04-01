import { useState, useCallback } from "react";
import { openAddressInMaps } from "@/lib/maps-utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronDown, ChevronUp, Calendar, Clock, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { TypeBadge } from "@/components/ui/status-badge";
import { useNavigate } from "react-router-dom";
import type { Intervention } from "@/hooks/useInterventions";
import { markInterventionAsViewed, isInterventionViewed } from "@/lib/intervention-viewed";

interface InterventionDayGroupProps {
  date: string;
  interventions: Intervention[];
  getClientName: (clientId: string) => string;
  getInterventionAddress: (intervention: Intervention) => string | null;
  defaultOpen?: boolean;
}

export const InterventionDayGroup = ({
  date,
  interventions,
  getClientName,
  getInterventionAddress,
  defaultOpen = false,
}: InterventionDayGroupProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [viewedIds, setViewedIds] = useState<Set<string>>(() => {
    const set = new Set<string>();
    interventions.forEach((i) => { if (isInterventionViewed(i.id)) set.add(i.id); });
    return set;
  });
  const navigate = useNavigate();

  const handleClick = useCallback((id: string) => {
    markInterventionAsViewed(id);
    setViewedIds((prev) => new Set(prev).add(id));
    navigate(`/technician/interventions/${id}`);
  }, [navigate]);

  const dayLabel = format(new Date(date + "T00:00:00"), "EEEE dd MMMM yyyy", { locale: fr }).toUpperCase();

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-3 px-2 hover:bg-muted/50 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {dayLabel}
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span className="text-sm font-medium">{interventions.length}</span>
        </div>
      </button>

      {isOpen && (
        <div className="space-y-3 pl-2 pr-1 pb-4">
          {interventions.map((intervention) => (
            <Card
              key={intervention.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
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
                    <div className="mt-2 space-y-1">
                      {intervention.scheduled_time && (
                        <div className="flex items-center gap-2 text-xs text-primary font-medium">
                          <Clock className="h-3.5 w-3.5" />
                          {intervention.scheduled_time}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <TypeBadge type={intervention.intervention_type} />
                      </div>
                      {getInterventionAddress(intervention) && (
                        <button
                          type="button"
                          className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                          onClick={(e) => { e.stopPropagation(); openAddressInMaps(getInterventionAddress(intervention)!); }}
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
  );
};
