import { useNavigate, useParams, Link } from "react-router-dom";
import { useIntervention } from "@/hooks/useInterventions";
import { useClient } from "@/hooks/useClients";
import { useInterventionPhotos, PhotoType } from "@/hooks/useInterventionPhotos";
import { useInterventionEquipment } from "@/hooks/useInterventionEquipment";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, TypeBadge } from "@/components/ui/status-badge";
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
  Image as ImageIcon
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { generateInterventionPDF } from "@/lib/pdf-generator";

const InterventionDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { data: intervention, isLoading } = useIntervention(id || "");
  const { data: client } = useClient(intervention?.client_id || "");
  const { data: photos = [] } = useInterventionPhotos(id || "");
  const { data: interventionEquipments = [] } = useInterventionEquipment(id || "");

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
      toast({ title: "Génération du PDF en cours..." });
      await generateInterventionPDF(
        intervention, 
        client, 
        intervention.equipment as any,
        intervention.profiles?.full_name || undefined,
        photos,
        interventionEquipments
      );
      toast({ title: "PDF généré avec succès" });
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
          <Button variant="outline" onClick={handleDownloadPDF}>
            <FileText className="h-4 w-4 mr-2" />
            Télécharger PDF
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

        {/* Rapport */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Compte rendu d'intervention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">
              {intervention.report || "Aucun compte rendu pour le moment"}
            </p>
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

        {/* Signature client */}
        {intervention.client_signature_url && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Signature client
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {intervention.client_signature_name && (
                <p className="text-sm text-muted-foreground">
                  Signataire : <span className="font-medium text-foreground">{intervention.client_signature_name}</span>
                </p>
              )}
              <img 
                src={intervention.client_signature_url} 
                alt="Signature client" 
                className="max-w-xs border rounded-lg bg-white p-2"
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default InterventionDetail;
