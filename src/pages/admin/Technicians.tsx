import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, UserCog, Pencil, Phone, Mail, MapPin, FileText, Users, AlertTriangle } from 'lucide-react';
import { useTechnicianDetails, TechnicianWithDetails } from '@/hooks/useTechnicianDetails';
import TechnicianEditDialog from '@/components/admin/TechnicianEditDialog';
import { toast } from 'sonner';
import { format, isPast, differenceInDays, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

type TabFilter = 'all' | 'internal' | 'subcontractor';

export default function Technicians() {
  const { data: technicians = [], isLoading, upsertDetails, uploadDocument, deleteDocument } = useTechnicianDetails();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<TabFilter>('all');
  const [editingTech, setEditingTech] = useState<TechnicianWithDetails | null>(null);

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

  const handleSave = async (data: any) => {
    try {
      await upsertDetails.mutateAsync(data);
      toast.success('Informations mises à jour');
      setEditingTech(null);
    } catch {
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const handleUploadDoc = async (data: { user_id: string; document_type: string; file: File; expiration_date?: string | null }) => {
    await uploadDocument.mutateAsync(data);
  };

  const handleDeleteDoc = async (docId: string) => {
    try {
      await deleteDocument.mutateAsync(docId);
      toast.success('Document supprimé');
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  const getTypeLabel = (type: string) => type === 'subcontractor' ? 'Sous-traitant' : 'Interne';
  const getTypeBadgeVariant = (type: string) => type === 'subcontractor' ? 'secondary' as const : 'default' as const;

  const getDocAlerts = (tech: TechnicianWithDetails) => {
    return (tech.documents || []).filter(d => {
      if (!d.expiration_date) return false;
      const exp = parseISO(d.expiration_date);
      return isPast(exp) || differenceInDays(exp, new Date()) <= 30;
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <HardHat className="h-6 w-6 text-primary" />
          Intervenants
        </h1>
        <p className="text-muted-foreground">Gestion des techniciens et sous-traitants de votre équipe</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Rechercher un intervenant..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      <Tabs value={tab} onValueChange={v => setTab(v as TabFilter)}>
        <TabsList>
          <TabsTrigger value="all">Tous ({technicians.length})</TabsTrigger>
          <TabsTrigger value="internal">Internes ({internals.length})</TabsTrigger>
          <TabsTrigger value="subcontractor">Sous-traitants ({subcontractors.length})</TabsTrigger>
        </TabsList>
      </Tabs>

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
            const alerts = getDocAlerts(tech);
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
                        <p className="text-sm text-muted-foreground">{tech.details?.position || tech.email}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant={getTypeBadgeVariant(type)}>{getTypeLabel(type)}</Badge>
                      {alerts.length > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          <AlertTriangle className="h-3 w-3 mr-1" />{alerts.length} alerte{alerts.length > 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(tech.details?.personal_phone || tech.phone) && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      <span>{tech.details?.personal_phone || tech.phone}</span>
                    </div>
                  )}
                  {(tech.details?.personal_email || tech.email) && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" />
                      <span>{tech.details?.personal_email || tech.email}</span>
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
                  {tech.documents.length > 0 && (
                    <p className="text-xs text-muted-foreground">{tech.documents.length} document{tech.documents.length > 1 ? 's' : ''}</p>
                  )}
                  <div className="pt-2">
                    <Button variant="outline" size="sm" className="w-full" onClick={() => setEditingTech(tech)}>
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

      <TechnicianEditDialog
        tech={editingTech}
        onClose={() => setEditingTech(null)}
        onSave={handleSave}
        onUploadDoc={handleUploadDoc}
        onDeleteDoc={handleDeleteDoc}
        isSaving={upsertDetails.isPending}
      />
    </div>
  );
}
