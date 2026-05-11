import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useIntervention, useCreateIntervention, useUpdateIntervention } from "@/hooks/useInterventions";
import { useClient } from "@/hooks/useClients";
import { useInterventionPhotos, PhotoType } from "@/hooks/useInterventionPhotos";
import { useInterventionPauses } from "@/hooks/useInterventionPauses";
import { useCompanySettings, useDocumentSettings } from "@/hooks/useAppSettings";
import { useOrganizationPlan } from "@/hooks/useOrganizationPlan";
import { useInterventionTypes } from "@/hooks/useInterventionTypes";
import { useWorkflowSteps } from "@/hooks/useWorkflowSteps";
import { useStepCompletions } from "@/hooks/useStepCompletions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, TypeBadge } from "@/components/ui/status-badge";
import { TimesCorrectionDialog } from "@/components/admin/TimesCorrectionDialog";
import AdminStepEditor from "@/components/admin/AdminStepEditor";
import { 
  ArrowLeft, 
  Edit, 
  FileText, 
  User, 
  Wrench, 
  Calendar,
  Clock,
  ExternalLink,
  Copy,
  Image as ImageIcon,
  ClipboardList,
  CheckCircle,
  CopyPlus,
  Pause,
  Play,
  Mail,
  Loader2,
  Lock,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { generateInterventionPDF } from "@/lib/pdf-generator";
import { supabase } from "@/integrations/supabase/client";
import { PdfGenerationOverlay } from "@/components/PdfGenerationOverlay";
import { buildExtranetUrl } from "@/lib/extranet-url";

const parsePhotoUrls = (photoUrl: string | null): string[] => {
  if (!photoUrl) return [];
  let urls: string[] = [];
  try {
    const parsed = JSON.parse(photoUrl);
    if (Array.isArray(parsed)) urls = parsed;
    else urls = photoUrl ? [photoUrl] : [];
  } catch {
    urls = photoUrl ? [photoUrl] : [];
  }
  return urls.filter(u => !u.startsWith('blob:'));
};

const InterventionDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { data: intervention, isLoading, refetch } = useIntervention(id || "");
  const { data: client } = useClient(intervention?.client_id || "");
  const { data: photos = [] } = useInterventionPhotos(id || "");
  const { data: companySettings } = useCompanySettings();
  const { data: documentSettings } = useDocumentSettings();
  const { hasFeature } = useOrganizationPlan();

  // Fetch workflow steps and completions
  const { data: interventionTypes = [] } = useInterventionTypes();
  const matchingType = interventionTypes.find(
    t => t.name === intervention?.intervention_type
  );
  const { data: workflowSteps = [] } = useWorkflowSteps(matchingType?.id);
  const { data: stepCompletions = [] } = useStepCompletions(id || "");
  const updateIntervention = useUpdateIntervention();
  const { data: pauses = [] } = useInterventionPauses(id || "");
  const createIntervention = useCreateIntervention(intervention?.organization_id);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const getPhotosOfType = (type: PhotoType) => photos.filter(p => p.photo_type === type);

  const handleCopyLink = () => {
    if (intervention?.public_token) {
      const publicUrl = buildExtranetUrl(intervention.public_token);
      navigator.clipboard.writeText(publicUrl);
      toast({ title: "Lien copié dans le presse-papiers" });
    }
  };

  const handleDownloadPDF = async () => {
    if (!intervention || !client) return;
    setIsGeneratingPdf(true);
    try {
      await generateInterventionPDF(
        intervention,
        client,
        undefined,
        intervention.profiles?.full_name || undefined,
        photos,
        [],
        { company: companySettings!, report: { primaryColor: documentSettings?.primaryColor || '#003057', accentColor: documentSettings?.accentColor || '#0050A0', footerText: documentSettings?.footerText || '' }, documents: documentSettings! },
        stepCompletions,
        workflowSteps,
        interventionTypes
      );
      toast({ title: "PDF généré avec succès" });
    } catch (err: any) {
      toast({ title: "Erreur", description: err?.message || "Impossible de générer le PDF", variant: "destructive" });
    } finally {
      setIsGeneratingPdf(false);
    }
  };
  const handleDuplicate = async () => {
    if (!intervention) return;
    try {
      const result = await createIntervention.mutateAsync({
        client_id: intervention.client_id,
        technician_id: intervention.technician_id,
        intervention_type: intervention.intervention_type,
        title: `${intervention.title} (copie)`,
        description: intervention.description || undefined,
        intervention_address: intervention.intervention_address,
        intervention_city: intervention.intervention_city,
        intervention_postal_code: intervention.intervention_postal_code,
        intervention_phone: intervention.intervention_phone,
        intervention_email: intervention.intervention_email,
        organization_id: intervention.organization_id,
      });
      navigate(`/admin/interventions/${result.id}`);
    } catch {}
  };

  const handleCloseIntervention = async () => {
    if (!id) return;
    await updateIntervention.mutateAsync({
      id,
      status: 'completed',
    });
    toast({ title: "Intervention clôturée avec succès" });
    refetch();
  };

  const handleSendClientEmail = async () => {
    if (!id) return;
    setSendingEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-client-notification', {
        body: { interventionId: id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Email envoyé", description: "Le client a été notifié par email." });
    } catch (err: any) {
      toast({ title: "Erreur d'envoi", description: err.message || "Impossible d'envoyer l'email", variant: "destructive" });
    } finally {
      setSendingEmail(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!intervention) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Intervention non trouvée</p>
        <Button className="mt-4" onClick={() => navigate("/admin/interventions")}>
          Retour à la liste
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PdfGenerationOverlay open={isGeneratingPdf} />
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">{intervention.title}</h1>
            <div className="flex items-center gap-2 mt-2">
              <TypeBadge type={intervention.intervention_type} />
              <StatusBadge status={intervention.status} customStatusId={intervention.custom_status_id} />
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDuplicate} disabled={createIntervention.isPending}>
            <CopyPlus className="h-4 w-4 mr-2" />
            {createIntervention.isPending ? "Duplication..." : "Dupliquer"}
          </Button>
          <Button variant="outline" onClick={handleDownloadPDF} disabled={isGeneratingPdf}>
            {isGeneratingPdf ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
            PDF
          </Button>
          <Button onClick={() => navigate(`/admin/interventions/${id}/edit`)}>
            <Edit className="h-4 w-4 mr-2" />
            Modifier
          </Button>
        </div>
      </div>

      {/* Cancellation info banner */}
      {intervention.status === 'cancelled' && (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="font-semibold text-red-700 dark:text-red-300">Intervention annulée</p>
                {intervention.cancellation_reason && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    <span className="font-medium">Motif :</span> {intervention.cancellation_reason}
                  </p>
                )}
                {intervention.cancellation_details && (
                  <p className="text-sm text-red-600 dark:text-red-400">{intervention.cancellation_details}</p>
                )}
                {intervention.cancellation_photos && (intervention.cancellation_photos as string[]).length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {(intervention.cancellation_photos as string[]).map((url, i) => (
                      <img key={i} src={url} alt="" className="rounded-lg aspect-square object-cover border" />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Informations client */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Client
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {client ? (
              <>
                <div>
                  <p className="text-sm text-muted-foreground">Nom</p>
                  <p className="font-medium">{client.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <p className="font-medium">
                    {client.client_type === 'individual' ? 'Particulier' : 'Professionnel'}
                  </p>
                </div>
                {client.email && (
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{client.email}</p>
                  </div>
                )}
                {client.phone && (
                  <div>
                    <p className="text-sm text-muted-foreground">Téléphone</p>
                    <p className="font-medium">{client.phone}</p>
                  </div>
                )}
                {client.address && (
                  <div>
                    <p className="text-sm text-muted-foreground">Adresse</p>
                    <p className="font-medium">
                      {client.address}
                      {client.postal_code && `, ${client.postal_code}`}
                      {client.city && ` ${client.city}`}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">Client non trouvé</p>
            )}
          </CardContent>
        </Card>

        {/* Planification */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Planification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Date prévue</p>
              <p className="font-medium">
                {intervention.scheduled_date 
                  ? format(new Date(intervention.scheduled_date), 'EEEE dd MMMM yyyy', { locale: fr })
                  : "Non planifiée"}
              </p>
            </div>
            {intervention.scheduled_time && (
              <div>
                <p className="text-sm text-muted-foreground">Heure prévue</p>
                <p className="font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {intervention.scheduled_time}
                </p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Technicien assigné</p>
              <p className="font-medium">
                {intervention.technician_id ? "Assigné" : "Non assigné"}
              </p>
            </div>
            {intervention.scheduled_date && (
              hasFeature('email') ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                  onClick={handleSendClientEmail}
                  disabled={sendingEmail}
                >
                  {sendingEmail ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Envoi...</>
                  ) : (
                    <><Mail className="h-4 w-4 mr-2" />Notifier le client par email</>
                  )}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2 opacity-50 cursor-not-allowed"
                  disabled
                >
                  <Lock className="h-4 w-4 mr-2" />
                  Notifier le client par email
                  <span className="ml-auto text-[10px] border border-muted-foreground/20 text-muted-foreground/60 rounded px-1.5">Business</span>
                </Button>
              )
            )}
          </CardContent>
        </Card>

        {/* Temps d'intervention */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Temps d'intervention
              </span>
              <TimesCorrectionDialog intervention={intervention} onSuccess={() => refetch()} />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Temps de trajet */}
            {(intervention.travel_departure_time || intervention.arrival_time) && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">🚗 Trajet</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-blue-600 dark:text-blue-400">Départ domicile</p>
                    <p className="font-bold text-blue-900 dark:text-blue-100 text-lg">
                      {intervention.travel_departure_time ? intervention.travel_departure_time.substring(0, 5) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-blue-600 dark:text-blue-400">Arrivée client</p>
                    <p className="font-bold text-blue-900 dark:text-blue-100 text-lg">
                      {intervention.arrival_time ? intervention.arrival_time.substring(0, 5) : "—"}
                    </p>
                  </div>
                </div>
                {intervention.travel_departure_time && intervention.arrival_time && (
                  <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800 flex items-center justify-between">
                    <p className="text-xs text-blue-600 dark:text-blue-400">Durée du trajet</p>
                    <p className="font-bold text-blue-900 dark:text-blue-100 text-lg">
                      {(() => {
                        const [dh, dm] = intervention.travel_departure_time!.split(':').map(Number);
                        const [ah, am] = intervention.arrival_time!.split(':').map(Number);
                        const diffMin = (ah * 60 + am) - (dh * 60 + dm);
                        if (diffMin < 0) return "—";
                        const h = Math.floor(diffMin / 60);
                        const m = diffMin % 60;
                        return h > 0 ? `${h}h ${m}min` : `${m}min`;
                      })()}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Temps sur site */}
            {intervention.arrival_time && (
              <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">🔧 Intervention</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-green-600 dark:text-green-400">Début</p>
                    <p className="font-bold text-green-900 dark:text-green-100 text-lg">
                      {intervention.arrival_time.substring(0, 5)}
                    </p>
                  </div>
                  <div>
                    <p className="text-green-600 dark:text-green-400">Fin</p>
                    <p className="font-bold text-green-900 dark:text-green-100 text-lg">
                      {intervention.departure_time ? intervention.departure_time.substring(0, 5) : "En cours..."}
                    </p>
                  </div>
                </div>
                {intervention.departure_time && (
                  <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-800 flex items-center justify-between">
                    <p className="text-xs text-green-600 dark:text-green-400">Durée sur site</p>
                    <p className="font-bold text-green-900 dark:text-green-100 text-lg">
                      {(() => {
                        const [ah, am] = intervention.arrival_time!.split(':').map(Number);
                        const [dh, dm] = intervention.departure_time.split(':').map(Number);
                        const diffMin = (dh * 60 + dm) - (ah * 60 + am);
                        if (diffMin < 0) return "—";
                        const h = Math.floor(diffMin / 60);
                        const m = diffMin % 60;
                        return h > 0 ? `${h}h ${m}min` : `${m}min`;
                      })()}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Retour de trajet */}
            {(intervention.travel_return_time || (intervention as any).travel_return_arrival_time) && (
              <div className="p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
                <p className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-2">🏠 Retour de trajet</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-orange-600 dark:text-orange-400">Départ client</p>
                    <p className="font-bold text-orange-900 dark:text-orange-100 text-lg">
                      {intervention.travel_return_time ? intervention.travel_return_time.substring(0, 5) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-orange-600 dark:text-orange-400">Arrivée domicile</p>
                    <p className="font-bold text-orange-900 dark:text-orange-100 text-lg">
                      {(intervention as any).travel_return_arrival_time
                        ? (intervention as any).travel_return_arrival_time.substring(0, 5)
                        : <span className="text-amber-600 dark:text-amber-400">Non clôturé</span>}
                    </p>
                  </div>
                </div>
                {intervention.travel_return_time && (intervention as any).travel_return_arrival_time && (() => {
                  const [rh, rm] = intervention.travel_return_time!.split(':').map(Number);
                  const [ah, am] = (intervention as any).travel_return_arrival_time.split(':').map(Number);
                  let diffMin = (ah * 60 + am) - (rh * 60 + rm);
                  if (diffMin < 0) diffMin += 24 * 60; // franchissement de minuit
                  const h = Math.floor(diffMin / 60);
                  const m = diffMin % 60;
                  const label = h > 0 ? `${h}h ${m}min` : `${m}min`;
                  const suspicious = diffMin > 12 * 60; // >12h = probable oubli de clôture
                  return (
                    <div className="mt-3 pt-3 border-t border-orange-200 dark:border-orange-800 flex items-center justify-between">
                      <p className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1">
                        Durée du retour
                        {suspicious && (
                          <span title="Durée anormalement longue, probablement un oubli de clôture. Corrigez les temps." className="inline-flex">
                            <AlertTriangle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                          </span>
                        )}
                      </p>
                      <p className={`font-bold text-lg ${suspicious ? 'text-red-700 dark:text-red-300' : 'text-orange-900 dark:text-orange-100'}`}>
                        {label}
                      </p>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Résumé total */}
            {intervention.travel_departure_time && (intervention.departure_time || intervention.travel_return_time) && (() => {
              const endTime = (intervention as any).travel_return_arrival_time
                || intervention.travel_return_time
                || intervention.departure_time;
              const endLabel = (intervention as any).travel_return_arrival_time
                ? "retour domicile"
                : intervention.travel_return_time
                  ? "départ retour"
                  : "fin intervention";
              return (
                <div className="p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
                  <p className="text-sm font-medium text-purple-800 dark:text-purple-200 mb-2">📊 Récapitulatif total</p>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-purple-600 dark:text-purple-400 text-sm">
                        {intervention.travel_departure_time.substring(0, 5)} → {endTime.substring(0, 5)}
                      </p>
                      <p className="text-[10px] text-purple-500 dark:text-purple-400/80 mt-0.5">
                        Départ domicile → {endLabel}
                      </p>
                    </div>
                    <p className="font-bold text-purple-900 dark:text-purple-100 text-xl shrink-0">
                      {(() => {
                        const [dh, dm] = intervention.travel_departure_time!.split(':').map(Number);
                        const [eh, em] = endTime.split(':').map(Number);
                        let diffMin = (eh * 60 + em) - (dh * 60 + dm);
                        if (diffMin < 0) diffMin += 24 * 60; // franchissement de minuit
                        const h = Math.floor(diffMin / 60);
                        const m = diffMin % 60;
                        return h > 0 ? `${h}h ${m}min` : `${m}min`;
                      })()}
                    </p>
                  </div>
                </div>
              );
            })()}

            {!intervention.travel_departure_time && !intervention.arrival_time && (
              <div className="text-center py-6 text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Pas encore de données de temps</p>
                <p className="text-xs mt-1">Le technicien doit démarrer le suivi depuis l'application</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pauses */}
        {pauses.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Pause className="h-5 w-5" />
                Pauses ({pauses.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {intervention.is_paused && (
                <div className="flex items-center gap-2 p-2 rounded-md bg-orange-50 dark:bg-orange-950 text-orange-800 dark:text-orange-200 text-sm font-medium mb-2">
                  <Pause className="h-4 w-4" />
                  Intervention actuellement en pause
                </div>
              )}
              {pauses.map((pause) => {
                const pausedAt = new Date(pause.paused_at);
                const resumedAt = pause.resumed_at ? new Date(pause.resumed_at) : null;
                const durationMs = resumedAt
                  ? resumedAt.getTime() - pausedAt.getTime()
                  : Date.now() - pausedAt.getTime();
                const durationMin = Math.round(durationMs / 60000);
                const h = Math.floor(durationMin / 60);
                const m = durationMin % 60;
                const durationStr = h > 0 ? `${h}h ${m}min` : `${m}min`;

                return (
                  <div key={pause.id} className="p-3 rounded-lg border bg-muted/30 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium flex items-center gap-1.5">
                        {resumedAt ? (
                          <Play className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <Pause className="h-3.5 w-3.5 text-orange-500" />
                        )}
                        {format(pausedAt, "dd/MM/yyyy HH:mm", { locale: fr })}
                        {resumedAt && (
                          <span className="text-muted-foreground">
                            → {format(resumedAt, "dd/MM/yyyy HH:mm", { locale: fr })}
                          </span>
                        )}
                      </span>
                      <span className="text-xs font-semibold bg-muted px-2 py-0.5 rounded">
                        {resumedAt ? durationStr : `${durationStr} (en cours)`}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground italic">
                      {pause.pause_reason}
                    </p>
                  </div>
                );
              })}
              {/* Total pause time */}
              {pauses.length > 1 && (
                <div className="pt-2 border-t flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Temps total de pause</span>
                  <span className="font-bold">
                    {(() => {
                      const totalMin = pauses.reduce((acc, p) => {
                        const start = new Date(p.paused_at).getTime();
                        const end = p.resumed_at ? new Date(p.resumed_at).getTime() : Date.now();
                        return acc + Math.round((end - start) / 60000);
                      }, 0);
                      const h = Math.floor(totalMin / 60);
                      const m = totalMin % 60;
                      return h > 0 ? `${h}h ${m}min` : `${m}min`;
                    })()}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Description */}
        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              {intervention.description || "Aucune description"}
            </p>
          </CardContent>
        </Card>

        {/* Lien public */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5" />
              Lien client (extranet)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {intervention.public_token ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Partagez ce lien avec le client pour qu'il puisse suivre l'intervention
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopyLink}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copier le lien
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => window.open(`/intervention/${intervention.public_token}`, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Ouvrir
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">Lien non disponible</p>
            )}
          </CardContent>
        </Card>

        {/* Photos */}
        {photos.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Photos ({photos.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {getPhotosOfType('serial_number').length > 0 && (
                <div>
                  <h4 className="font-medium mb-3">Photo du numéro de série</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {getPhotosOfType('serial_number').map((photo) => (
                      <a key={photo.id} href={photo.photo_url} target="_blank" rel="noopener noreferrer">
                        <img src={photo.photo_url} alt="Numéro de série" className="w-full aspect-square object-cover rounded-lg hover:opacity-90 transition-opacity" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {getPhotosOfType('during').length > 0 && (
                <div>
                  <h4 className="font-medium mb-3">Photos pendant intervention</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {getPhotosOfType('during').map((photo) => (
                      <a key={photo.id} href={photo.photo_url} target="_blank" rel="noopener noreferrer">
                        <img src={photo.photo_url} alt="Pendant intervention" className="w-full aspect-square object-cover rounded-lg hover:opacity-90 transition-opacity" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {getPhotosOfType('after').length > 0 && (
                <div>
                  <h4 className="font-medium mb-3">Photos après intervention</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {getPhotosOfType('after').map((photo) => (
                      <a key={photo.id} href={photo.photo_url} target="_blank" rel="noopener noreferrer">
                        <img src={photo.photo_url} alt="Après intervention" className="w-full aspect-square object-cover rounded-lg hover:opacity-90 transition-opacity" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Étapes du workflow - éditable */}
        {workflowSteps.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Étapes du workflow ({stepCompletions.filter(c => c.completed_at).length}/{(() => {
                  const maxLoop = stepCompletions.length > 0 ? Math.max(...stepCompletions.map(c => c.loop_index ?? 0)) : 0;
                  const loopableCount = workflowSteps.filter(s => !s.requires_signature).length;
                  const sigCount = workflowSteps.filter(s => s.requires_signature).length;
                  return loopableCount * (maxLoop + 1) + sigCount;
                })()})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AdminStepEditor
                steps={workflowSteps}
                completions={stepCompletions}
                interventionId={id || ""}
              />
            </CardContent>
          </Card>
        )}

        {/* Bouton Clôturer */}
        {intervention.status !== 'completed' && intervention.status !== 'archived' && intervention.status !== 'to_invoice' && intervention.status !== 'cancelled' && (
          <Card className="lg:col-span-2">
            <CardContent className="pt-6 flex justify-center">
              <Button
                size="lg"
                onClick={handleCloseIntervention}
                disabled={updateIntervention.isPending}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle className="h-5 w-5 mr-2" />
                {updateIntervention.isPending ? "Clôture en cours..." : "Clôturer l'intervention"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default InterventionDetail;
