import { useState } from "react";
import { useInterventions, useDeleteIntervention, useUpdateIntervention, useCreateIntervention } from "@/hooks/useInterventions";
import { useClients } from "@/hooks/useClients";
import { useTechnicians } from "@/hooks/useTechnicians";
import { useInterventionTypes } from "@/hooks/useInterventionTypes";
import { useCustomStatuses } from "@/hooks/useCustomStatuses";
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
import { Plus, Search, Trash2, Eye, Edit, CheckSquare, X, UserCheck, Archive, Copy } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type InterventionStatus = 'to_plan' | 'planned' | 'in_progress' | 'completed' | 'to_invoice' | 'archived';

const STATUS_OPTIONS: { value: InterventionStatus; label: string }[] = [
  { value: 'to_plan', label: 'À planifier' },
  { value: 'planned', label: 'Planifiée' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'completed', label: 'Terminée' },
  { value: 'to_invoice', label: 'À facturer' },
  { value: 'archived', label: 'Archivée' },
];

const Interventions = () => {
  const navigate = useNavigate();
  const { data: interventions = [], isLoading } = useInterventions();
  const { data: clients = [] } = useClients();
  const { data: technicians = [] } = useTechnicians();
  const deleteIntervention = useDeleteIntervention();
  const updateIntervention = useUpdateIntervention();
  const createIntervention = useCreateIntervention();
  const { data: interventionTypes = [] } = useInterventionTypes();
  const { data: customStatuses = [] } = useCustomStatuses();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [technicianFilter, setTechnicianFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [bulkTechnicianOpen, setBulkTechnicianOpen] = useState(false);

  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client?.name || "Client inconnu";
  };

  const getClient = (clientId: string) => clients.find(c => c.id === clientId);

  const getTechnicianName = (technicianId: string | null) => {
    if (!technicianId) return "Non assigné";
    const tech = technicians.find(t => t.id === technicianId);
    return tech?.full_name || tech?.email || "Technicien inconnu";
  };

  // Compute search match info: returns null if no match, or { field, value } describing where the match was found
  const computeMatchInfo = (intervention: typeof interventions[0], term: string) => {
    if (!term.trim()) return { matches: true, hint: null as null | { label: string; value: string } };
    const t = term.toLowerCase().trim();
    const client = getClient(intervention.client_id);

    // Visible columns first (no hint needed)
    if (intervention.title?.toLowerCase().includes(t)) return { matches: true, hint: null };
    if (client?.name?.toLowerCase().includes(t)) return { matches: true, hint: null };

    // Hidden fields - show a hint badge so user understands why it matched
    const checks: Array<[string, string | null | undefined]> = [
      ['Contact', intervention.intervention_contact_name],
      ['Adresse', intervention.intervention_address],
      ['Ville', intervention.intervention_city],
      ['Code postal', intervention.intervention_postal_code],
      ['Bâtiment', intervention.intervention_building],
      ['Étage', intervention.intervention_floor],
      ['Téléphone', intervention.intervention_phone],
      ['Email', intervention.intervention_email],
      ['Description', intervention.description],
      ['Téléphone client', client?.phone],
      ['Email client', client?.email],
      ['Adresse client', client?.address],
      ['Ville client', client?.city],
      ['Code postal client', client?.postal_code],
    ];

    for (const [label, value] of checks) {
      if (value && value.toLowerCase().includes(t)) {
        return { matches: true, hint: { label, value } };
      }
    }

    return { matches: false, hint: null };
  };

  const filteredInterventions = interventions
    .map((intervention) => ({
      intervention,
      matchInfo: computeMatchInfo(intervention, searchTerm),
    }))
    .filter(({ intervention, matchInfo }) => {
      if (!matchInfo.matches) return false;
      const matchesStatus = statusFilter === "all" || intervention.status === statusFilter || intervention.custom_status_id === statusFilter;
      const matchesType = typeFilter === "all" || intervention.intervention_type === typeFilter;
      const matchesTechnician = technicianFilter === "all" || intervention.technician_id === technicianFilter;
      const matchesClient = clientFilter === "all" || intervention.client_id === clientFilter;
      return matchesStatus && matchesType && matchesTechnician && matchesClient;
    });

  const filteredInterventionsList = filteredInterventions.map(f => f.intervention);

  const handleDuplicate = async (intervention: typeof interventions[0]) => {
    try {
      await createIntervention.mutateAsync({
        title: `${intervention.title} (copie)`,
        client_id: intervention.client_id,
        intervention_type: intervention.intervention_type,
        technician_id: intervention.technician_id,
        equipment_id: intervention.equipment_id,
        description: intervention.description,
        intervention_address: intervention.intervention_address,
        intervention_city: intervention.intervention_city,
        intervention_postal_code: intervention.intervention_postal_code,
        intervention_building: intervention.intervention_building,
        intervention_floor: intervention.intervention_floor,
        intervention_contact_name: intervention.intervention_contact_name,
        intervention_phone: intervention.intervention_phone,
        intervention_email: intervention.intervention_email,
        estimated_duration: intervention.estimated_duration,
        organization_id: intervention.organization_id,
        status: 'to_plan',
      });
    } catch {}
  };

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredInterventionsList.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredInterventionsList.map(i => i.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const isAllSelected = filteredInterventions.length > 0 && selectedIds.size === filteredInterventions.length;
  const isSomeSelected = selectedIds.size > 0;

  // Bulk action handlers
  const handleBulkStatusChange = async (newStatus: InterventionStatus) => {
    try {
      const promises = Array.from(selectedIds).map(id =>
        updateIntervention.mutateAsync({ id, status: newStatus })
      );
      await Promise.all(promises);
      toast({ title: `${selectedIds.size} intervention(s) mise(s) à jour` });
      clearSelection();
      setBulkStatusOpen(false);
    } catch (error) {
      toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
    }
  };

  const handleBulkTechnicianChange = async (technicianId: string | null) => {
    try {
      const promises = Array.from(selectedIds).map(id =>
        updateIntervention.mutateAsync({ id, technician_id: technicianId })
      );
      await Promise.all(promises);
      toast({ title: `${selectedIds.size} intervention(s) assignée(s)` });
      clearSelection();
      setBulkTechnicianOpen(false);
    } catch (error) {
      toast({ title: "Erreur lors de l'assignation", variant: "destructive" });
    }
  };

  const handleBulkDelete = async () => {
    try {
      const promises = Array.from(selectedIds).map(id =>
        deleteIntervention.mutateAsync(id)
      );
      await Promise.all(promises);
      toast({ title: `${selectedIds.size} intervention(s) supprimée(s)` });
      clearSelection();
      setBulkDeleteOpen(false);
    } catch (error) {
      toast({ title: "Erreur lors de la suppression", variant: "destructive" });
    }
  };

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
            {customStatuses.map((cs) => (
              <SelectItem key={cs.id} value={cs.id}>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cs.color }} />
                  {cs.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {interventionTypes.map((t) => (
              <SelectItem key={t.id} value={t.name}>{t.label}</SelectItem>
            ))}
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
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Client" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les clients</SelectItem>
            {[...clients].sort((a, b) => a.name.localeCompare(b.name)).map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Bulk Actions Bar */}
      {isSomeSelected && (
        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg border">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-primary" />
            <span className="font-medium">{selectedIds.size} sélectionnée(s)</span>
          </div>
          
          <div className="flex-1" />
          
          {/* Change Status */}
          <DropdownMenu open={bulkStatusOpen} onOpenChange={setBulkStatusOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Archive className="h-4 w-4 mr-2" />
                Changer le statut
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-background">
              {STATUS_OPTIONS.map((status) => (
                <DropdownMenuItem
                  key={status.value}
                  onClick={() => handleBulkStatusChange(status.value)}
                >
                  <StatusBadge status={status.value} className="mr-2" />
                  {status.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Assign Technician */}
          <DropdownMenu open={bulkTechnicianOpen} onOpenChange={setBulkTechnicianOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <UserCheck className="h-4 w-4 mr-2" />
                Assigner
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-background">
              <DropdownMenuItem onClick={() => handleBulkTechnicianChange(null)}>
                Non assigné
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {technicians.map((tech) => (
                <DropdownMenuItem
                  key={tech.id}
                  onClick={() => handleBulkTechnicianChange(tech.id)}
                >
                  {tech.full_name || tech.email}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Delete */}
          <Button 
            variant="outline" 
            size="sm" 
            className="text-destructive hover:text-destructive"
            onClick={() => setBulkDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Supprimer
          </Button>

          {/* Clear Selection */}
          <Button variant="ghost" size="sm" onClick={clearSelection}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Sélectionner tout"
                />
              </TableHead>
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
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Aucune intervention trouvée
                </TableCell>
              </TableRow>
            ) : (
              filteredInterventions.map((intervention) => (
                <TableRow 
                  key={intervention.id}
                  className={selectedIds.has(intervention.id) ? "bg-muted/50" : ""}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(intervention.id)}
                      onCheckedChange={() => toggleSelect(intervention.id)}
                      aria-label={`Sélectionner ${intervention.title}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{intervention.title}</TableCell>
                  <TableCell>{getClientName(intervention.client_id)}</TableCell>
                  <TableCell><TypeBadge type={intervention.intervention_type} /></TableCell>
                  <TableCell><StatusBadge status={intervention.status} customStatusId={intervention.custom_status_id} /></TableCell>
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
                        onClick={() => handleDuplicate(intervention)}
                        title="Dupliquer"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
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

      {/* Single Delete Dialog */}
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

      {/* Bulk Delete Dialog */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression groupée</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer {selectedIds.size} intervention(s) ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground">
              Supprimer {selectedIds.size} intervention(s)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Interventions;