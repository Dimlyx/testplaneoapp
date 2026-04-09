import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useClients } from '@/hooks/useClients';
import { useInterventionTypes } from '@/hooks/useInterventionTypes';
import { useCreateIntervention } from '@/hooks/useInterventions';
import { useAuth } from '@/lib/auth-context';
import { useUserOrganization } from '@/hooks/useUserOrganization';
import { toast } from '@/hooks/use-toast';
import { Plus, Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function TechnicianCreateInterventionDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { data: organizationId } = useUserOrganization();
  const { data: clients = [] } = useClients();
  const { data: interventionTypes = [] } = useInterventionTypes();
  const createIntervention = useCreateIntervention(organizationId);

  const [form, setForm] = useState({
    title: '',
    client_id: '',
    intervention_type: '',
    description: '',
    scheduled_date: '',
    scheduled_time: '',
    intervention_address: '',
    intervention_city: '',
    intervention_postal_code: '',
  });

  const resetForm = () => {
    setForm({
      title: '',
      client_id: '',
      intervention_type: '',
      description: '',
      scheduled_date: '',
      scheduled_time: '',
      intervention_address: '',
      intervention_city: '',
      intervention_postal_code: '',
    });
  };

  const handleSubmit = async () => {
    if (!form.title || !form.client_id || !form.intervention_type) {
      toast({ title: 'Veuillez remplir les champs obligatoires', variant: 'destructive' });
      return;
    }

    try {
      await createIntervention.mutateAsync({
        title: form.title,
        client_id: form.client_id,
        intervention_type: form.intervention_type,
        description: form.description || undefined,
        scheduled_date: form.scheduled_date || null,
        scheduled_time: form.scheduled_time || null,
        intervention_address: form.intervention_address || null,
        intervention_city: form.intervention_city || null,
        intervention_postal_code: form.intervention_postal_code || null,
        technician_id: user?.id,
        organization_id: organizationId,
        status: form.scheduled_date ? 'planned' : 'to_plan',
      });
      toast({ title: 'Intervention créée avec succès' });
      resetForm();
      onOpenChange(false);
    } catch {
      toast({ title: 'Erreur lors de la création', variant: 'destructive' });
    }
  };

  // Auto-fill address when client is selected
  const handleClientChange = (clientId: string) => {
    setForm(f => ({ ...f, client_id: clientId }));
    const client = clients.find(c => c.id === clientId);
    if (client && !form.intervention_address) {
      setForm(f => ({
        ...f,
        client_id: clientId,
        intervention_address: client.address || '',
        intervention_city: client.city || '',
        intervention_postal_code: client.postal_code || '',
      }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Nouvelle intervention
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Titre *</Label>
            <Input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Titre de l'intervention"
            />
          </div>

          <div>
            <Label>Client *</Label>
            <Select value={form.client_id} onValueChange={handleClientChange}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
              <SelectContent>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Type d'intervention *</Label>
            <Select value={form.intervention_type} onValueChange={v => setForm(f => ({ ...f, intervention_type: v }))}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un type" /></SelectTrigger>
              <SelectContent>
                {interventionTypes.map(t => (
                  <SelectItem key={t.id} value={t.name}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Description de l'intervention..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={form.scheduled_date}
                onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))}
              />
            </div>
            <div>
              <Label>Heure début</Label>
              <Input
                type="time"
                value={form.scheduled_time}
                onChange={e => setForm(f => ({ ...f, scheduled_time: e.target.value }))}
              />
            </div>
            <div>
              <Label>Heure fin</Label>
              <Input
                type="time"
                value={form.scheduled_end_time}
                onChange={e => setForm(f => ({ ...f, scheduled_end_time: e.target.value }))}
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-3">Adresse d'intervention</h4>
            <div className="space-y-3">
              <div>
                <Label>Adresse</Label>
                <Input
                  value={form.intervention_address}
                  onChange={e => setForm(f => ({ ...f, intervention_address: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Code postal</Label>
                  <Input
                    value={form.intervention_postal_code}
                    onChange={e => setForm(f => ({ ...f, intervention_postal_code: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Ville</Label>
                  <Input
                    value={form.intervention_city}
                    onChange={e => setForm(f => ({ ...f, intervention_city: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button onClick={handleSubmit} disabled={createIntervention.isPending}>
              {createIntervention.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Création...</>
              ) : (
                'Créer l\'intervention'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
