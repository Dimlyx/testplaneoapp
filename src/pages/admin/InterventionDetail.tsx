import { useNavigate, useParams, Link } from "react-router-dom";
import { useIntervention, useCreateIntervention, useUpdateIntervention } from "@/hooks/useInterventions";
import { useClient } from "@/hooks/useClients";
import { useInterventionPhotos, PhotoType } from "@/hooks/useInterventionPhotos";
import { useInterventionPauses } from "@/hooks/useInterventionPauses";
import { useInterventionEquipment } from "@/hooks/useInterventionEquipment";
import { useCompanySettings, useDocumentSettings } from "@/hooks/useAppSettings";
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
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { generateInterventionPDF } from "@/lib/pdf-generator";

const parsePhotoUrls = (photoUrl: string | null): string[] => {
  if (!photoUrl) return [];
  try {
    const parsed = JSON.parse(photoUrl);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return photoUrl ? [photoUrl] : [];
};

const InterventionDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { data: intervention, isLoading, refetch } = useIntervention(id || "");
  const { data: client } = useClient(intervention?.client_id || "");
  const { data: photos = [] } = useInterventionPhotos(id || "");
  const { data: interventionEquipments = [] } = useInterventionEquipment(id || "");
  const { data: companySettings } = useCompanySettings();
  const { data: documentSettings } = useDocumentSettings();
  
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
  const getPhotosOfType = (type: PhotoType) => photos.filter(p => p.photo_type === type);

  const handleCopyLink = () => {
    if (intervention?.public_token) {
      const publicUrl = `${window.location.origin}/intervention/${intervention.public_token}`;
      navigator.clipboard.writeText(publicUrl);
      toast({ title: "Lien copié dans le presse-papiers" });
    }
  };

  const handleDownloadPDF = async () => {
    if (intervention && client) {
      console.log('PDF Generation Debug:', { 
        interventionType: intervention.intervention_type,
        matchingTypeId: matchingType?.id,
        matchingTypeName: matchingType?.name,
        workflowStepsCount: workflowSteps.length,
        stepCompletionsCount: stepCompletions.length,
        interventionTypesCount: interventionTypes.length
      });
      toast({ title: "Génération du PDF en cours..." });
      await generateInterventionPDF(
        intervention, 
        client, 
        intervention.equipment as any,
        intervention.profiles?.full_name || undefined,
        photos,
        interventionEquipments,
        { company: companySettings!, report: { primaryColor: documentSettings?.primaryColor || '#003057', accentColor: documentSettings?.accentColor || '#0050A0', footerText: documentSettings?.footerText || '' }, documents: documentSettings! },
        stepCompletions,
        workflowSteps,
        interventionTypes
      );
      toast({ title: "PDF généré avec succès" });
    }
  };
  const handleDuplicate = async () => {
    if (!intervention) return;
    try {
      const result = await createIntervention.mutateAsync({
        client_id: intervention.client_id,
        equipment_id: intervention.equipment_id,
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
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">{intervention.title}</h1>
            <div className="flex items-center gap-2 mt-2">
              <TypeBadge type={intervention.intervention_type} />
              <StatusBadge status={intervention.status} />
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDuplicate} disabled={createIntervention.isPending}>
            <CopyPlus className="h-4 w-4 mr-2" />
            {createIntervention.isPending ? "Duplication..." : "Dupliquer"}
          </Button>
          <Button variant="outline" onClick={handleDownloadPDF}>
            <FileText className="h-4 w-4 mr-2" />
            PDF
          </Button>
          <Button onClick={() => navigate(`/admin/interventions/${id}/edit`)}>
            <Edit className="h-4 w-4 mr-2" />
            Modifier
          </Button>
        </div>
      </div>

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

            {/* Résumé total */}
            {intervention.travel_departure_time && intervention.departure_time && (
              <div className="p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
                <p className="text-sm font-medium text-purple-800 dark:text-purple-200 mb-2">📊 Récapitulatif total</p>
                <div className="flex items-center justify-between">
                  <p className="text-purple-600 dark:text-purple-400 text-sm">
                    {intervention.travel_departure_time.substring(0, 5)} → {intervention.departure_time.substring(0, 5)}
                  </p>
                  <p className="font-bold text-purple-900 dark:text-purple-100 text-xl">
                    {(() => {
                      const [dh, dm] = intervention.travel_departure_time!.split(':').map(Number);
                      const [eh, em] = intervention.departure_time.split(':').map(Number);
                      const diffMin = (eh * 60 + em) - (dh * 60 + dm);
                      if (diffMin < 0) return "—";
                      const h = Math.floor(diffMin / 60);
                      const m = diffMin % 60;
                      return h > 0 ? `${h}h ${m}min` : `${m}min`;
                    })()}
                  </p>
                </div>
              </div>
            )}

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

        {/* Équipements */}
        {interventionEquipments.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Équipements ({interventionEquipments.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {interventionEquipments.map((ie, index) => {
                const equipmentPhotos = photos.filter(p => p.equipment_id === ie.equipment_id);
                const serialPhotos = equipmentPhotos.filter(p => p.photo_type === 'serial_number');
                const duringPhotos = equipmentPhotos.filter(p => p.photo_type === 'during');
                const afterPhotos = equipmentPhotos.filter(p => p.photo_type === 'after');
                
                const getStatusDisplay = (status: string | null) => {
                  switch (status) {
                    case 'not_working':
                      return { label: 'Ne fonctionne pas', className: 'bg-red-100 text-red-800' };
                    case 'needs_intervention':
                      return { label: 'Pièces ou intervention nécessaire', className: 'bg-orange-100 text-orange-800' };
                    case 'working':
                    default:
                      return { label: 'Fonctionne', className: 'bg-green-100 text-green-800' };
                  }
                };
                const statusDisplay = getStatusDisplay(ie.equipment_status);
                
                return (
                  <div key={ie.id} className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-lg">
                        {index + 1}. {ie.equipment?.equipment_type || "Équipement"}
                      </h4>
                      <span className={`px-2 py-1 rounded text-sm ${statusDisplay.className}`}>
                        {statusDisplay.label}
                      </span>
                    </div>

                    {ie.equipment?.serial_number && (
                      <p className="text-sm text-muted-foreground">
                        N° série : {ie.equipment.serial_number}
                      </p>
                    )}

                    {ie.technical_comments && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">Commentaires techniques</p>
                        <p className="whitespace-pre-wrap">{ie.technical_comments}</p>
                      </div>
                    )}

                    {/* Photos de l'équipement */}
                    {equipmentPhotos.length > 0 && (
                      <div className="space-y-3">
                        {serialPhotos.length > 0 && (
                          <div>
                            <p className="text-sm font-medium mb-2">Photos numéro de série</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              {serialPhotos.map(photo => (
                                <a key={photo.id} href={photo.photo_url} target="_blank" rel="noopener noreferrer">
                                  <img src={photo.photo_url} alt="Série" className="w-full aspect-square object-cover rounded-lg hover:opacity-90 transition-opacity" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                        {duringPhotos.length > 0 && (
                          <div>
                            <p className="text-sm font-medium mb-2">Photos pendant intervention</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              {duringPhotos.map(photo => (
                                <a key={photo.id} href={photo.photo_url} target="_blank" rel="noopener noreferrer">
                                  <img src={photo.photo_url} alt="Pendant" className="w-full aspect-square object-cover rounded-lg hover:opacity-90 transition-opacity" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                        {afterPhotos.length > 0 && (
                          <div>
                            <p className="text-sm font-medium mb-2">Photos après intervention</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              {afterPhotos.map(photo => (
                                <a key={photo.id} href={photo.photo_url} target="_blank" rel="noopener noreferrer">
                                  <img src={photo.photo_url} alt="Après" className="w-full aspect-square object-cover rounded-lg hover:opacity-90 transition-opacity" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Photos sans équipement spécifique */}
        {photos.filter(p => !p.equipment_id).length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Photos générales
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {getPhotosOfType('serial_number').filter(p => !p.equipment_id).length > 0 && (
                <div>
                  <h4 className="font-medium mb-3">Photo du numéro de série</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {getPhotosOfType('serial_number').filter(p => !p.equipment_id).map((photo) => (
                      <a key={photo.id} href={photo.photo_url} target="_blank" rel="noopener noreferrer">
                        <img src={photo.photo_url} alt="Numéro de série" className="w-full aspect-square object-cover rounded-lg hover:opacity-90 transition-opacity" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {getPhotosOfType('during').filter(p => !p.equipment_id).length > 0 && (
                <div>
                  <h4 className="font-medium mb-3">Photos pendant intervention</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {getPhotosOfType('during').filter(p => !p.equipment_id).map((photo) => (
                      <a key={photo.id} href={photo.photo_url} target="_blank" rel="noopener noreferrer">
                        <img src={photo.photo_url} alt="Pendant intervention" className="w-full aspect-square object-cover rounded-lg hover:opacity-90 transition-opacity" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {getPhotosOfType('after').filter(p => !p.equipment_id).length > 0 && (
                <div>
                  <h4 className="font-medium mb-3">Photos après intervention</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {getPhotosOfType('after').filter(p => !p.equipment_id).map((photo) => (
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
        {intervention.status !== 'completed' && intervention.status !== 'archived' && intervention.status !== 'to_invoice' && (
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
