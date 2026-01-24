import { useParams } from "react-router-dom";
import { usePublicIntervention } from "@/hooks/useInterventions";
import { useInterventionPhotos } from "@/hooks/useInterventionPhotos";
import { useInterventionEquipment } from "@/hooks/useInterventionEquipment";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, TypeBadge } from "@/components/ui/status-badge";
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
  Building
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// Report settings from localStorage
const REPORT_SETTINGS_KEY = "reportSettings";

interface ReportSettings {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  primaryColor: string;
  accentColor: string;
  footerText: string;
  logoUrl: string;
}

const defaultSettings: ReportSettings = {
  companyName: "",
  companyAddress: "",
  companyPhone: "",
  companyEmail: "",
  primaryColor: "#003057",
  accentColor: "#0050A0",
  footerText: "",
  logoUrl: "",
};

const getReportSettings = (): ReportSettings => {
  try {
    const stored = localStorage.getItem(REPORT_SETTINGS_KEY);
    if (stored) {
      return { ...defaultSettings, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error("Error loading report settings:", e);
  }
  return defaultSettings;
};

const PublicIntervention = () => {
  const { token } = useParams();
  const { data: intervention, isLoading, error } = usePublicIntervention(token || "");
  const { data: photos = [] } = useInterventionPhotos(intervention?.id || "");
  const { data: interventionEquipments = [] } = useInterventionEquipment(intervention?.id || "");
  
  const settings = getReportSettings();

  if (isLoading) {
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

  const statusConfig = {
    to_plan: { icon: AlertTriangle, color: "text-status-to-plan", message: "En attente de planification" },
    planned: { icon: Calendar, color: "text-status-planned", message: "Intervention planifiée" },
    in_progress: { icon: Wrench, color: "text-status-in-progress", message: "Intervention en cours" },
    completed: { icon: CheckCircle, color: "text-status-completed", message: "Intervention terminée" },
  };

  const currentStatus = statusConfig[intervention.status];
  const StatusIcon = currentStatus.icon;

  const client = intervention.clients;
  const fullAddress = client ? [client.address, client.postal_code, client.city].filter(Boolean).join(', ') : null;

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header 
        className="text-white py-6"
        style={{ backgroundColor: settings.primaryColor }}
      >
        <div className="container max-w-2xl mx-auto px-4">
          <div className="flex items-center gap-3 mb-2">
            {settings.logoUrl ? (
              <img 
                src={settings.logoUrl} 
                alt="Logo" 
                className="h-10 w-auto object-contain bg-white rounded p-1"
              />
            ) : (
              <Wrench className="h-6 w-6" />
            )}
            <span className="font-semibold">{settings.companyName || "Service Intervention"}</span>
          </div>
          <h1 className="text-xl font-bold">Rapport d'intervention</h1>
          <p className="text-sm opacity-80 mt-1">
            Réf: INT-{intervention.id.slice(0, 8).toUpperCase()}
          </p>
        </div>
      </header>

      <main className="container max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Statut principal */}
        <Card className="border-2" style={{ borderColor: `hsl(var(--${intervention.status === 'completed' ? 'status-completed' : intervention.status === 'in_progress' ? 'status-in-progress' : intervention.status === 'planned' ? 'status-planned' : 'status-to-plan'}))` }}>
          <CardContent className="py-6 text-center">
            <StatusIcon className={`h-12 w-12 mx-auto mb-3 ${currentStatus.color}`} />
            <p className={`text-lg font-semibold ${currentStatus.color}`}>
              {currentStatus.message}
            </p>
            <div className="flex justify-center gap-2 mt-3">
              <StatusBadge status={intervention.status} />
              <TypeBadge type={intervention.intervention_type} />
            </div>
          </CardContent>
        </Card>

        {/* Informations client */}
        {client && (
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

        {/* Lieu d'intervention (si différent du client) */}
        {(intervention.intervention_address || intervention.intervention_phone || intervention.intervention_email) && (
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
                  <span>
                    {[intervention.intervention_address, intervention.intervention_postal_code, intervention.intervention_city].filter(Boolean).join(', ')}
                  </span>
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

        {/* Détails intervention */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{intervention.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {intervention.description && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Description</p>
                <p>{intervention.description}</p>
              </div>
            )}

            {(intervention.scheduled_date || intervention.scheduled_time) && (
              <div className="flex gap-6">
                {intervention.scheduled_date && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{format(new Date(intervention.scheduled_date), 'dd MMMM yyyy', { locale: fr })}</span>
                  </div>
                )}
                {intervention.scheduled_time && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{intervention.scheduled_time}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Horaires d'intervention - Hidden from public extranet */}

        {/* Travaux effectués - Compte rendu */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Travaux effectués - Compte rendu
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{intervention.report || "Aucun compte rendu"}</p>
          </CardContent>
        </Card>

        {/* Équipements */}
        {interventionEquipments.length > 0 && interventionEquipments.map((ie, index) => {
          const equipmentPhotos = photos.filter(p => p.equipment_id === ie.equipment_id);
          const serialPhotos = equipmentPhotos.filter(p => p.photo_type === 'serial_number');
          const duringPhotos = equipmentPhotos.filter(p => p.photo_type === 'during');
          const afterPhotos = equipmentPhotos.filter(p => p.photo_type === 'after');
          
          return (
            <Card key={ie.id} className="border-primary/30">
              <CardHeader className="bg-primary/5">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  Équipement {index + 1}: {ie.equipment?.equipment_type || "Équipement"}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {/* Détails équipement */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Type:</span>
                    <span className="ml-2 font-medium">{ie.equipment?.equipment_type || "N/C"}</span>
                  </div>
                  {ie.equipment?.serial_number && (
                    <div>
                      <span className="text-muted-foreground">N° Série:</span>
                      <span className="ml-2 font-medium">{ie.equipment.serial_number}</span>
                    </div>
                  )}
                </div>

                {/* Photos N° série */}
                {serialPhotos.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Photos N° de série</p>
                    <div className="grid grid-cols-2 gap-2">
                      {serialPhotos.map(photo => (
                        <a key={photo.id} href={photo.photo_url} target="_blank" rel="noopener noreferrer">
                          <img src={photo.photo_url} alt="N° série" className="w-full aspect-video object-cover rounded-lg border" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Photos équipement (pendant) */}
                {duringPhotos.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Photo de l'équipement</p>
                    <div className="grid grid-cols-2 gap-2">
                      {duringPhotos.map(photo => (
                        <a key={photo.id} href={photo.photo_url} target="_blank" rel="noopener noreferrer">
                          <img src={photo.photo_url} alt="Équipement" className="w-full aspect-video object-cover rounded-lg border" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Observation / Commentaires techniques */}
                {ie.technical_comments && (
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Observation</p>
                    <p className="text-sm whitespace-pre-wrap">{ie.technical_comments}</p>
                  </div>
                )}

                {/* État de l'équipement */}
                <div className="flex items-center justify-between bg-muted/30 rounded-lg p-3">
                  <span className="text-sm font-medium">État de l'équipement</span>
                  {(() => {
                    const getStatusDisplay = (status: string | null) => {
                      switch (status) {
                        case 'not_working':
                          return { label: '✗ Ne fonctionne pas', className: 'bg-red-100 text-red-800' };
                        case 'needs_intervention':
                          return { label: '⚠ Pièces ou intervention nécessaire', className: 'bg-orange-100 text-orange-800' };
                        case 'working':
                        default:
                          return { label: '✓ Fonctionne', className: 'bg-green-100 text-green-800' };
                      }
                    };
                    const statusDisplay = getStatusDisplay(ie.equipment_status);
                    return (
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusDisplay.className}`}>
                        {statusDisplay.label}
                      </span>
                    );
                  })()}
                </div>

                {/* Photos après intervention */}
                {afterPhotos.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Photos après intervention</p>
                    <div className="grid grid-cols-2 gap-2">
                      {afterPhotos.map(photo => (
                        <a key={photo.id} href={photo.photo_url} target="_blank" rel="noopener noreferrer">
                          <img src={photo.photo_url} alt="Après" className="w-full aspect-video object-cover rounded-lg border" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}


        {/* Photos générales (sans équipement) */}
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
                  <a key={photo.id} href={photo.photo_url} target="_blank" rel="noopener noreferrer">
                    <img src={photo.photo_url} alt="Photo" className="w-full aspect-video object-cover rounded-lg border" />
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Signature client */}
        {intervention.client_signature_url && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5" />
                Signature du client
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {intervention.client_signature_name && (
                <p className="text-sm">
                  Signataire : <span className="font-medium">{intervention.client_signature_name}</span>
                </p>
              )}
              <div className="border rounded-lg bg-white p-4 inline-block">
                <img 
                  src={intervention.client_signature_url} 
                  alt="Signature client" 
                  className="max-w-[200px] max-h-[100px]"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info footer */}
        <Card className="bg-muted/50">
          <CardContent className="py-4 text-center text-sm text-muted-foreground">
            <p>Cette page est mise à jour en temps réel.</p>
            <p>Dernière mise à jour : {format(new Date(intervention.updated_at), 'dd/MM/yyyy à HH:mm', { locale: fr })}</p>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer 
        className="py-4 mt-8 text-white"
        style={{ backgroundColor: settings.accentColor }}
      >
        <div className="container max-w-2xl mx-auto px-4 text-center text-sm">
          <p>{settings.footerText || `© ${new Date().getFullYear()} ${settings.companyName || "Service Intervention"}`}</p>
          {settings.companyAddress && <p className="opacity-80 mt-1">{settings.companyAddress}</p>}
        </div>
      </footer>
    </div>
  );
};

export default PublicIntervention;
