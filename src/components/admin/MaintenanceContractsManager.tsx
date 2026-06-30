import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Edit,
  Trash2,
  FileText,
  Download,
  Upload,
  Loader2,
  CalendarClock,
  RefreshCw,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ClientContract,
  ContractPeriod,
  useClientContracts,
  useDeleteClientContract,
  useUpsertClientContract,
} from '@/hooks/useClientContracts';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Props {
  clientId?: string;
  disabled?: boolean;
}

const periodLabels: Record<ContractPeriod, string> = {
  day: 'par jour',
  week: 'par semaine',
  month: 'par mois',
  year: 'par an',
};

interface FormState {
  id?: string;
  name: string;
  contract_type: string;
  start_date: string;
  end_date: string;
  visits_per_period: string;
  visits_period: ContractPeriod;
  notes: string;
  file_url: string | null;
  file_name: string | null;
}

const emptyForm = (): FormState => ({
  name: '',
  contract_type: '',
  start_date: '',
  end_date: '',
  visits_per_period: '',
  visits_period: 'year',
  notes: '',
  file_url: null,
  file_name: null,
});

export function MaintenanceContractsManager({ clientId, disabled }: Props) {
  const { data: contracts = [], isLoading } = useClientContracts(clientId);
  const upsert = useUpsertClientContract();
  const del = useDeleteClientContract();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!clientId) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        Enregistrez d'abord le client pour pouvoir ajouter des contrats.
      </div>
    );
  }

  const handleEdit = (c: ClientContract) => {
    setForm({
      id: c.id,
      name: c.name || '',
      contract_type: c.contract_type || '',
      start_date: c.start_date || '',
      end_date: c.end_date || '',
      visits_per_period: c.visits_per_period != null ? String(c.visits_per_period) : '',
      visits_period: c.visits_period,
      notes: c.notes || '',
      file_url: c.file_url,
      file_name: c.file_name,
    });
    setOpen(true);
  };

  const handleNew = () => {
    setForm(emptyForm());
    setOpen(true);
  };

  const handleFileUpload = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: 'Fichier trop volumineux', description: 'Maximum 20 Mo.', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const path = `${clientId}/contract_${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from('client-documents').upload(path, file);
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('client-documents').getPublicUrl(path);
      setForm((f) => ({ ...f, file_url: urlData.publicUrl, file_name: file.name }));
      toast({ title: 'Fichier ajouté' });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemoveFile = async () => {
    if (!form.file_url) return;
    try {
      const url = new URL(form.file_url);
      const parts = url.pathname.split('/client-documents/');
      if (parts.length > 1) {
        await supabase.storage.from('client-documents').remove([decodeURIComponent(parts[1])]);
      }
    } catch {
      // ignore
    }
    setForm((f) => ({ ...f, file_url: null, file_name: null }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Nom requis', variant: 'destructive' });
      return;
    }
    const visits = form.visits_per_period ? parseInt(form.visits_per_period, 10) : null;
    await upsert.mutateAsync({
      id: form.id,
      client_id: clientId,
      name: form.name.trim(),
      contract_type: form.contract_type || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      visits_per_period: visits && !isNaN(visits) ? visits : null,
      visits_period: form.visits_period,
      notes: form.notes || null,
      file_url: form.file_url,
      file_name: form.file_name,
      is_active: true,
    });
    setOpen(false);
  };

  return (
    <div className={disabled ? 'opacity-50 pointer-events-none select-none space-y-3' : 'space-y-3'}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {contracts.length === 0
            ? 'Aucun contrat enregistré pour ce client.'
            : `${contracts.length} contrat${contracts.length > 1 ? 's' : ''} enregistré${contracts.length > 1 ? 's' : ''}.`}
        </p>
        <Button type="button" size="sm" onClick={handleNew} disabled={disabled}>
          <Plus className="h-4 w-4 mr-1.5" /> Ajouter un contrat
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-2">
          {contracts.map((c) => (
            <Card key={c.id} className="p-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold">{c.name}</span>
                    {c.contract_type && (
                      <Badge variant="outline" className="text-[10px] h-5">
                        {c.contract_type}
                      </Badge>
                    )}
                    {c.file_url && (
                      <a
                        href={c.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary inline-flex items-center gap-1 underline"
                      >
                        <FileText className="h-3 w-3" /> {c.file_name || 'Fichier'}
                      </a>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {c.start_date && (
                      <span className="flex items-center gap-1">
                        <CalendarClock className="h-3 w-3" />
                        Début : {format(parseISO(c.start_date), 'dd MMM yyyy', { locale: fr })}
                      </span>
                    )}
                    {c.end_date && (
                      <span className="flex items-center gap-1">
                        <CalendarClock className="h-3 w-3" />
                        Fin : {format(parseISO(c.end_date), 'dd MMM yyyy', { locale: fr })}
                      </span>
                    )}
                    {c.visits_per_period != null && (
                      <span className="flex items-center gap-1">
                        <RefreshCw className="h-3 w-3" />
                        {c.visits_per_period} visite{c.visits_per_period > 1 ? 's' : ''} {periodLabels[c.visits_period]}
                      </span>
                    )}
                  </div>
                  {c.notes && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button type="button" variant="ghost" size="icon" onClick={() => handleEdit(c)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button type="button" variant="ghost" size="icon">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer ce contrat ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Cette action est irréversible. Les alertes liées seront détachées.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => del.mutate({ id: c.id, client_id: clientId })}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Supprimer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Modifier le contrat' : 'Nouveau contrat'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nom du contrat *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Contrat ascenseur, Contrat climatisation..."
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Input
                  value={form.contract_type}
                  onChange={(e) => setForm({ ...form, contract_type: e.target.value })}
                  placeholder="Standard, Premium..."
                />
              </div>
              <div className="space-y-2">
                <Label>Nombre de visites</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={0}
                    value={form.visits_per_period}
                    onChange={(e) => setForm({ ...form, visits_per_period: e.target.value })}
                    className="flex-1"
                    placeholder="2"
                  />
                  <Select
                    value={form.visits_period}
                    onValueChange={(v: ContractPeriod) => setForm({ ...form, visits_period: v })}
                  >
                    <SelectTrigger className="w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">par jour</SelectItem>
                      <SelectItem value="week">par semaine</SelectItem>
                      <SelectItem value="month">par mois</SelectItem>
                      <SelectItem value="year">par an</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Date de début</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Date de fin</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Détails du contrat, conditions particulières..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Fichier du contrat</Label>
              {form.file_url ? (
                <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="flex-1 text-sm truncate">{form.file_name || 'Fichier'}</span>
                  <Button type="button" variant="outline" size="sm" asChild>
                    <a href={form.file_url} target="_blank" rel="noreferrer">
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button type="button" variant="ghost" size="icon" onClick={handleRemoveFile}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-3 flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">PDF, image ou document — 20 Mo max</span>
                  <input
                    ref={inputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFileUpload(f);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => inputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Upload className="h-4 w-4 mr-1.5" />}
                    Téléverser
                  </Button>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="button" onClick={handleSave} disabled={upsert.isPending}>
              {form.id ? 'Mettre à jour' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
