import { useState } from "react";
import { useInterventions, useDeleteIntervention } from "@/hooks/useInterventions";
import { useClients } from "@/hooks/useClients";
import { useTechnicians } from "@/hooks/useTechnicians";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge, TypeBadge } from "@/components/ui/status-badge";
import { Plus, Search, Trash2, Eye, Edit } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";

const Interventions = () => {
  const navigate = useNavigate();
  const { data: interventions = [], isLoading } = useInterventions();
  const { data: clients = [] } = useClients();
  const { data: technicians = [] } = useTechnicians();
  const deleteIntervention = useDeleteIntervention();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [technicianFilter, setTechnicianFilter] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client?.name || "Client inconnu";
  };

  const getTechnicianName = (technicianId: string | null) => {
    if (!technicianId) return "Non assigné";
    const tech = technicians.find(t => t.id === technicianId);
    return tech?.full_name || tech?.email || "Technicien inconnu";
  };

  const filteredInterventions = interventions.filter((intervention) => {
    const matchesSearch = 
      intervention.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getClientName(intervention.client_id).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || intervention.status === statusFilter;
    const matchesType = typeFilter === "all" || intervention.intervention_type === typeFilter;
    const matchesTechnician = technicianFilter === "all" || intervention.technician_id === technicianFilter;

    return matchesSearch && matchesStatus && matchesType && matchesTechnician;
  });

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteIntervention.mutateAsync(deleteId);
      toast({ title: "Intervention supprimée avec succès" });
      setDeleteId(null);
    } catch (error) {
      toast({ title: "Erreur lors de la suppression", variant: "destructive" });
    }
  };

  if (isLoading) {
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
          <h1 className="text-3xl font-bold text-foreground">Interventions</h1>
          <p className="text-muted-foreground">Gérez toutes les interventions</p>
        </div>
        <Button onClick={() => navigate("/admin/interventions/new")}>
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle intervention
        </Button>
      </div>

      {/* Filtres */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="to_plan">À planifier</SelectItem>
            <SelectItem value="planned">Planifiée</SelectItem>
            <SelectItem value="in_progress">En cours</SelectItem>
            <SelectItem value="completed">Terminée</SelectItem>
            <SelectItem value="to_invoice">À facturer</SelectItem>
            <SelectItem value="archived">Archivée</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            <SelectItem value="sav">SAV</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
            <SelectItem value="installation">Installation</SelectItem>
          </SelectContent>
        </Select>
        <Select value={technicianFilter} onValueChange={setTechnicianFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Technicien" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les techniciens</SelectItem>
            {technicians.map((tech) => (
              <SelectItem key={tech.id} value={tech.id}>
                {tech.full_name || tech.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Titre</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Technicien</TableHead>
              <TableHead>Date prévue</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInterventions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Aucune intervention trouvée
                </TableCell>
              </TableRow>
            ) : (
              filteredInterventions.map((intervention) => (
                <TableRow key={intervention.id}>
                  <TableCell className="font-medium">{intervention.title}</TableCell>
                  <TableCell>{getClientName(intervention.client_id)}</TableCell>
                  <TableCell><TypeBadge type={intervention.intervention_type} /></TableCell>
                  <TableCell><StatusBadge status={intervention.status} /></TableCell>
                  <TableCell>{getTechnicianName(intervention.technician_id)}</TableCell>
                  <TableCell>
                    {intervention.scheduled_date 
                      ? format(new Date(intervention.scheduled_date), 'dd/MM/yyyy', { locale: fr })
                      : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => navigate(`/admin/interventions/${intervention.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => navigate(`/admin/interventions/${intervention.id}/edit`)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => setDeleteId(intervention.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cette intervention ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Interventions;
