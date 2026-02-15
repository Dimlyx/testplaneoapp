import { useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useClient } from "@/hooks/useClients";
import { useInterventions, InterventionStatus } from "@/hooks/useInterventions";
import { useClientContacts, useCreateClientContact, useDeleteClientContact } from "@/hooks/useClientContacts";
import { useClientNotes, useCreateClientNote, useDeleteClientNote } from "@/hooks/useClientNotes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, TypeBadge } from "@/components/ui/status-badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { 
  ArrowLeft, 
  Edit, 
  User, 
  Mail, 
  Phone, 
  MapPin,
  ClipboardList,
  Plus,
  X,
  Users,
  StickyNote,
  Trash2,
  Briefcase
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
  const clientId = id || "";
  const { data: client, isLoading } = useClient(clientId);
  const { data: interventions = [] } = useInterventions();
  const { data: contacts = [] } = useClientContacts(clientId);
  const { data: notes = [] } = useClientNotes(clientId);
  const createContact = useCreateClientContact();
  const deleteContact = useDeleteClientContact();
  const createNote = useCreateClientNote();
  const deleteNote = useDeleteClientNote();

  // Filtres interventions
  const [statusFilter, setStatusFilter] = useState<InterventionStatus | "all">("all");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  // Dialog interlocuteur
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [contactForm, setContactForm] = useState({ full_name: "", role: "", email: "", phone: "" });

  // Note interne
  const [noteContent, setNoteContent] = useState("");

  const clientInterventions = interventions.filter(i => i.client_id === clientId);

  const filteredInterventions = useMemo(() => {
    return clientInterventions.filter((intervention) => {
      if (statusFilter !== "all" && intervention.status !== statusFilter) return false;
      if (startDate || endDate) {
        if (!intervention.scheduled_date) return false;
        const interventionDate = parseISO(intervention.scheduled_date);
        if (startDate && endDate) {
          if (!isWithinInterval(interventionDate, { start: startOfDay(startDate), end: endOfDay(endDate) })) return false;
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

  const handleAddContact = () => {
    if (!contactForm.full_name.trim()) return;
    createContact.mutate(
      { client_id: clientId, ...contactForm },
      { onSuccess: () => { setShowContactDialog(false); setContactForm({ full_name: "", role: "", email: "", phone: "" }); } }
    );
  };

  const handleAddNote = () => {
    if (!noteContent.trim()) return;
    createNote.mutate(
      { client_id: clientId, content: noteContent },
      { onSuccess: () => setNoteContent("") }
    );
  };

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
        <Button onClick={() => navigate(`/admin/clients/${clientId}/edit`)}>
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

      {/* Interlocuteurs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Interlocuteurs ({contacts.length})
          </CardTitle>
          <Button size="sm" onClick={() => setShowContactDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Ajouter
          </Button>
        </CardHeader>
        <CardContent>
          {contacts.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Aucun interlocuteur</p>
          ) : (
            <div className="grid gap-3">
              {contacts.map((contact) => (
                <div key={contact.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{contact.full_name}</span>
                      {contact.role && (
                        <Badge variant="outline" className="text-xs">
                          <Briefcase className="h-3 w-3 mr-1" />
                          {contact.role}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      {contact.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {contact.email}
                        </span>
                      )}
                      {contact.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {contact.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => deleteContact.mutate({ id: contact.id, clientId })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes internes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5" />
            Notes internes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Textarea
              placeholder="Ajouter une note interne..."
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              className="min-h-[60px]"
            />
            <Button onClick={handleAddNote} disabled={!noteContent.trim() || createNote.isPending} className="self-end">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {notes.length === 0 ? (
            <p className="text-muted-foreground text-center py-2">Aucune note</p>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <div key={note.id} className="flex items-start justify-between p-3 border rounded-lg bg-muted/30">
                  <div className="space-y-1 flex-1">
                    <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(note.created_at), "dd/MM/yyyy à HH:mm", { locale: fr })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive shrink-0"
                    onClick={() => deleteNote.mutate({ id: note.id, clientId })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
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
          <Button size="sm" onClick={() => navigate(`/admin/interventions/new?client=${clientId}`)}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle intervention
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtres */}
          <div className="flex flex-wrap gap-3 items-end p-4 bg-muted/50 rounded-lg">
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
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-muted-foreground">Date début</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd/MM/yyyy") : "Début"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-muted-foreground">Date fin</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd/MM/yyyy") : "Fin"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
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

      {/* Dialog ajout interlocuteur */}
      <Dialog open={showContactDialog} onOpenChange={setShowContactDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un interlocuteur</DialogTitle>
            <DialogDescription>Renseignez les informations du contact.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nom complet *</label>
              <Input value={contactForm.full_name} onChange={(e) => setContactForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Jean Dupont" />
            </div>
            <div>
              <label className="text-sm font-medium">Fonction</label>
              <Input value={contactForm.role} onChange={(e) => setContactForm(f => ({ ...f, role: e.target.value }))} placeholder="Directeur technique" />
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input type="email" value={contactForm.email} onChange={(e) => setContactForm(f => ({ ...f, email: e.target.value }))} placeholder="jean@exemple.com" />
            </div>
            <div>
              <label className="text-sm font-medium">Téléphone</label>
              <Input value={contactForm.phone} onChange={(e) => setContactForm(f => ({ ...f, phone: e.target.value }))} placeholder="06 12 34 56 78" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowContactDialog(false)}>Annuler</Button>
            <Button onClick={handleAddContact} disabled={!contactForm.full_name.trim() || createContact.isPending}>
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientDetail;
