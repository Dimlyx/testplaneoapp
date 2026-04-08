import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserCog, Upload, Trash2, AlertTriangle, ExternalLink, FileText, Shield } from 'lucide-react';
import { TechnicianWithDetails, TechnicianDocument } from '@/hooks/useTechnicianDetails';
import { useAuth } from '@/lib/auth-context';
import { format, differenceInDays, isPast, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

interface TechnicianEditDialogProps {
  tech: TechnicianWithDetails | null;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  onUploadDoc: (data: { user_id: string; document_type: string; file: File; expiration_date?: string | null }) => Promise<void>;
  onDeleteDoc: (docId: string) => Promise<void>;
  isSaving: boolean;
}

const DOC_TYPES = [
  { value: 'assurance_decennale', label: 'Assurance décennale' },
  { value: 'rc_pro', label: 'RC Pro' },
  { value: 'attestation_sous_traitance', label: 'Attestation de sous-traitance' },
  { value: 'rib', label: 'RIB' },
  { value: 'kbis', label: 'Kbis' },
  { value: 'cv', label: 'CV' },
  { value: 'habilitation', label: 'Habilitation' },
  { value: 'other', label: 'Autre' },
];

export default function TechnicianEditDialog({ tech, onClose, onSave, onUploadDoc, onDeleteDoc, isSaving }: TechnicianEditDialogProps) {
  const { role } = useAuth();
  const isSuperAdmin = role === 'super_admin';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState(() => ({
    technician_type: tech?.details?.technician_type || 'internal' as 'internal' | 'subcontractor',
    birth_date: tech?.details?.birth_date || '',
    position: tech?.details?.position || '',
    personal_phone: tech?.details?.personal_phone || tech?.phone || '',
    personal_email: tech?.details?.personal_email || tech?.email || '',
    social_security_number: tech?.details?.social_security_number || '',
    address: tech?.details?.address || '',
    city: tech?.details?.city || '',
    postal_code: tech?.details?.postal_code || '',
    hire_date: tech?.details?.hire_date || '',
    contract_type: tech?.details?.contract_type || '',
    contract_end_date: tech?.details?.contract_end_date || '',
    emergency_contact_name: tech?.details?.emergency_contact_name || '',
    emergency_contact_phone: tech?.details?.emergency_contact_phone || '',
    notes: tech?.details?.notes || '',
    // Subcontractor specific
    contract_link: tech?.details?.contract_link || '',
    collaboration_start_date: tech?.details?.collaboration_start_date || '',
    collaboration_end_date: tech?.details?.collaboration_end_date || '',
    specialties: tech?.details?.specialties || '',
  }));

  const [docType, setDocType] = useState('other');
  const [docExpiration, setDocExpiration] = useState('');
  const [uploading, setUploading] = useState(false);

  if (!tech) return null;

  const handleSave = async () => {
    await onSave({
      user_id: tech.id,
      ...form,
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await onUploadDoc({
        user_id: tech.id,
        document_type: docType,
        file,
        expiration_date: docExpiration || null,
      });
      toast.success('Document ajouté');
      setDocExpiration('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch {
      toast.error("Erreur lors de l'upload");
    } finally {
      setUploading(false);
    }
  };

  const getExpirationBadge = (doc: TechnicianDocument) => {
    if (!doc.expiration_date) return null;
    const expDate = parseISO(doc.expiration_date);
    const daysLeft = differenceInDays(expDate, new Date());
    if (isPast(expDate)) {
      return <Badge variant="destructive" className="text-xs"><AlertTriangle className="h-3 w-3 mr-1" />Expiré</Badge>;
    }
    if (daysLeft <= 30) {
      return <Badge variant="secondary" className="text-xs bg-destructive/10 text-destructive"><AlertTriangle className="h-3 w-3 mr-1" />Expire dans {daysLeft}j</Badge>;
    }
    return <Badge variant="outline" className="text-xs">Expire le {format(expDate, 'dd/MM/yyyy')}</Badge>;
  };

  const getDocTypeLabel = (type: string) => DOC_TYPES.find(d => d.value === type)?.label || type;

  const isSubcontractor = form.technician_type === 'subcontractor';

  // Profile fields set by super admin are read-only for regular admins
  const profileReadOnly = !isSuperAdmin;

  return (
    <Dialog open={!!tech} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            {tech.full_name || tech.email}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="info">
          <TabsList className="w-full">
            <TabsTrigger value="info" className="flex-1">Informations</TabsTrigger>
            <TabsTrigger value="contract" className="flex-1">Contrat</TabsTrigger>
            <TabsTrigger value="documents" className="flex-1">Documents</TabsTrigger>
            {isSubcontractor && <TabsTrigger value="subcontractor" className="flex-1">Sous-traitant</TabsTrigger>}
          </TabsList>

          {/* Tab: Informations personnelles */}
          <TabsContent value="info" className="space-y-4 mt-4">
            <div>
              <Label>Type d'intervenant</Label>
              <Select value={form.technician_type} onValueChange={v => setForm(f => ({ ...f, technician_type: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Interne</SelectItem>
                  <SelectItem value="subcontractor">Sous-traitant</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nom complet</Label>
                <Input value={tech.full_name || ''} disabled={profileReadOnly} readOnly={profileReadOnly} className={profileReadOnly ? 'bg-muted' : ''} />
                {profileReadOnly && <p className="text-xs text-muted-foreground mt-1">Géré par le super administrateur</p>}
              </div>
              <div>
                <Label>Poste</Label>
                <Input value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} placeholder="Technicien CVC, Électricien..." />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date de naissance</Label>
                <Input type="date" value={form.birth_date} onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))} />
              </div>
              <div>
                <Label>N° Sécurité sociale</Label>
                <Input value={form.social_security_number} onChange={e => setForm(f => ({ ...f, social_security_number: e.target.value }))} placeholder="1 XX XX XX XXX XXX XX" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Téléphone</Label>
                <Input value={form.personal_phone} onChange={e => setForm(f => ({ ...f, personal_phone: e.target.value }))} />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.personal_email} onChange={e => setForm(f => ({ ...f, personal_email: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <Label>Adresse</Label>
                <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
              </div>
              <div>
                <Label>Code postal</Label>
                <Input value={form.postal_code} onChange={e => setForm(f => ({ ...f, postal_code: e.target.value }))} />
              </div>
            </div>

            <div>
              <Label>Ville</Label>
              <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3 text-sm">Contact d'urgence</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nom</Label>
                  <Input value={form.emergency_contact_name} onChange={e => setForm(f => ({ ...f, emergency_contact_name: e.target.value }))} />
                </div>
                <div>
                  <Label>Téléphone</Label>
                  <Input value={form.emergency_contact_phone} onChange={e => setForm(f => ({ ...f, emergency_contact_phone: e.target.value }))} />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Tab: Contrat */}
          <TabsContent value="contract" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type de contrat</Label>
                <Input value={form.contract_type} onChange={e => setForm(f => ({ ...f, contract_type: e.target.value }))} placeholder="CDI, CDD, Intérim..." />
              </div>
              <div>
                <Label>Date d'entrée</Label>
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
          </TabsContent>

          {/* Tab: Documents */}
          <TabsContent value="documents" className="space-y-4 mt-4">
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <h4 className="font-medium text-sm">Ajouter un document</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Type de document</Label>
                  <Select value={docType} onValueChange={setDocType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DOC_TYPES.map(dt => (
                        <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Date d'expiration (optionnel)</Label>
                  <Input type="date" value={docExpiration} onChange={e => setDocExpiration(e.target.value)} />
                </div>
              </div>
              <div>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? 'Upload en cours...' : 'Choisir un fichier'}
                </Button>
              </div>
            </div>

            {tech.documents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Aucun document</p>
            ) : (
              <div className="space-y-2">
                {tech.documents.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between border rounded-lg p-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{doc.file_name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-xs">{getDocTypeLabel(doc.document_type)}</Badge>
                          {getExpirationBadge(doc)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" asChild>
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => onDeleteDoc(doc.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Tab: Sous-traitant */}
          {isSubcontractor && (
            <TabsContent value="subcontractor" className="space-y-4 mt-4">
              <div>
                <Label>Lien vers le contrat signé</Label>
                <Input value={form.contract_link} onChange={e => setForm(f => ({ ...f, contract_link: e.target.value }))} placeholder="https://..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Début de collaboration</Label>
                  <Input type="date" value={form.collaboration_start_date} onChange={e => setForm(f => ({ ...f, collaboration_start_date: e.target.value }))} />
                </div>
                <div>
                  <Label>Fin de collaboration</Label>
                  <Input type="date" value={form.collaboration_end_date} onChange={e => setForm(f => ({ ...f, collaboration_end_date: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Spécialités couvertes</Label>
                <Textarea
                  value={form.specialties}
                  onChange={e => setForm(f => ({ ...f, specialties: e.target.value }))}
                  placeholder="CVC, Électricité, Plomberie..."
                  rows={2}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Les documents spécifiques (Kbis, Assurance décennale, RC Pro, Attestation, RIB) peuvent être ajoutés dans l'onglet Documents.
              </p>
            </TabsContent>
          )}
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
