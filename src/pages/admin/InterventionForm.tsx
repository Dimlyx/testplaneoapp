import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useIntervention, useCreateIntervention, useUpdateIntervention } from "@/hooks/useInterventions";
import { useClients } from "@/hooks/useClients";
import { useTechnicians } from "@/hooks/useTechnicians";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { useAddInterventionAttachment } from "@/hooks/useInterventionAttachments";
import { useInterventionTypes } from "@/hooks/useInterventionTypes";
import { useCustomStatuses } from "@/hooks/useCustomStatuses";
import { useTeams } from "@/hooks/useTeams";
import { useOrganizationPlan } from "@/hooks/useOrganizationPlan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save, Paperclip, Mail, Loader2, Lock, Plus, Users, Crown } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import AttachmentsList from "@/components/technician/AttachmentsList";
import PendingAttachmentsList from "@/components/admin/PendingAttachmentsList";
import { QuickCreateClientDialog } from "@/components/admin/QuickCreateClientDialog";
import { ClientCombobox } from "@/components/admin/ClientCombobox";
import { supabase } from "@/integrations/supabase/client";

const interventionSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  description: z.string().optional(),
  client_id: z.string().min(1, "Le client est requis"),
  technician_id: z.string().optional(),
  intervention_type: z.string().min(1, "Le type est requis"),
  status: z.enum(["to_plan", "planned", "in_progress", "completed", "to_invoice", "archived", "cancelled"]),
  custom_status_id: z.string().optional().nullable(),
  scheduled_date: z.string().optional(),
  scheduled_time: z.string().optional(),
  scheduled_end_time: z.string().optional(),
  report: z.string().optional(),
  technical_comments: z.string().optional(),
  intervention_address: z.string().optional(),
  intervention_building: z.string().optional(),
  intervention_floor: z.string().optional(),
  intervention_city: z.string().optional(),
  intervention_postal_code: z.string().optional(),
  intervention_phone: z.string().optional(),
  intervention_email: z.string().optional(),
  intervention_contact_name: z.string().optional(),
});

type InterventionFormValues = z.infer<typeof interventionSchema>;

const InterventionForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEditing = !!id;
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [shouldSendEmail, setShouldSendEmail] = useState(false);
  const [showCreateClient, setShowCreateClient] = useState(false);
  const [assignmentMode, setAssignmentMode] = useState<'technician' | 'team'>('technician');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');

  const { data: organizationId } = useUserOrganization();
  const { data: intervention, isLoading: loadingIntervention } = useIntervention(id || "");
  const { data: clients = [], isLoading: loadingClients } = useClients();
  const { data: technicians = [], isLoading: loadingTechnicians } = useTechnicians(organizationId);
  const { data: interventionTypes = [] } = useInterventionTypes();
  const { data: customStatuses = [] } = useCustomStatuses();
  const { data: teams = [] } = useTeams();
  const { hasFeature } = useOrganizationPlan();
  const createIntervention = useCreateIntervention(organizationId);
  const updateIntervention = useUpdateIntervention();
  const addAttachment = useAddInterventionAttachment();

  const form = useForm<InterventionFormValues>({
    resolver: zodResolver(interventionSchema),
    defaultValues: {
      title: "",
      description: "",
      client_id: "",
      technician_id: "",
      intervention_type: "",
      status: "to_plan",
      custom_status_id: null,
      scheduled_date: "",
      scheduled_time: "",
      scheduled_end_time: "",
      report: "",
      technical_comments: "",
      intervention_address: "",
      intervention_building: "",
      intervention_floor: "",
      intervention_city: "",
      intervention_postal_code: "",
      intervention_phone: "",
      intervention_email: "",
      intervention_contact_name: "",
    },
  });

  useEffect(() => {
    if (intervention && isEditing) {
      form.reset({
        title: intervention.title,
        description: intervention.description || "",
        client_id: intervention.client_id,
        technician_id: intervention.technician_id || "",
        intervention_type: intervention.intervention_type,
        status: intervention.status,
        custom_status_id: intervention.custom_status_id || null,
        scheduled_date: intervention.scheduled_date || "",
        scheduled_time: intervention.scheduled_time || "",
        scheduled_end_time: intervention.scheduled_end_time || "",
        report: intervention.report || "",
        technical_comments: intervention.technical_comments || "",
        intervention_address: intervention.intervention_address || "",
        intervention_building: (intervention as any).intervention_building || "",
        intervention_floor: (intervention as any).intervention_floor || "",
        intervention_city: intervention.intervention_city || "",
        intervention_postal_code: intervention.intervention_postal_code || "",
        intervention_phone: intervention.intervention_phone || "",
        intervention_email: intervention.intervention_email || "",
        intervention_contact_name: intervention.intervention_contact_name || "",
      });
      // Detect team assignment mode
      if ((intervention as any).team_id) {
        setAssignmentMode('team');
        setSelectedTeamId((intervention as any).team_id);
      }
    }
  }, [intervention, isEditing, form]);

  // Pre-fill from URL params (e.g. from maintenance alert)
  useEffect(() => {
    if (!isEditing) {
      const title = searchParams.get('title');
      const clientId = searchParams.get('client_id');
      const description = searchParams.get('description');
      if (title) form.setValue('title', title);
      if (clientId) form.setValue('client_id', clientId);
      if (description) form.setValue('description', description);
    }
  }, [isEditing, searchParams, form]);

  const onSubmit = async (values: InterventionFormValues) => {
    try {
      // If team mode, set technician_id to leader and add team_id
      let finalTechnicianId = values.technician_id || null;
      let finalTeamId: string | null = null;
      if (assignmentMode === 'team' && selectedTeamId) {
        const selectedTeam = teams.find(t => t.id === selectedTeamId);
        finalTechnicianId = selectedTeam?.leader_id || null;
        finalTeamId = selectedTeamId;
      }

      const data: Record<string, any> = {
        title: values.title,
        client_id: values.client_id,
        intervention_type: values.intervention_type,
        status: values.status,
        custom_status_id: values.custom_status_id || null,
        technician_id: finalTechnicianId,
        team_id: finalTeamId,
        scheduled_date: values.scheduled_date || null,
        scheduled_time: values.scheduled_time || null,
        scheduled_end_time: values.scheduled_end_time || null,
        estimated_duration: (values.scheduled_time && values.scheduled_end_time) 
          ? Math.round((new Date(`2000-01-01T${values.scheduled_end_time}`).getTime() - new Date(`2000-01-01T${values.scheduled_time}`).getTime()) / 60000) 
          : null,
        description: values.description || null,
        report: values.report || null,
        technical_comments: values.technical_comments || null,
        intervention_address: values.intervention_address || null,
        intervention_building: values.intervention_building || null,
        intervention_floor: values.intervention_floor || null,
        intervention_city: values.intervention_city || null,
        intervention_postal_code: values.intervention_postal_code || null,
        intervention_phone: values.intervention_phone || null,
        intervention_email: values.intervention_email || null,
        intervention_contact_name: values.intervention_contact_name || null,
      };

      let interventionId: string | undefined;

      if (isEditing && id) {
        await updateIntervention.mutateAsync({ id, ...data });
        interventionId = id;
        toast({ title: "Intervention mise à jour avec succès" });
      } else {
        const result = await createIntervention.mutateAsync(data as any);
        interventionId = result?.id;
        
        // Upload pending attachments after intervention is created
        if (pendingFiles.length > 0 && interventionId) {
          for (const file of pendingFiles) {
            await addAttachment.mutateAsync({ interventionId, file });
          }
        }
        
        toast({ title: "Intervention créée avec succès" });
      }

      // Send email notification if requested
      if (shouldSendEmail && interventionId) {
        try {
          setSendingEmail(true);
          const { data: notifData, error } = await supabase.functions.invoke('send-client-notification', {
            body: { interventionId },
          });
          if (error) throw error;
          if (notifData?.error) throw new Error(notifData.error);
          toast({ title: "Notification envoyée au client" });
        } catch (e: any) {
          toast({ title: e?.message || "Erreur lors de l'envoi de la notification", variant: "destructive" });
        } finally {
          setSendingEmail(false);
          setShouldSendEmail(false);
        }
      }

      navigate("/admin/interventions");
    } catch (error) {
      toast({ 
        title: isEditing ? "Erreur lors de la mise à jour" : "Erreur lors de la création", 
        variant: "destructive" 
      });
    }
  };

  if ((isEditing && loadingIntervention) || loadingClients || loadingTechnicians) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {isEditing ? "Modifier l'intervention" : "Nouvelle intervention"}
          </h1>
          <p className="text-muted-foreground">
            {isEditing ? "Modifiez les détails de l'intervention" : "Créez une nouvelle intervention"}
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Informations générales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Titre *</FormLabel>
                      <FormControl>
                        <Input placeholder="Titre de l'intervention" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Description détaillée de l'intervention" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="intervention_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner un type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {interventionTypes.map((t) => (
                              <SelectItem key={t.id} value={t.name}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Statut *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner un statut" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="to_plan">À planifier</SelectItem>
                            <SelectItem value="planned">Planifiée</SelectItem>
                            <SelectItem value="in_progress">En cours</SelectItem>
                            <SelectItem value="completed">Terminée</SelectItem>
                            <SelectItem value="to_invoice">À facturer</SelectItem>
                            <SelectItem value="archived">Archivée</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {customStatuses.length > 0 && (
                    <FormField
                      control={form.control}
                      name="custom_status_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Statut personnalisé</FormLabel>
                          <Select onValueChange={(v) => field.onChange(v === "none" ? null : v)} value={field.value || "none"}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Aucun" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">Aucun</SelectItem>
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
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Assignation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="client_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client *</FormLabel>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <FormControl>
                            <ClientCombobox
                              clients={clients}
                              value={field.value}
                              onValueChange={field.onChange}
                            />
                          </FormControl>
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
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Assignment mode toggle */}
                <div className="space-y-3">
                  <FormLabel>Assignation</FormLabel>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={assignmentMode === 'technician' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => { setAssignmentMode('technician'); setSelectedTeamId(''); }}
                    >
                      Technicien seul
                    </Button>
                    <Button
                      type="button"
                      variant={assignmentMode === 'team' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => { setAssignmentMode('team'); form.setValue('technician_id', ''); }}
                    >
                      <Users className="h-4 w-4 mr-1" /> Équipe
                    </Button>
                  </div>

                  {assignmentMode === 'technician' ? (
                    <FormField
                      control={form.control}
                      name="technician_id"
                      render={({ field }) => (
                        <FormItem>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Sélectionner un technicien" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {technicians.map((tech) => (
                                <SelectItem key={tech.id} value={tech.id}>
                                  {tech.full_name || tech.email}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
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
                        const leaderName = technicians.find(t => t.id === team.leader_id);
                        return (
                          <div className="mt-2 p-2 bg-muted/50 rounded text-xs space-y-1">
                            <div className="flex items-center gap-1">
                              <Crown className="h-3 w-3 text-yellow-500" />
                              <span className="font-medium">Chef : {leaderName?.full_name || leaderName?.email}</span>
                              <span className="text-muted-foreground">(rapport & validation)</span>
                            </div>
                            <div className="text-muted-foreground">
                              Membres : {team.members.filter(m => m.user_id !== team.leader_id).map(m => {
                                const t = technicians.find(tech => tech.id === m.user_id);
                                return t?.full_name || t?.email;
                              }).join(', ') || 'Aucun autre membre'}
                              <span> (consultation seule)</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="scheduled_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date prévue</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="scheduled_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Heure prévue</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2 mt-2">
                  <FormField
                    control={form.control}
                    name="scheduled_end_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Heure fin</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex items-end">
                    {hasFeature('email') ? (
                      isEditing && id ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full h-10"
                          disabled={sendingEmail || !form.watch('scheduled_date')}
                          onClick={async () => {
                            setSendingEmail(true);
                            try {
                              const { error } = await supabase.functions.invoke('send-client-notification', {
                                body: { interventionId: id },
                              });
                              if (error) throw error;
                              toast({ title: "Notification envoyée au client" });
                            } catch {
                              toast({ title: "Erreur lors de l'envoi", variant: "destructive" });
                            } finally {
                              setSendingEmail(false);
                            }
                          }}
                        >
                          {sendingEmail ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Mail className="h-4 w-4 mr-2" />
                          )}
                          Notifier le client
                        </Button>
                      ) : (
                        <Button
                          type="submit"
                          variant="outline"
                          size="sm"
                          className="w-full h-10"
                          disabled={!form.watch('scheduled_date') || !form.watch('client_id') || !form.watch('title')}
                          onClick={() => setShouldSendEmail(true)}
                        >
                          <Mail className="h-4 w-4 mr-2" />
                          Créer et notifier
                        </Button>
                      )
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full h-10 opacity-50 cursor-not-allowed"
                        disabled
                      >
                        <Lock className="h-4 w-4 mr-2" />
                        Notifier le client
                        <span className="ml-auto text-[10px] border border-muted-foreground/20 text-muted-foreground/60 rounded px-1.5">Business</span>
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Adresse d'intervention</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Si l'intervention a lieu à une adresse différente de celle du client
                </p>
                <FormField
                  control={form.control}
                  name="intervention_contact_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom et prénom du contact</FormLabel>
                      <FormControl>
                        <Input placeholder="Nom et prénom du contact sur site" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="intervention_address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Adresse</FormLabel>
                      <FormControl>
                        <Input placeholder="Adresse de l'intervention" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="intervention_building"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bâtiment</FormLabel>
                        <FormControl>
                          <Input placeholder="Bâtiment / Résidence" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="intervention_floor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Étage</FormLabel>
                        <FormControl>
                          <Input placeholder="Étage / Porte" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="intervention_city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ville</FormLabel>
                        <FormControl>
                          <Input placeholder="Ville" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="intervention_postal_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Code postal</FormLabel>
                        <FormControl>
                          <Input placeholder="Code postal" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="intervention_phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Téléphone</FormLabel>
                        <FormControl>
                          <Input placeholder="Téléphone de contact" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="intervention_email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="Email de contact" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Paperclip className="h-5 w-5" />
                  Pièces jointes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Ajoutez des documents pour le technicien (notices, plans, etc.)
                </p>
                {isEditing && id ? (
                  <AttachmentsList interventionId={id} isReadOnly={false} />
                ) : (
                  <PendingAttachmentsList files={pendingFiles} onFilesChange={setPendingFiles} />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              Annuler
            </Button>
            <Button type="submit" disabled={createIntervention.isPending || updateIntervention.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {isEditing ? "Mettre à jour" : "Créer l'intervention"}
            </Button>
          </div>
        </form>
      </Form>

      <QuickCreateClientDialog
        open={showCreateClient}
        onOpenChange={setShowCreateClient}
        onClientCreated={(clientId) => form.setValue('client_id', clientId)}
      />
    </div>
  );
};

export default InterventionForm;
