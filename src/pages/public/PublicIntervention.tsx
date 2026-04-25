import { useParams } from "react-router-dom";
import { useState } from "react";
import { usePublicIntervention } from "@/hooks/useInterventions";
import { useInterventionPhotos } from "@/hooks/useInterventionPhotos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { TypeBadge } from "@/components/ui/status-badge";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { 
  User, 
  Calendar, 
  Clock, 
  FileText, 
  CheckCircle,
  AlertTriangle,
  Wrench,
  Image as ImageIcon,
  MapPin,
  Phone,
  Mail,
  Building,
  ClipboardList
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { 
  defaultDocumentSettings,
  defaultCompanySettings,
  DocumentSettings,
  CompanySettings
} from "@/hooks/useAppSettings";

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

// Determine if a hex color is light (needs dark text) or dark (needs white text)
const isLightColor = (hex: string): boolean => {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  // Relative luminance formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6;
};

const PublicIntervention = () => {
  const { token } = useParams();
  const { data: intervention, isLoading, error } = usePublicIntervention(token || "");
  const { data: photos = [] } = useInterventionPhotos(intervention?.id || "");
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  
  const { data: stepCompletions = [] } = useQuery({
    queryKey: ["public-step-completions", intervention?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intervention_step_completions")
        .select("*")
        .eq("intervention_id", intervention!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!intervention?.id,
  });
  
  const { data: workflowSteps = [] } = useQuery({
    queryKey: ["public-workflow-steps", intervention?.intervention_type],
    queryFn: async () => {
      const { data: types } = await supabase
        .from("intervention_types")
        .select("id")
        .eq("name", intervention!.intervention_type);
      if (!types || types.length === 0) return [];
      
      const { data, error } = await supabase
        .from("intervention_workflow_steps")
        .select("*")
        .eq("intervention_type_id", types[0].id)
        .order("step_order");
      if (error) throw error;
      return data;
    },
    enabled: !!intervention?.intervention_type,
  });
  
  // Fetch document settings using intervention's organization_id (works without auth)
  const { data: documentSettingsData, isLoading: loadingDocSettings } = useQuery({
    queryKey: ['public-document-settings', intervention?.organization_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'documents')
        .eq('organization_id', intervention!.organization_id!)
        .maybeSingle();
      if (error) throw error;
      if (data?.value) {
        return { ...defaultDocumentSettings, ...(data.value as object) } as DocumentSettings;
      }
      return defaultDocumentSettings;
    },
    enabled: !!intervention?.organization_id,
  });

  const { data: companySettingsData, isLoading: loadingCompanySettings } = useQuery({
    queryKey: ['public-company-settings', intervention?.organization_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'company')
        .eq('organization_id', intervention!.organization_id!)
        .maybeSingle();
      if (error) throw error;
      if (data?.value) {
        return { ...defaultCompanySettings, ...(data.value as object) } as CompanySettings;
      }
      return defaultCompanySettings;
    },
    enabled: !!intervention?.organization_id,
  });
  
  const docSettings: DocumentSettings = documentSettingsData || defaultDocumentSettings;
  const companySettings: CompanySettings = companySettingsData || defaultCompanySettings;

  if (isLoading || loadingDocSettings || loadingCompanySettings) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !intervention) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Intervention non trouvée</h2>
            <p className="text-muted-foreground">
              Le lien que vous avez utilisé n'est pas valide ou l'intervention n'existe plus.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }


  const client = (intervention as any).clients;
  const fullAddress = client ? [client.address, client.postal_code, client.city].filter(Boolean).join(', ') : null;

    const effectivePrimaryColor = docSettings.primaryColor || defaultDocumentSettings.primaryColor;
    const effectiveAccentColor = docSettings.accentColor || defaultDocumentSettings.accentColor;
    const headerTextColor = isLightColor(effectivePrimaryColor) ? '#1a1a1a' : '#ffffff';
    const footerTextColor = isLightColor(effectiveAccentColor) ? '#1a1a1a' : '#ffffff';

    return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="py-6" style={{ backgroundColor: effectivePrimaryColor, color: headerTextColor }}>
        <div className="container max-w-2xl mx-auto px-4">
          <div className="flex items-center gap-3 mb-2">
            {companySettings.logoUrl ? (
              <img src={companySettings.logoUrl} alt="Logo" className="h-10 w-auto object-contain bg-white rounded p-1" />
            ) : (
              <Wrench className="h-6 w-6" />
            )}
            <span className="font-semibold">{companySettings.name || "Service Intervention"}</span>
          </div>
          <h1 className="text-xl font-bold">Rapport d'intervention</h1>
        </div>
      </header>

      <main className="container max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Type d'intervention */}
        <Card>
          <CardContent className="py-6 text-center">
            <div className="flex justify-center gap-2">
              <TypeBadge type={intervention.intervention_type} />
            </div>
            {docSettings.welcomeMessage && (
              <p className="text-sm text-muted-foreground mt-4 max-w-md mx-auto">{docSettings.welcomeMessage}</p>
            )}
          </CardContent>
        </Card>

        {/* Cancellation banner */}
        {intervention.status === 'cancelled' && (
          <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="font-semibold text-red-700 dark:text-red-300">Intervention annulée</p>
                  {intervention.cancellation_reason && (
                    <p className="text-sm text-red-600 dark:text-red-400">
                      Motif : {intervention.cancellation_reason}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {docSettings.showClientInfo && client && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building className="h-5 w-5" />
                Informations client
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{client.name}</span>
                <span className="text-xs px-2 py-0.5 bg-muted rounded">
                  {client.client_type === 'individual' ? 'Particulier' : 'Professionnel'}
                </span>
              </div>
              {client.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{client.phone}</span>
                </div>
              )}
              {client.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{client.email}</span>
                </div>
              )}
              {fullAddress && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{fullAddress}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Détails intervention */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{intervention.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {docSettings.showDescription && intervention.description && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Description</p>
                <p>{intervention.description}</p>
              </div>
            )}

            {docSettings.showScheduledDateTime && intervention.scheduled_date && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{format(new Date(intervention.scheduled_date), 'dd MMMM yyyy', { locale: fr })}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lieu d'intervention */}
        {docSettings.showInterventionAddress && (intervention.intervention_address || intervention.intervention_phone || intervention.intervention_email) && (
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Lieu d'intervention
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(intervention.intervention_address || intervention.intervention_city || intervention.intervention_postal_code) && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <span>{[intervention.intervention_address, intervention.intervention_postal_code, intervention.intervention_city].filter(Boolean).join(', ')}</span>
                    {(intervention.intervention_building || intervention.intervention_floor) && (
                      <div className="text-sm text-muted-foreground">
                        {[intervention.intervention_building, intervention.intervention_floor].filter(Boolean).join(' - ')}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {intervention.intervention_phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{intervention.intervention_phone}</span>
                </div>
              )}
              {intervention.intervention_email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{intervention.intervention_email}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Photos supplémentaires */}
        {photos.filter(p => !p.equipment_id).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Photos supplémentaires
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {photos.filter(p => !p.equipment_id).map(photo => (
                  <button key={photo.id} type="button" onClick={() => setLightboxUrl(photo.photo_url)} className="block w-full">
                    <img src={photo.photo_url} alt="Photo" className="w-full aspect-video object-cover rounded-lg border" style={{ imageOrientation: "from-image" }} />
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Étapes du workflow */}
        {docSettings.showWorkflowSteps && workflowSteps.length > 0 && stepCompletions.filter(c => c.completed_at).length > 0 && (() => {
          const maxLoopIndex = stepCompletions.length > 0
            ? Math.max(...stepCompletions.map(c => (c as any).loop_index ?? 0))
            : 0;
          const totalLoops = maxLoopIndex + 1;
          const signatureSteps = workflowSteps.filter(s => s.requires_signature);
          const loopableSteps = workflowSteps.filter(s => !s.requires_signature);

          return (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  Étapes réalisées
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Array.from({ length: totalLoops }, (_, loopIdx) => (
                  <div key={`loop-${loopIdx}`}>
                    {totalLoops > 1 && (
                      <div className="flex items-center gap-2 my-3">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-xs font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full">
                          Équipement {loopIdx + 1}
                        </span>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                    )}
                    {loopableSteps.map((step, index) => {
                      const completion = stepCompletions.find(
                        c => c.step_id === step.id && ((c as any).loop_index ?? 0) === loopIdx
                      );
                      if (!completion?.completed_at) return null;
                      const stepPhotos = parsePhotoUrls(completion.photo_url);

                      return (
                        <div key={`${step.id}-${loopIdx}`} className="border rounded-lg p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span className="font-medium text-sm">{step.label}</span>
                          </div>
                          {(() => {
                            const mcItems = (completion as any).multiple_choice_data as { id: string; label: string; selected: boolean }[] | null;
                            if (!mcItems || mcItems.length === 0) return null;
                            const selected = mcItems.filter(i => i.selected);
                            if (selected.length === 0) return null;
                            return (
                              <div className="ml-6 flex flex-wrap gap-1">
                                {selected.map((item) => (
                                  <span key={item.id} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                                    {item.label}
                                  </span>
                                ))}
                              </div>
                            );
                          })()}
                          {completion.comment && (
                            <p className="text-sm text-muted-foreground ml-6 whitespace-pre-wrap">{completion.comment}</p>
                          )}
                          {(() => {
                            const checklistItems = (completion as any).checklist_data as { id: string; label: string; checked: boolean }[] | null;
                            if (!checklistItems || checklistItems.length === 0) return null;
                            return (
                              <div className="ml-6 space-y-1">
                                {checklistItems.map((item) => (
                                  <div key={item.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                                    {item.checked ? <CheckCircle className="h-3 w-3 text-green-600" /> : <AlertTriangle className="h-3 w-3 text-muted-foreground" />}
                                    <span>{item.label}</span>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                          {stepPhotos.length > 0 && (
                            <div className="grid grid-cols-2 gap-2 ml-6">
                              {stepPhotos.map((url, photoIdx) => (
                                <button key={photoIdx} type="button" onClick={() => setLightboxUrl(url)} className="block w-full">
                                  <img src={url} alt={`Étape ${index + 1}`} className="w-full aspect-video object-cover rounded-lg border" style={{ imageOrientation: "from-image" }} />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}

                {/* Signature steps (not in loop) */}
                {signatureSteps.map((step, index) => {
                  const completion = stepCompletions.find(c => c.step_id === step.id);
                  if (!completion?.completed_at) return null;
                  const stepPhotos = parsePhotoUrls(completion.photo_url);

                  return (
                    <div key={step.id} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="font-medium text-sm">{step.label}</span>
                      </div>
                      {(() => {
                        const mcItems = (completion as any).multiple_choice_data as { id: string; label: string; selected: boolean }[] | null;
                        if (!mcItems || mcItems.length === 0) return null;
                        const selected = mcItems.filter(i => i.selected);
                        if (selected.length === 0) return null;
                        return (
                          <div className="ml-6 flex flex-wrap gap-1">
                            {selected.map((item) => (
                              <span key={item.id} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                                {item.label}
                              </span>
                            ))}
                          </div>
                        );
                      })()}
                      {completion.comment && (
                        <p className="text-sm text-muted-foreground ml-6 whitespace-pre-wrap">{completion.comment}</p>
                      )}
                      {(() => {
                        const checklistItems = (completion as any).checklist_data as { id: string; label: string; checked: boolean }[] | null;
                        if (!checklistItems || checklistItems.length === 0) return null;
                        return (
                          <div className="ml-6 space-y-1">
                            {checklistItems.map((item) => (
                              <div key={item.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                                {item.checked ? <CheckCircle className="h-3 w-3 text-green-600" /> : <AlertTriangle className="h-3 w-3 text-muted-foreground" />}
                                <span>{item.label}</span>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                      {stepPhotos.length > 0 && (
                        <div className="grid grid-cols-2 gap-2 ml-6">
                          {stepPhotos.map((url, photoIdx) => (
                            <a key={photoIdx} href={url} target="_blank" rel="noopener noreferrer">
                              <img src={url} alt={`Étape ${index + 1}`} className="w-full aspect-video object-cover rounded-lg border" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })()}

        {/* Info footer */}
        <Card className="bg-muted/50">
          <CardContent className="py-4 text-center text-sm text-muted-foreground">
            <p>Cette page est mise à jour en temps réel.</p>
            <p>Dernière mise à jour : {format(new Date(intervention.updated_at), 'dd/MM/yyyy à HH:mm', { locale: fr })}</p>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="py-4 mt-8" style={{ backgroundColor: effectiveAccentColor, color: footerTextColor }}>
        <div className="container max-w-2xl mx-auto px-4 text-center text-sm">
          <p>{docSettings.footerText || `© ${new Date().getFullYear()} ${companySettings.name || "Service Intervention"}`}</p>
          {companySettings.address && <p className="opacity-80 mt-1">{[companySettings.address, companySettings.postalCode, companySettings.city].filter(Boolean).join(', ')}</p>}
        </div>
      </footer>
    </div>
  );
};

export default PublicIntervention;
