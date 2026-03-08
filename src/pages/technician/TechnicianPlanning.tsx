import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { useTechnicianInterventions } from "@/hooks/useInterventions";
import { useOffline } from "@/hooks/useOfflineSync";
import { WeeklyPlanningCalendar } from "@/components/admin/WeeklyPlanningCalendar";
import type { Intervention } from "@/hooks/useInterventions";

export default function TechnicianPlanning() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: interventions = [], isLoading } = useTechnicianInterventions(user?.id);
  const { cacheInterventions } = useOffline();

  useEffect(() => {
    if (interventions.length > 0) cacheInterventions(interventions);
  }, [interventions, cacheInterventions]);

  // Create a single-technician array for the calendar
  const technicians = user
    ? [{ id: user.id, full_name: user.user_metadata?.full_name || "Moi", email: user.email || "" }]
    : [];

  const handleInterventionClick = (intervention: Intervention) => {
    navigate(`/technician/interventions/${intervention.id}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Planning</h1>
        <p className="text-sm text-muted-foreground">Vue hebdomadaire de vos interventions</p>
      </div>
      <WeeklyPlanningCalendar
        interventions={interventions}
        technicians={technicians}
        onInterventionClick={handleInterventionClick}
      />
    </div>
  );
}
