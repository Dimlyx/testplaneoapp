import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { StatusBadge, TypeBadge } from "@/components/ui/status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock, MapPin, User, Phone, Mail, FileText, ExternalLink, CalendarDays, Building2, Download, Link2, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { useUpdateIntervention, type Intervention } from "@/hooks/useInterventions";
import type { Technician } from "@/hooks/useTechnicians";
import { useClients } from "@/hooks/useClients";
import { useCustomStatuses } from "@/hooks/useCustomStatuses";
import { useInterventionPhotos } from "@/hooks/useInterventionPhotos";
import { useInterventionTypes } from "@/hooks/useInterventionTypes";
import { useWorkflowSteps } from "@/hooks/useWorkflowSteps";
import { useStepCompletions } from "@/hooks/useStepCompletions";
import { useCompanySettings, useDocumentSettings } from "@/hooks/useAppSettings";
import { generateInterventionPDF } from "@/lib/pdf-generator";
import { PdfGenerationOverlay } from "@/components/PdfGenerationOverlay";
import { toast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type InterventionStatus = Database["public"]["Enums"]["intervention_status"];

const DEFAULT_STATUSES: { value: InterventionStatus; label: string; color: string }[] = [
  { value: "to_plan", label: "À planifier", color: "#f59e0b" },
  { value: "planned", label: "Planifiée", color: "#3b82f6" },
  { value: "in_progress", label: "En cours", color: "#8b5cf6" },
  { value: "completed", label: "Terminée", color: "#10b981" },
  { value: "to_invoice", label: "À facturer", color: "#f97316" },
  { value: "archived", label: "Archivée", color: "#6b7280" },
  { value: "cancelled", label: "Annulée", color: "#ef4444" },
];

interface InterventionQuickViewSheetProps {
  intervention: Intervention | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  technicians: Technician[];
}

export function InterventionQuickViewSheet({
  intervention,
  open,
  onOpenChange,
  technicians,
}: InterventionQuickViewSheetProps) {
  const navigate = useNavigate();
  const { data: clients = [] } = useClients();
  const { data: customStatuses = [] } = useCustomStatuses();
  const updateIntervention = useUpdateIntervention();
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const { data: photos = [] } = useInterventionPhotos(intervention?.id || "");
  const { data: interventionTypes = [] } = useInterventionTypes();
  const matchingType = interventionTypes.find(
    (t) => t.name === intervention?.intervention_type,
  );
  const { data: workflowSteps = [] } = useWorkflowSteps(matchingType?.id);
  const { data: stepCompletions = [] } = useStepCompletions(intervention?.id || "");
  const { data: companySettings } = useCompanySettings();
  const { data: documentSettings } = useDocumentSettings();

  if (!intervention) return null;

  const client = clients.find((c) => c.id === intervention.client_id);
  const technician = technicians.find((t) => t.id === intervention.technician_id);

  const handleOpenExtranet = () => {
    if (!intervention.public_token) {
      toast({
        title: "Lien extranet indisponible",
        description: "Cette intervention n'a pas encore de lien public.",
        variant: "destructive",
      });
      return;
    }
    window.open(`/intervention/${intervention.public_token}`, "_blank");
  };

  const handleDownloadPdf = async () => {
    if (!client || !companySettings || !documentSettings) {
      toast({
        title: "Données en cours de chargement",
        description: "Merci de patienter quelques secondes.",
      });
      return;
    }
    try {
      setGeneratingPdf(true);
      toast({ title: "Génération du PDF en cours..." });
      await generateInterventionPDF(
        intervention,
        client,
        undefined,
        intervention.profiles?.full_name || undefined,
        photos,
        [],
        {
          company: companySettings,
          report: {
            primaryColor: documentSettings?.primaryColor || "#003057",
            accentColor: documentSettings?.accentColor || "#0050A0",
            footerText: documentSettings?.footerText || "",
          },
          documents: documentSettings,
        },
        stepCompletions,
        workflowSteps,
        interventionTypes,
      );
      toast({ title: "PDF généré avec succès" });
    } catch (err: any) {
      toast({
        title: "Erreur",
        description: err?.message || "Impossible de générer le PDF",
        variant: "destructive",
      });
    } finally {
      setGeneratingPdf(false);
    }
  };

  const currentValue = intervention.custom_status_id
    ? `custom:${intervention.custom_status_id}`
    : `default:${intervention.status}`;

  const handleStatusChange = (value: string) => {
    if (value.startsWith("custom:")) {
      const customId = value.replace("custom:", "");
      const custom = customStatuses.find((s) => s.id === customId);
      if (!custom) return;
      const matchingBase = DEFAULT_STATUSES.find(
        (d) => d.value === (custom.name as InterventionStatus),
      );
      updateIntervention.mutate({
        id: intervention.id,
        custom_status_id: customId,
        ...(matchingBase ? { status: matchingBase.value } : {}),
      });
    } else {
      const status = value.replace("default:", "") as InterventionStatus;
      updateIntervention.mutate({
        id: intervention.id,
        status,
        custom_status_id: null,
      });
    }
  };

  const formatTimeRange = () => {
    if (!intervention.scheduled_time) return null;
    const start = intervention.scheduled_time.slice(0, 5);
    const end = intervention.scheduled_end_time?.slice(0, 5);
    return end ? `${start} - ${end}` : start;
  };

  const address = [
    intervention.intervention_address,
    intervention.intervention_postal_code,
    intervention.intervention_city,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md overflow-y-auto p-0 flex flex-col"
      >
        <PdfGenerationOverlay open={generatingPdf} />
        <SheetHeader className="p-6 pb-4 border-b">
          <div className="flex items-start gap-2 flex-wrap pr-8">
            <TypeBadge type={intervention.intervention_type} />
            <StatusBadge
              status={intervention.status}
              customStatusId={intervention.custom_status_id}
            />
          </div>
          <SheetTitle className="text-xl text-left">{intervention.title}</SheetTitle>
          {intervention.description && (
            <SheetDescription className="text-left">
              {intervention.description}
            </SheetDescription>
          )}
        </SheetHeader>

        <div className="flex-1 p-6 space-y-5">
          {/* Changer le statut */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
              Changer le statut
            </h4>
            <Select
              value={currentValue}
              onValueChange={handleStatusChange}
              disabled={updateIntervention.isPending}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Sélectionner un statut" />
              </SelectTrigger>
              <SelectContent>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  Statuts par défaut
                </div>
                {DEFAULT_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={`default:${s.value}`}>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: s.color }}
                      />
                      <span>{s.label}</span>
                    </div>
                  </SelectItem>
                ))}
                {customStatuses.length > 0 && (
                  <>
                    <Separator className="my-1" />
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      Statuts personnalisés
                    </div>
                    {customStatuses.map((s) => (
                      <SelectItem key={s.id} value={`custom:${s.id}`}>
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: s.color }}
                          />
                          <span>{s.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Date & heure */}
          {intervention.scheduled_date && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
                Planification
              </h4>
              <div className="flex items-center gap-2 text-sm">
                <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>
                  {format(parseISO(intervention.scheduled_date), "EEEE d MMMM yyyy", {
                    locale: fr,
                  })}
                </span>
              </div>
              {formatTimeRange() && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{formatTimeRange()}</span>
                </div>
              )}
            </div>
          )}

          <Separator />

          {/* Client */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
              Client
            </h4>
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-medium">{client?.name || "Client inconnu"}</span>
            </div>
            {intervention.intervention_contact_name && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{intervention.intervention_contact_name}</span>
              </div>
            )}
            {intervention.intervention_phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <a
                  href={`tel:${intervention.intervention_phone}`}
                  className="text-primary"
                >
                  {intervention.intervention_phone}
                </a>
              </div>
            )}
            {intervention.intervention_email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <a
                  href={`mailto:${intervention.intervention_email}`}
                  className="text-primary truncate"
                >
                  {intervention.intervention_email}
                </a>
              </div>
            )}
          </div>

          {/* Adresse */}
          {address && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
                  Lieu d'intervention
                </h4>
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <span>{address}</span>
                </div>
              </div>
            </>
          )}

          {/* Technicien */}
          <Separator />
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
              Intervenant
            </h4>
            <Badge variant="outline" className="text-sm">
              {technician?.full_name || technician?.email || "Non assigné"}
            </Badge>
          </div>

          {/* Notes / Rapport */}
          {intervention.report && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
                  Rapport
                </h4>
                <div className="flex items-start gap-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="whitespace-pre-wrap">{intervention.report}</p>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="p-6 pt-4 border-t bg-background space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={handleDownloadPdf}
              disabled={generatingPdf}
            >
              {generatingPdf ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              PDF
            </Button>
            <Button
              variant="outline"
              onClick={handleOpenExtranet}
              disabled={!intervention.public_token}
            >
              <Link2 className="h-4 w-4 mr-2" />
              Extranet
            </Button>
          </div>
          <Button
            className="w-full"
            onClick={() => navigate(`/admin/interventions/${intervention.id}`)}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Ouvrir la fiche complète
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
