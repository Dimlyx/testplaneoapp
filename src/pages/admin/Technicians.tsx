import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, UserCog, Pencil, Phone, Mail, MapPin, Calendar, FileText, HardHat, Building2 } from 'lucide-react';
import { useTechnicianDetails, TechnicianWithDetails } from '@/hooks/useTechnicianDetails';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

type TabFilter = 'all' | 'internal' | 'subcontractor';

export default function Technicians() {
  const { data: technicians = [], isLoading, upsertDetails } = useTechnicianDetails();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<TabFilter>('all');
  const [editingTech, setEditingTech] = useState<TechnicianWithDetails | null>(null);
  const [form, setForm] = useState({
    technician_type: 'internal' as 'internal' | 'subcontractor',
    address: '',
    city: '',
    postal_code: '',
    hire_date: '',
    contract_type: '',
    contract_end_date: '',
    notes: '',
  });

  const filtered = technicians.filter(t => {
    const matchesSearch = !search ||
      (t.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      t.email.toLowerCase().includes(search.toLowerCase());

    const type = t.details?.technician_type || 'internal';
    const matchesTab = tab === 'all' || type === tab;

    return matchesSearch && matchesTab;
  });

  const internals = technicians.filter(t => (t.details?.technician_type || 'internal') === 'internal');
  const subcontractors = technicians.filter(t => t.details?.technician_type === 'subcontractor');

  const openEdit = (tech: TechnicianWithDetails) => {
    setEditingTech(tech);
    setForm({
      technician_type: tech.details?.technician_type || 'internal',
      address: tech.details?.address || '',
      city: tech.details?.city || '',
      postal_code: tech.details?.postal_code || '',
      hire_date: tech.details?.hire_date || '',
      contract_type: tech.details?.contract_type || '',
      contract_end_date: tech.details?.contract_end_date || '',
      notes: tech.details?.notes || '',
    });
  };

  const handleSave = async () => {
    if (!editingTech) return;
    try {
      await upsertDetails.mutateAsync({
        user_id: editingTech.id,
        technician_type: form.technician_type,
        address: form.address || null,
        city: form.city || null,
        postal_code: form.postal_code || null,
        hire_date: form.hire_date || null,
        contract_type: form.contract_type || null,
        contract_end_date: form.contract_end_date || null,
        notes: form.notes || null,
      });
      toast.success('Informations mises à jour');
      setEditingTech(null);
    } catch {
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const getTypeLabel = (type: string) => type === 'subcontractor' ? 'Sous-traitant' : 'Interne';
  const getTypeBadgeVariant = (type: string) => type === 'subcontractor' ? 'secondary' as const : 'default' as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <HardHat className="h-6 w-6 text-primary" />
          Intervenants
        </h1>
        <p className="text-muted-foreground">Gestion des techniciens et sous-traitants de votre équipe</p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher un intervenant..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={v => setTab(v as TabFilter)}>
        <TabsList>
          <TabsTrigger value="all">Tous ({technicians.length})</TabsTrigger>
          <TabsTrigger value="internal">Internes ({internals.length})</TabsTrigger>
          <TabsTrigger value="subcontractor">Sous-traitants ({subcontractors.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <UserCog className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Aucun intervenant trouvé</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(tech => {
            const type = tech.details?.technician_type || 'internal';
            return (
              <Card key={tech.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-semibold text-primary">
                          {(tech.full_name || tech.email).charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <CardTitle className="text-base">{tech.full_name || 'Sans nom'}</CardTitle>
                        <p className="text-sm text-muted-foreground">{tech.email}</p>
                      </div>
                    </div>
                    <Badge variant={getTypeBadgeVariant(type)}>
                      {getTypeLabel(type)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {tech.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      <span>{tech.phone}</span>
                    </div>
                  )}
                  {tech.details?.city && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>{tech.details.city}{tech.details.postal_code ? ` (${tech.details.postal_code})` : ''}</span>
                    </div>
                  )}
                  {tech.details?.contract_type && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FileText className="h-3.5 w-3.5" />
                      <span>{tech.details.contract_type}</span>
                      {tech.details.hire_date && (
                        <span className="text-xs">• depuis le {format(new Date(tech.details.hire_date), 'dd/MM/yyyy', { locale: fr })}</span>
                      )}
                    </div>
                  )}
                  <div className="pt-2">
                    <Button variant="outline" size="sm" className="w-full" onClick={() => openEdit(tech)}>
                      <Pencil className="h-3.5 w-3.5 mr-2" />
                      Modifier les infos RH
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingTech} onOpenChange={open => !open && setEditingTech(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5" />
              {editingTech?.full_name || editingTech?.email}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Type d'intervenant</Label>
              <Select value={form.technician_type} onValueChange={v => setForm(f => ({ ...f, technician_type: v as any }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Interne</SelectItem>
                  <SelectItem value="subcontractor">Sous-traitant</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Adresse</Label>
                <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
              </div>
              <div>
                <Label>Ville</Label>
                <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
              </div>
            </div>

            <div>
              <Label>Code postal</Label>
              <Input value={form.postal_code} onChange={e => setForm(f => ({ ...f, postal_code: e.target.value }))} className="max-w-[150px]" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type de contrat</Label>
                <Input value={form.contract_type} onChange={e => setForm(f => ({ ...f, contract_type: e.target.value }))} placeholder="CDI, CDD, Intérim..." />
              </div>
              <div>
                <Label>Date d'embauche</Label>
                <Input type="date" value={form.hire_date} onChange={e => setForm(f => ({ ...f, hire_date: e.target.value }))} />
              </div>
            </div>

            <div>
              <Label>Date de fin de contrat</Label>
              <Input type="date" value={form.contract_end_date} onChange={e => setForm(f => ({ ...f, contract_end_date: e.target.value }))} />
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Notes RH libres..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditingTech(null)}>Annuler</Button>
              <Button onClick={handleSave} disabled={upsertDetails.isPending}>
                {upsertDetails.isPending ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
