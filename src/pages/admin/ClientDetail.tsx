import { useNavigate, useParams } from "react-router-dom";
import { useClient } from "@/hooks/useClients";
import { useClientEquipment } from "@/hooks/useEquipment";
import { useInterventions } from "@/hooks/useInterventions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, TypeBadge } from "@/components/ui/status-badge";
import { 
  ArrowLeft, 
  Edit, 
  User, 
  Mail, 
  Phone, 
  MapPin,
  Wrench,
  ClipboardList,
  Plus
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ClientDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { data: client, isLoading } = useClient(id || "");
  const { data: equipment = [] } = useClientEquipment(id || "");
  const { data: interventions = [] } = useInterventions();

  const clientInterventions = interventions.filter(i => i.client_id === id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Client non trouvé</p>
        <Button className="mt-4" onClick={() => navigate("/admin/clients")}>
          Retour à la liste
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-foreground">{client.name}</h1>
              <Badge variant={client.client_type === 'professional' ? 'default' : 'secondary'}>
                {client.client_type === 'individual' ? 'Particulier' : 'Professionnel'}
              </Badge>
            </div>
          </div>
        </div>
        <Button onClick={() => navigate(`/admin/clients/${id}/edit`)}>
          <Edit className="h-4 w-4 mr-2" />
          Modifier
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Informations de contact */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Contact
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {client.email && (
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{client.email}</span>
              </div>
            )}
            {client.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{client.phone}</span>
              </div>
            )}
            {(client.address || client.city) && (
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  {client.address && <p>{client.address}</p>}
                  <p>
                    {client.postal_code && `${client.postal_code} `}
                    {client.city}
                  </p>
                </div>
              </div>
            )}
            {client.notes && (
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-1">Notes</p>
                <p className="text-sm">{client.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Équipements */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Équipements ({equipment.length})
            </CardTitle>
            <Button size="sm" onClick={() => navigate(`/admin/equipment/new?client=${id}`)}>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter
            </Button>
          </CardHeader>
          <CardContent>
            {equipment.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Aucun équipement</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Marque / Modèle</TableHead>
                    <TableHead>N° Série</TableHead>
                    <TableHead>Installation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {equipment.map((eq) => (
                    <TableRow key={eq.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/admin/equipment/${eq.id}`)}>
                      <TableCell>{eq.equipment_type}</TableCell>
                      <TableCell className="font-medium">{eq.brand} {eq.model}</TableCell>
                      <TableCell>{eq.serial_number || "-"}</TableCell>
                      <TableCell>
                        {eq.installation_date 
                          ? format(new Date(eq.installation_date), 'dd/MM/yyyy', { locale: fr })
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Interventions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Interventions ({clientInterventions.length})
          </CardTitle>
          <Button size="sm" onClick={() => navigate(`/admin/interventions/new?client=${id}`)}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle intervention
          </Button>
        </CardHeader>
        <CardContent>
          {clientInterventions.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Aucune intervention</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titre</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date prévue</TableHead>
                  <TableHead>Technicien</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientInterventions.map((intervention) => (
                  <TableRow 
                    key={intervention.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/admin/interventions/${intervention.id}`)}
                  >
                    <TableCell className="font-medium">{intervention.title}</TableCell>
                    <TableCell><TypeBadge type={intervention.intervention_type} /></TableCell>
                    <TableCell><StatusBadge status={intervention.status} /></TableCell>
                    <TableCell>
                      {intervention.scheduled_date 
                        ? format(new Date(intervention.scheduled_date), 'dd/MM/yyyy', { locale: fr })
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {intervention.technician_id ? "Assigné" : "Non assigné"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientDetail;
