import { useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useClient } from "@/hooks/useClients";
import { useInterventions, InterventionStatus } from "@/hooks/useInterventions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, TypeBadge } from "@/components/ui/status-badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  ArrowLeft, 
  Edit, 
  User, 
  Mail, 
  Phone, 
  MapPin,
  ClipboardList,
  Plus,
  Search,
  X
} from "lucide-react";
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const statusOptions: { value: InterventionStatus | "all"; label: string }[] = [
  { value: "all", label: "Tous les statuts" },
  { value: "to_plan", label: "À planifier" },
  { value: "planned", label: "Planifiée" },
  { value: "in_progress", label: "En cours" },
  { value: "completed", label: "Terminée" },
  { value: "to_invoice", label: "À facturer" },
  { value: "archived", label: "Archivée" },
];

const ClientDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { data: client, isLoading } = useClient(id || "");
  const { data: interventions = [] } = useInterventions();

  // Filtres
  const [statusFilter, setStatusFilter] = useState<InterventionStatus | "all">("all");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  const clientInterventions = interventions.filter(i => i.client_id === id);

  const filteredInterventions = useMemo(() => {
    return clientInterventions.filter((intervention) => {
      // Filtre par statut
      if (statusFilter !== "all" && intervention.status !== statusFilter) {
        return false;
      }

      // Filtre par date
      if (startDate || endDate) {
        if (!intervention.scheduled_date) return false;
        const interventionDate = parseISO(intervention.scheduled_date);
        
        if (startDate && endDate) {
          if (!isWithinInterval(interventionDate, { 
            start: startOfDay(startDate), 
            end: endOfDay(endDate) 
          })) {
            return false;
          }
        } else if (startDate) {
          if (interventionDate < startOfDay(startDate)) return false;
        } else if (endDate) {
          if (interventionDate > endOfDay(endDate)) return false;
        }
      }

      return true;
    });
  }, [clientInterventions, statusFilter, startDate, endDate]);

  const clearFilters = () => {
    setStatusFilter("all");
    setStartDate(undefined);
    setEndDate(undefined);
  };

  const hasActiveFilters = statusFilter !== "all" || startDate || endDate;

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

      {/* Interventions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Interventions ({filteredInterventions.length}/{clientInterventions.length})
          </CardTitle>
          <Button size="sm" onClick={() => navigate(`/admin/interventions/new?client=${id}`)}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle intervention
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtres */}
          <div className="flex flex-wrap gap-3 items-end p-4 bg-muted/50 rounded-lg">
            {/* Filtre statut */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-muted-foreground">Statut</label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as InterventionStatus | "all")}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Tous les statuts" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtre date début */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-muted-foreground">Date début</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[160px] justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd/MM/yyyy") : "Début"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Filtre date fin */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-muted-foreground">Date fin</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[160px] justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd/MM/yyyy") : "Fin"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Bouton réinitialiser */}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-10">
                <X className="h-4 w-4 mr-1" />
                Réinitialiser
              </Button>
            )}
          </div>

          {filteredInterventions.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              {hasActiveFilters ? "Aucune intervention correspondante" : "Aucune intervention"}
            </p>
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
                {filteredInterventions.map((intervention) => (
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
