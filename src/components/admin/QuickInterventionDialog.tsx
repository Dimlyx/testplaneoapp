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
import { AddressAutocomplete } from '@/components/ui/address-autocomplete';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TimePicker } from '@/components/ui/time-picker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Users, Crown, Mail, Loader2, Lock, Paperclip } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useClients } from '@/hooks/useClients';
import { useCreateIntervention } from '@/hooks/useInterventions';
import { useUserOrganization } from '@/hooks/useUserOrganization';
import { useInterventionTypes } from '@/hooks/useInterventionTypes';
import { useCustomStatuses } from '@/hooks/useCustomStatuses';
import { useTeams } from '@/hooks/useTeams';
import { useOrganizationPlan } from '@/hooks/useOrganizationPlan';
import { useAddInterventionAttachment } from '@/hooks/useInterventionAttachments';
import { Technician } from '@/hooks/useTechnicians';
import { QuickCreateClientDialog } from './QuickCreateClientDialog';
import { ClientCombobox } from './ClientCombobox';
import PendingAttachmentsList from './PendingAttachmentsList';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type InterventionStatus = Database['public']['Enums']['intervention_status'];

interface QuickInterventionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTechnicianId?: string;
  defaultDate?: Date;
  technicians: Technician[];
}

const initialForm = {
  title: '',
  description: '',
  client_id: '',
  intervention_type: '',
  status: 'to_plan' as InterventionStatus,
  custom_status_id: '' as string,
  technician_id: '',
  scheduled_date: '',
  scheduled_time: '',
  scheduled_end_time: '',
  intervention_contact_name: '',
  intervention_address: '',
  intervention_building: '',
  intervention_floor: '',
  intervention_city: '',
  intervention_postal_code: '',
  intervention_phone: '',
  intervention_email: '',
};

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
  const { data: customStatuses = [] } = useCustomStatuses();
  const { data: teams = [] } = useTeams();
  const { hasFeature } = useOrganizationPlan();
  const addAttachment = useAddInterventionAttachment();

  const [showCreateClient, setShowCreateClient] = useState(false);
  const [assignmentMode, setAssignmentMode] = useState<'technician' | 'team'>('technician');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [shouldSendEmail, setShouldSendEmail] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState(initialForm);

  // Update form when defaults change (open or defaults updated)
  useEffect(() => {
    if (!open) return;
    const baseDate = defaultDate ? format(defaultDate, 'yyyy-MM-dd') : '';
    const hasTime = defaultDate && (defaultDate.getHours() !== 0 || defaultDate.getMinutes() !== 0);
    const baseTime = hasTime ? format(defaultDate!, 'HH:mm') : '';
    setFormData(prev => ({
      ...initialForm,
      technician_id: defaultTechnicianId || '',
      scheduled_date: baseDate,
      scheduled_time: baseTime,
      status: baseDate ? 'planned' : 'to_plan',
    }));
    setAssignmentMode('technician');
    setSelectedTeamId('');
    setPendingFiles([]);
    setShouldSendEmail(false);
  }, [open, defaultTechnicianId, defaultDate]);

  // Auto-fill address when client changes (only if address is empty)
  const handleClientChange = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    setFormData(prev => ({
      ...prev,
      client_id: clientId,
      intervention_address: prev.intervention_address || client?.address || '',
      intervention_city: prev.intervention_city || client?.city || '',
      intervention_postal_code: prev.intervention_postal_code || client?.postal_code || '',
    }));
  };

  const handleSubmit = async (sendEmail = false) => {
    if (!formData.title || !formData.client_id || !formData.intervention_type) {
      toast({ title: 'Veuillez remplir le titre, le client et le type', variant: 'destructive' });
      return;
    }

    try {
      setSubmitting(true);

      // Resolve assignment
      let finalTechnicianId: string | null = formData.technician_id || null;
      let finalTeamId: string | null = null;
      if (assignmentMode === 'team' && selectedTeamId) {
        const selectedTeam = teams.find(t => t.id === selectedTeamId);
        finalTechnicianId = selectedTeam?.leader_id || null;
        finalTeamId = selectedTeamId;
      }

      const estimatedDuration = (formData.scheduled_time && formData.scheduled_end_time)
        ? Math.round(
            (new Date(`2000-01-01T${formData.scheduled_end_time}`).getTime() -
              new Date(`2000-01-01T${formData.scheduled_time}`).getTime()) / 60000
          )
        : null;

      const payload: Record<string, any> = {
        title: formData.title,
        description: formData.description || null,
        client_id: formData.client_id,
        intervention_type: formData.intervention_type,
        status: formData.status,
        custom_status_id: formData.custom_status_id || null,
        technician_id: finalTechnicianId,
        team_id: finalTeamId,
        scheduled_date: formData.scheduled_date || null,
        scheduled_time: formData.scheduled_time || null,
        scheduled_end_time: formData.scheduled_end_time || null,
        estimated_duration: estimatedDuration,
        intervention_contact_name: formData.intervention_contact_name || null,
        intervention_address: formData.intervention_address || null,
        intervention_building: formData.intervention_building || null,
        intervention_floor: formData.intervention_floor || null,
        intervention_city: formData.intervention_city || null,
        intervention_postal_code: formData.intervention_postal_code || null,
        intervention_phone: formData.intervention_phone || null,
        intervention_email: formData.intervention_email || null,
      };

      const result: any = await createIntervention.mutateAsync(payload as any);
      const interventionId = result?.id;

      // Upload attachments
      if (pendingFiles.length > 0 && interventionId) {
        for (const file of pendingFiles) {
          await addAttachment.mutateAsync({ interventionId, file });
        }
      }

      // Email notification
      if (sendEmail && interventionId && hasFeature('email')) {
        try {
          const { data: notifData, error } = await supabase.functions.invoke(
            'send-client-notification',
            { body: { interventionId } }
          );
          if (error) throw error;
          if (notifData?.error) throw new Error(notifData.error);
          toast({ title: 'Notification envoyée au client' });
        } catch (e: any) {
          toast({
            title: e?.message || "Erreur lors de l'envoi de la notification",
            variant: 'destructive',
          });
        }
      }

      toast({ title: 'Intervention créée avec succès' });
      onOpenChange(false);
    } catch {
      toast({ title: 'Erreur lors de la création', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Nouvelle intervention
            {defaultDate && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                - {format(defaultDate, 'EEEE d MMMM yyyy', { locale: fr })}
                {formData.scheduled_time && ` à ${formData.scheduled_time}`}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general">Général</TabsTrigger>
            <TabsTrigger value="planning">Planification</TabsTrigger>
            <TabsTrigger value="address">Adresse</TabsTrigger>
            <TabsTrigger value="files">
              <Paperclip className="h-3.5 w-3.5 mr-1" />
              Pièces jointes
            </TabsTrigger>
          </TabsList>

          {/* GENERAL */}
          <TabsContent value="general" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Titre *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ex: Maintenance climatisation"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Détails de l'intervention..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Client *</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <ClientCombobox
                    clients={clients}
                    value={formData.client_id}
                    onValueChange={handleClientChange}
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type *</Label>
                <Select
                  value={formData.intervention_type}
                  onValueChange={(value) =>
                    setFormData(prev => ({ ...prev, intervention_type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un type" />
                  </SelectTrigger>
                  <SelectContent>
                    {interventionTypes.map((t) => (
                      <SelectItem key={t.id} value={t.name}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Statut</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData(prev => ({ ...prev, status: value as InterventionStatus }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="to_plan">À planifier</SelectItem>
                    <SelectItem value="planned">Planifiée</SelectItem>
                    <SelectItem value="in_progress">En cours</SelectItem>
                    <SelectItem value="completed">Terminée</SelectItem>
                    <SelectItem value="to_invoice">À facturer</SelectItem>
                    <SelectItem value="archived">Archivée</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {customStatuses.length > 0 && (
              <div className="space-y-2">
                <Label>Statut personnalisé</Label>
                <Select
                  value={formData.custom_status_id || 'none'}
                  onValueChange={(v) =>
                    setFormData(prev => ({ ...prev, custom_status_id: v === 'none' ? '' : v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Aucun" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {customStatuses.map((cs) => (
                      <SelectItem key={cs.id} value={cs.id}>
                        <span className="flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: cs.color }}
                          />
                          {cs.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </TabsContent>

          {/* PLANNING */}
          <TabsContent value="planning" className="space-y-4 mt-4">
            <div className="space-y-3">
              <Label>Assignation</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={assignmentMode === 'technician' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setAssignmentMode('technician');
                    setSelectedTeamId('');
                  }}
                >
                  Technicien seul
                </Button>
                <Button
                  type="button"
                  variant={assignmentMode === 'team' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setAssignmentMode('team');
                    setFormData(prev => ({ ...prev, technician_id: '' }));
                  }}
                >
                  <Users className="h-4 w-4 mr-1" /> Équipe
                </Button>
              </div>

              {assignmentMode === 'technician' ? (
                <Select
                  value={formData.technician_id || 'none'}
                  onValueChange={(value) =>
                    setFormData(prev => ({
                      ...prev,
                      technician_id: value === 'none' ? '' : value,
                    }))
                  }
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
              ) : (
                <div>
                  <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une équipe" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map(team => (
                        <SelectItem key={team.id} value={team.id}>
                          <div className="flex items-center gap-2">
                            <Users className="h-3.5 w-3.5" />
                            {team.name}
                            <span className="text-xs text-muted-foreground">
                              ({team.members.length} membres)
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedTeamId && (() => {
                    const team = teams.find(t => t.id === selectedTeamId);
                    if (!team) return null;
                    const leader = technicians.find(t => t.id === team.leader_id);
                    return (
                      <div className="mt-2 p-2 bg-muted/50 rounded text-xs space-y-1">
                        <div className="flex items-center gap-1">
                          <Crown className="h-3 w-3 text-yellow-500" />
                          <span className="font-medium">
                            Chef : {leader?.full_name || leader?.email}
                          </span>
                          <span className="text-muted-foreground">(rapport & validation)</span>
                        </div>
                        <div className="text-muted-foreground">
                          Membres :{' '}
                          {team.members
                            .filter(m => m.user_id !== team.leader_id)
                            .map(m => {
                              const t = technicians.find(tech => tech.id === m.user_id);
                              return t?.full_name || t?.email;
                            })
                            .join(', ') || 'Aucun autre membre'}{' '}
                          (consultation seule)
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Date prévue</Label>
                <Input
                  type="date"
                  value={formData.scheduled_date}
                  onChange={(e) =>
                    setFormData(prev => ({ ...prev, scheduled_date: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Heure début</Label>
                <TimePicker
                  value={formData.scheduled_time}
                  onChange={(v) => setFormData(prev => ({ ...prev, scheduled_time: v }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Heure fin</Label>
                <TimePicker
                  value={formData.scheduled_end_time}
                  onChange={(v) => setFormData(prev => ({ ...prev, scheduled_end_time: v }))}
                />
              </div>
            </div>
          </TabsContent>

          {/* ADDRESS */}
          <TabsContent value="address" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Si l'intervention a lieu à une adresse différente de celle du client
            </p>

            <div className="space-y-2">
              <Label>Nom et prénom du contact</Label>
              <Input
                value={formData.intervention_contact_name}
                onChange={(e) =>
                  setFormData(prev => ({ ...prev, intervention_contact_name: e.target.value }))
                }
                placeholder="Contact sur site"
              />
            </div>

            <div className="space-y-2">
              <Label>Adresse</Label>
              <AddressAutocomplete
                id="quick-intervention-address"
                value={formData.intervention_address}
                onChange={(v) =>
                  setFormData(prev => ({ ...prev, intervention_address: v }))
                }
                onAddressSelect={(s) =>
                  setFormData(prev => ({
                    ...prev,
                    intervention_address: s.street || s.label,
                    intervention_postal_code: s.postcode,
                    intervention_city: s.city,
                  }))
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Bâtiment</Label>
                <Input
                  value={formData.intervention_building}
                  onChange={(e) =>
                    setFormData(prev => ({ ...prev, intervention_building: e.target.value }))
                  }
                  placeholder="Bâtiment / Résidence"
                />
              </div>
              <div className="space-y-2">
                <Label>Étage</Label>
                <Input
                  value={formData.intervention_floor}
                  onChange={(e) =>
                    setFormData(prev => ({ ...prev, intervention_floor: e.target.value }))
                  }
                  placeholder="Étage / Porte"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Code postal</Label>
                <Input
                  value={formData.intervention_postal_code}
                  onChange={(e) =>
                    setFormData(prev => ({ ...prev, intervention_postal_code: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Ville</Label>
                <Input
                  value={formData.intervention_city}
                  onChange={(e) =>
                    setFormData(prev => ({ ...prev, intervention_city: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Téléphone</Label>
                <Input
                  value={formData.intervention_phone}
                  onChange={(e) =>
                    setFormData(prev => ({ ...prev, intervention_phone: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.intervention_email}
                  onChange={(e) =>
                    setFormData(prev => ({ ...prev, intervention_email: e.target.value }))
                  }
                />
              </div>
            </div>
          </TabsContent>

          {/* FILES */}
          <TabsContent value="files" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Ajoutez des documents pour le technicien (notices, plans, etc.)
            </p>
            <PendingAttachmentsList files={pendingFiles} onFilesChange={setPendingFiles} />
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          {hasFeature('email') ? (
            <Button
              type="button"
              variant="outline"
              disabled={
                submitting ||
                !formData.title ||
                !formData.client_id ||
                !formData.intervention_type ||
                !formData.scheduled_date
              }
              onClick={() => handleSubmit(true)}
            >
              {submitting && shouldSendEmail ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              Créer et notifier
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              disabled
              className="opacity-50 cursor-not-allowed"
            >
              <Lock className="h-4 w-4 mr-2" />
              Notifier le client
              <span className="ml-2 text-[10px] border border-muted-foreground/20 text-muted-foreground/60 rounded px-1.5">
                Business
              </span>
            </Button>
          )}
          <Button type="button" disabled={submitting} onClick={() => handleSubmit(false)}>
            {submitting ? 'Création...' : 'Créer'}
          </Button>
        </div>
      </DialogContent>

      <QuickCreateClientDialog
        open={showCreateClient}
        onOpenChange={setShowCreateClient}
        onClientCreated={(clientId) =>
          setFormData(prev => ({ ...prev, client_id: clientId }))
        }
      />
    </Dialog>
  );
}
