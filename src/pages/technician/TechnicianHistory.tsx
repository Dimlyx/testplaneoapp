import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { useTechnicianInterventions } from '@/hooks/useInterventions';
import { useClients } from '@/hooks/useClients';
import { useInterventionTypes } from '@/hooks/useInterventionTypes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, History, Calendar, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const statusLabels: Record<string, string> = {
  to_plan: 'À planifier',
  planned: 'Planifiée',
  in_progress: 'En cours',
  completed: 'Terminée',
  to_invoice: 'À facturer',
  archived: 'Archivée',
};

const statusColors: Record<string, string> = {
  to_plan: 'bg-gray-100 text-gray-800',
  planned: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  to_invoice: 'bg-purple-100 text-purple-800',
  archived: 'bg-slate-100 text-slate-800',
};

export default function TechnicianHistory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: interventions, isLoading } = useTechnicianInterventions(user?.id);
  const { data: clients } = useClients();
  const { data: interventionTypes } = useInterventionTypes();

  const getClientName = (clientId: string) => {
    const client = clients?.find(c => c.id === clientId);
    return client?.name || 'Client inconnu';
  };

  const getTypeInfo = (typeName: string) => {
    const type = interventionTypes?.find(t => t.name === typeName);
    return type ? { label: type.label, color: type.color } : { label: typeName, color: 'gray' };
  };

  // Get last 30 interventions sorted by date (most recent first)
  const recentInterventions = interventions
    ?.sort((a, b) => {
      const dateA = a.scheduled_date ? new Date(a.scheduled_date).getTime() : 0;
      const dateB = b.scheduled_date ? new Date(b.scheduled_date).getTime() : 0;
      return dateB - dateA;
    })
    .slice(0, 30) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <History className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Historique</h1>
          <p className="text-muted-foreground">Vos 30 dernières interventions</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Interventions récentes</CardTitle>
        </CardHeader>
        <CardContent>
          {recentInterventions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucune intervention trouvée
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Titre</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentInterventions.map((intervention) => {
                    const typeInfo = getTypeInfo(intervention.intervention_type);
                    return (
                      <TableRow 
                        key={intervention.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/technician/interventions/${intervention.id}`)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {intervention.scheduled_date 
                              ? format(new Date(intervention.scheduled_date), 'dd MMM yyyy', { locale: fr })
                              : 'Non planifiée'}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{intervention.title}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            {getClientName(intervention.client_id)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline"
                            style={{ 
                              borderColor: typeInfo.color,
                              color: typeInfo.color 
                            }}
                          >
                            {typeInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[intervention.status]}>
                            {statusLabels[intervention.status]}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
