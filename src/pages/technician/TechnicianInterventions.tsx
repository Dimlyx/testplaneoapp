import { useEffect } from "react";
import { useTechnicianInterventions } from "@/hooks/useInterventions";
import { useClients } from "@/hooks/useClients";
import { useAuth } from "@/lib/auth-context";
import { useOffline } from "@/hooks/useOfflineSync";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, TypeBadge } from "@/components/ui/status-badge";
import { ClipboardList, Calendar, Clock, MapPin } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

const TechnicianInterventions = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: interventions = [], isLoading } = useTechnicianInterventions(user?.id);
  const { data: clients = [] } = useClients();
  const { cacheInterventions, isOnline } = useOffline();

  // Cache interventions for offline use
  useEffect(() => {
    if (interventions.length > 0) {
      cacheInterventions(interventions);
    }
  }, [interventions, cacheInterventions]);

  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client?.name || "Client";
  };

  const getClientAddress = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return null;
    return client.address ? `${client.address}, ${client.postal_code || ''} ${client.city || ''}` : client.city;
  };

  // Exclude completed/to_invoice/archived — those go to history
  const activeInterventions = interventions.filter(
    i => !['completed', 'to_invoice', 'archived'].includes(i.status)
  );

  const todayInterventions = activeInterventions.filter(i => {
    if (!i.scheduled_date) return false;
    const today = new Date().toISOString().split('T')[0];
    return i.scheduled_date === today;
  });

  const upcomingInterventions = activeInterventions.filter(i => {
    if (!i.scheduled_date) return false;
    const today = new Date().toISOString().split('T')[0];
    return i.scheduled_date > today;
  });

  const inProgressInterventions = activeInterventions.filter(i => i.status === 'in_progress');
  const toDoInterventions = activeInterventions.filter(i => i.status === 'planned' || i.status === 'to_plan');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Mes Interventions</h1>
        <p className="text-muted-foreground">
          {activeInterventions.length} intervention{activeInterventions.length > 1 ? 's' : ''} en cours
        </p>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-status-in-progress/10 rounded-lg">
                <Clock className="h-5 w-5 text-status-in-progress" />
              </div>
              <div>
                <p className="text-2xl font-bold">{inProgressInterventions.length}</p>
                <p className="text-xs text-muted-foreground">En cours</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-status-planned/10 rounded-lg">
                <Calendar className="h-5 w-5 text-status-planned" />
              </div>
              <div>
                <p className="text-2xl font-bold">{todayInterventions.length}</p>
                <p className="text-xs text-muted-foreground">Aujourd'hui</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Interventions du jour */}
      {todayInterventions.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Aujourd'hui
          </h2>
          <div className="space-y-3">
            {todayInterventions.map((intervention) => (
              <Card 
                key={intervention.id} 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/technician/interventions/${intervention.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium">{intervention.title}</h3>
                    <StatusBadge status={intervention.status} />
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {getClientName(intervention.client_id)}
                  </p>
                  <div className="flex items-center gap-4 text-sm">
                    <TypeBadge type={intervention.intervention_type} />
                    {intervention.scheduled_time && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {intervention.scheduled_time}
                      </span>
                    )}
                  </div>
                  {getClientAddress(intervention.client_id) && (
                    <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {getClientAddress(intervention.client_id)}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* En cours */}
      {inProgressInterventions.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Clock className="h-5 w-5 text-status-in-progress" />
            En cours
          </h2>
          <div className="space-y-3">
            {inProgressInterventions.map((intervention) => (
              <Card 
                key={intervention.id} 
                className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-status-in-progress"
                onClick={() => navigate(`/technician/interventions/${intervention.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium">{intervention.title}</h3>
                    <StatusBadge status={intervention.status} />
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {getClientName(intervention.client_id)}
                  </p>
                  <TypeBadge type={intervention.intervention_type} />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* À faire */}
      {toDoInterventions.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-muted-foreground" />
            À réaliser
          </h2>
          <div className="space-y-3">
            {toDoInterventions.map((intervention) => (
              <Card 
                key={intervention.id} 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/technician/interventions/${intervention.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium">{intervention.title}</h3>
                    <StatusBadge status={intervention.status} />
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {getClientName(intervention.client_id)}
                  </p>
                  <div className="flex items-center gap-4 text-sm">
                    <TypeBadge type={intervention.intervention_type} />
                    {intervention.scheduled_date && (
                      <span className="text-muted-foreground">
                        {format(new Date(intervention.scheduled_date), 'dd/MM/yyyy', { locale: fr })}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {activeInterventions.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Aucune intervention en cours</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TechnicianInterventions;
