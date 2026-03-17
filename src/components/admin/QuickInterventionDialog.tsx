import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useClients } from '@/hooks/useClients';
import { useCreateIntervention } from '@/hooks/useInterventions';
import { useUserOrganization } from '@/hooks/useUserOrganization';
import { useInterventionTypes } from '@/hooks/useInterventionTypes';
import { Technician } from '@/hooks/useTechnicians';
import { QuickCreateClientDialog } from './QuickCreateClientDialog';
import { ClientCombobox } from './ClientCombobox';

interface QuickInterventionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTechnicianId?: string;
  defaultDate?: Date;
  technicians: Technician[];
}

export function QuickInterventionDialog({
  open,
  onOpenChange,
  defaultTechnicianId,
  defaultDate,
  technicians,
}: QuickInterventionDialogProps) {
  const { data: clients = [] } = useClients();
  const { data: organizationId } = useUserOrganization();
  const createIntervention = useCreateIntervention(organizationId);
  const { data: interventionTypes = [] } = useInterventionTypes();

  const [showCreateClient, setShowCreateClient] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    client_id: '',
    intervention_type: '',
    technician_id: defaultTechnicianId || '',
    scheduled_date: defaultDate ? format(defaultDate, 'yyyy-MM-dd') : '',
    scheduled_time: '',
    estimated_duration: '',
    description: '',
  });

  // Update form when defaults change
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      technician_id: defaultTechnicianId || prev.technician_id,
      scheduled_date: defaultDate ? format(defaultDate, 'yyyy-MM-dd') : prev.scheduled_date,
    }));
  }, [defaultTechnicianId, defaultDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.client_id) return;

    await createIntervention.mutateAsync({
      title: formData.title,
      client_id: formData.client_id,
      intervention_type: formData.intervention_type,
      technician_id: formData.technician_id || null,
      scheduled_date: formData.scheduled_date || null,
      scheduled_time: formData.scheduled_time || null,
      estimated_duration: formData.estimated_duration ? Number(formData.estimated_duration) : null,
      description: formData.description || null,
    });

    // Reset form
    setFormData({
      title: '',
      client_id: '',
      intervention_type: '',
      technician_id: '',
      scheduled_date: '',
      scheduled_time: '',
      estimated_duration: '',
      description: '',
    });
    
    onOpenChange(false);
  };

  const getTechnicianName = (techId: string) => {
    const tech = technicians.find(t => t.id === techId);
    return tech?.full_name || tech?.email || 'Technicien';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            Nouvelle intervention
            {defaultDate && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                - {format(defaultDate, 'EEEE d MMMM yyyy', { locale: fr })}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titre *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Ex: Maintenance climatisation"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="client">Client *</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <ClientCombobox
                    clients={clients}
                    value={formData.client_id}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, client_id: value }))}
                    placeholder="Sélectionner"
                  />
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => setShowCreateClient(true)}
                  title="Nouveau client"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select
                value={formData.intervention_type}
                onValueChange={(value) => setFormData(prev => ({ ...prev, intervention_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {interventionTypes.map((t) => (
                    <SelectItem key={t.id} value={t.name}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="technician">Technicien</Label>
              <Select
                value={formData.technician_id || "none"}
                onValueChange={(value) => setFormData(prev => ({ ...prev, technician_id: value === "none" ? "" : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Non assigné" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Non assigné</SelectItem>
                  {technicians.map(tech => (
                    <SelectItem key={tech.id} value={tech.id}>
                      {tech.full_name || tech.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="time">Heure</Label>
              <Input
                id="time"
                type="time"
                value={formData.scheduled_time}
                onChange={(e) => setFormData(prev => ({ ...prev, scheduled_time: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Durée (min)</Label>
              <Input
                id="duration"
                type="number"
                min={0}
                step={15}
                placeholder="60"
                value={formData.estimated_duration}
                onChange={(e) => setFormData(prev => ({ ...prev, estimated_duration: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Détails de l'intervention..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={createIntervention.isPending}>
              {createIntervention.isPending ? 'Création...' : 'Créer'}
            </Button>
          </div>
        </form>
      </DialogContent>

      <QuickCreateClientDialog
        open={showCreateClient}
        onOpenChange={setShowCreateClient}
        onClientCreated={(clientId) => setFormData(prev => ({ ...prev, client_id: clientId }))}
      />
    </Dialog>
  );
}
