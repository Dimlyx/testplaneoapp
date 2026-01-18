import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useIntervention, useUpdateIntervention } from "@/hooks/useInterventions";
import { useClient } from "@/hooks/useClients";
import { useInterventionPhotos, useUploadInterventionPhoto, useDeleteInterventionPhoto, PhotoType } from "@/hooks/useInterventionPhotos";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { StatusBadge, TypeBadge } from "@/components/ui/status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  ArrowLeft, 
  User, 
  Calendar, 
  Clock, 
  MapPin, 
  Phone, 
  Mail,
  FileText,
  Save,
  Wrench,
  CheckCircle,
  Play,
  Pause,
  Camera,
  X,
  Image as ImageIcon
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { generateInterventionPDF } from "@/lib/pdf-generator";
import SignaturePad from "@/components/SignaturePad";
import { supabase } from "@/integrations/supabase/client";

const TechnicianInterventionDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { data: intervention, isLoading } = useIntervention(id || "");
  const { data: client } = useClient(intervention?.client_id || "");
  const { data: photos = [] } = useInterventionPhotos(id || "");
  const uploadPhoto = useUploadInterventionPhoto();
  const deletePhoto = useDeleteInterventionPhoto();
  const updateIntervention = useUpdateIntervention();

  const serialNumberInputRef = useRef<HTMLInputElement>(null);
  const duringInputRef = useRef<HTMLInputElement>(null);
  const afterInputRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<string>("");
  const [report, setReport] = useState<string>("");
  const [technicalComments, setTechnicalComments] = useState<string>("");
  const [arrivalTime, setArrivalTime] = useState<string>("");
  const [departureTime, setDepartureTime] = useState<string>("");
  const [observations, setObservations] = useState<string>("");
  const [equipmentFunctional, setEquipmentFunctional] = useState<boolean>(true);
  const [clientSignatureName, setClientSignatureName] = useState<string>("");
  const [clientSignatureUrl, setClientSignatureUrl] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isUploadingSignature, setIsUploadingSignature] = useState(false);

  // Initialize form when data loads
  useEffect(() => {
    if (intervention) {
      setStatus(intervention.status);
      setReport(intervention.report || "");
      setTechnicalComments(intervention.technical_comments || "");
      setArrivalTime(intervention.arrival_time || "");
      setDepartureTime(intervention.departure_time || "");
      setObservations(intervention.observations || "");
      setEquipmentFunctional(intervention.equipment_functional !== false);
      setClientSignatureName(intervention.client_signature_name || "");
      setClientSignatureUrl(intervention.client_signature_url || null);
    }
  }, [intervention]);

  const handleSignatureComplete = async (signatureDataUrl: string, signerName: string) => {
    if (!id) return;
    
    setIsUploadingSignature(true);
    try {
      // Convert data URL to blob
      const response = await fetch(signatureDataUrl);
      const blob = await response.blob();
      
      // Upload to storage
      const fileName = `signatures/${id}-${Date.now()}.png`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('intervention-photos')
        .upload(fileName, blob, {
          contentType: 'image/png',
          upsert: true
        });
      
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('intervention-photos')
        .getPublicUrl(fileName);
      
      const signatureUrl = urlData.publicUrl;
      
      // Update intervention with signature URL and name
      await updateIntervention.mutateAsync({
        id,
        client_signature_name: signerName,
        client_signature_url: signatureUrl,
      });
      
      setClientSignatureUrl(signatureUrl);
      setClientSignatureName(signerName);
      toast({ title: "Signature enregistrée" });
    } catch (error) {
      console.error('Error uploading signature:', error);
      toast({ title: "Erreur lors de l'enregistrement de la signature", variant: "destructive" });
    } finally {
      setIsUploadingSignature(false);
    }
  };

  const handlePhotoCapture = async (photoType: PhotoType, file: File) => {
    if (!id) return;
    await uploadPhoto.mutateAsync({
      interventionId: id,
      photoType,
      file,
    });
  };

  const handleFileChange = (photoType: PhotoType) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handlePhotoCapture(photoType, file);
    }
    e.target.value = '';
  };

  const handleDeletePhoto = async (photoId: string, photoUrl: string) => {
    if (!id) return;
    await deletePhoto.mutateAsync({ id: photoId, photoUrl, interventionId: id });
  };

  const getPhotosOfType = (type: PhotoType) => photos.filter(p => p.photo_type === type);

  const handleStartIntervention = async () => {
    if (!id) return;
    const now = format(new Date(), 'HH:mm');
    setArrivalTime(now);
    setStatus('in_progress');
    try {
      await updateIntervention.mutateAsync({
        id,
        status: 'in_progress',
        arrival_time: now,
      });
      toast({ title: "Intervention démarrée" });
    } catch (error) {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  const handleEndIntervention = async () => {
    if (!id) return;
    const now = format(new Date(), 'HH:mm');
    setDepartureTime(now);
    setStatus('completed');
    try {
      await updateIntervention.mutateAsync({
        id,
        status: 'completed',
        departure_time: now,
        report,
        observations,
        equipment_functional: equipmentFunctional,
        client_signature_name: clientSignatureName,
        technical_comments: technicalComments,
      });
      toast({ title: "Intervention terminée" });
      setIsEditing(false);
    } catch (error) {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  const handleSave = async () => {
    if (!id) return;
    try {
      await updateIntervention.mutateAsync({
        id,
        status: status as any,
        report,
        technical_comments: technicalComments,
        arrival_time: arrivalTime || null,
        departure_time: departureTime || null,
        observations,
        equipment_functional: equipmentFunctional,
        client_signature_name: clientSignatureName,
      });
      toast({ title: "Intervention mise à jour" });
      setIsEditing(false);
    } catch (error) {
      toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
    }
  };

  const handleDownloadPDF = async () => {
    if (intervention && client) {
      toast({ title: "Génération du rapport en cours..." });
      await generateInterventionPDF(
        intervention, 
        client, 
        intervention.equipment as any,
        intervention.profiles?.full_name || undefined,
        photos
      );
      toast({ title: "Rapport téléchargé" });
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
        <Button className="mt-4" onClick={() => navigate("/technician")}>
          Retour
        </Button>
      </div>
    );
  }

  const currentStatus = status || intervention.status;
  const canStart = currentStatus === 'planned' || currentStatus === 'to_plan';
  const canEnd = currentStatus === 'in_progress';

  const PhotoSection = ({ 
    title, 
    type, 
    inputRef 
  }: { 
    title: string; 
    type: PhotoType; 
    inputRef: React.RefObject<HTMLInputElement>;
  }) => {
    const typePhotos = getPhotosOfType(type);
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Hidden file input with camera capture */}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange(type)}
          />
          
          {/* Photo grid */}
          {typePhotos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {typePhotos.map((photo) => (
                <div key={photo.id} className="relative aspect-square">
                  <img
                    src={photo.photo_url}
                    alt={title}
                    className="w-full h-full object-cover rounded-lg"
                  />
                  <button
                    onClick={() => handleDeletePhoto(photo.id, photo.photo_url)}
                    className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-1"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {/* Add photo button */}
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => inputRef.current?.click()}
            disabled={uploadPhoto.isPending}
          >
            <Camera className="h-4 w-4 mr-2" />
            {uploadPhoto.isPending ? "Envoi en cours..." : "Prendre une photo"}
          </Button>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{intervention.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <TypeBadge type={intervention.intervention_type} />
            <StatusBadge status={currentStatus as any} />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      {canStart && (
        <Button onClick={handleStartIntervention} className="w-full" size="lg">
          <Play className="h-5 w-5 mr-2" />
          Démarrer l'intervention
        </Button>
      )}
      
      {canEnd && (
        <Button onClick={handleEndIntervention} variant="default" className="w-full bg-green-600 hover:bg-green-700" size="lg">
          <CheckCircle className="h-5 w-5 mr-2" />
          Terminer l'intervention
        </Button>
      )}

      {/* Planification */}
      <Card>
        <CardContent className="p-4 space-y-3">
          {intervention.scheduled_date && (
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>
                {format(new Date(intervention.scheduled_date), 'EEEE dd MMMM yyyy', { locale: fr })}
              </span>
            </div>
          )}
          {intervention.scheduled_time && (
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>RDV: {intervention.scheduled_time}</span>
            </div>
          )}
          {arrivalTime && (
            <div className="flex items-center gap-3 text-green-600">
              <Play className="h-4 w-4" />
              <span>Arrivée: {arrivalTime}</span>
            </div>
          )}
          {departureTime && (
            <div className="flex items-center gap-3 text-blue-600">
              <Pause className="h-4 w-4" />
              <span>Départ: {departureTime}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Client */}
      {client && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              Client
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="font-medium">{client.name}</p>
            {client.address && (
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{client.address}, {client.postal_code} {client.city}</span>
              </div>
            )}
            {client.phone && (
              <a href={`tel:${client.phone}`} className="flex items-center gap-2 text-sm text-primary">
                <Phone className="h-4 w-4" />
                {client.phone}
              </a>
            )}
            {client.email && (
              <a href={`mailto:${client.email}`} className="flex items-center gap-2 text-sm text-primary">
                <Mail className="h-4 w-4" />
                {client.email}
              </a>
            )}
          </CardContent>
        </Card>
      )}

      {/* Description */}
      {intervention.description && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{intervention.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Photos sections */}
      <PhotoSection 
        title="Photo du numéro de série" 
        type="serial_number" 
        inputRef={serialNumberInputRef}
      />
      
      <PhotoSection 
        title="Photos pendant intervention" 
        type="during" 
        inputRef={duringInputRef}
      />
      
      <PhotoSection 
        title="Photos après intervention" 
        type="after" 
        inputRef={afterInputRef}
      />

      {/* Rapport d'intervention */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Rapport d'intervention
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Statut</label>
            <Select 
              value={currentStatus} 
              onValueChange={(value) => {
                setStatus(value);
                setIsEditing(true);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="to_plan">À planifier</SelectItem>
                <SelectItem value="planned">Planifiée</SelectItem>
                <SelectItem value="in_progress">En cours</SelectItem>
                <SelectItem value="completed">Terminée</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Heure d'arrivée</label>
              <Input
                type="time"
                value={arrivalTime}
                onChange={(e) => {
                  setArrivalTime(e.target.value);
                  setIsEditing(true);
                }}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Heure de départ</label>
              <Input
                type="time"
                value={departureTime}
                onChange={(e) => {
                  setDepartureTime(e.target.value);
                  setIsEditing(true);
                }}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Travaux effectués / Compte rendu</label>
            <Textarea
              placeholder="Décrivez les travaux réalisés..."
              value={report}
              onChange={(e) => {
                setReport(e.target.value);
                setIsEditing(true);
              }}
              className="min-h-[100px]"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Observations</label>
            <Textarea
              placeholder="Observations, recommandations..."
              value={observations}
              onChange={(e) => {
                setObservations(e.target.value);
                setIsEditing(true);
              }}
              className="min-h-[80px]"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="equipment-functional" className="text-sm font-medium">
              L'équipement fonctionne correctement
            </Label>
            <Switch
              id="equipment-functional"
              checked={equipmentFunctional}
              onCheckedChange={(checked) => {
                setEquipmentFunctional(checked);
                setIsEditing(true);
              }}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Commentaires techniques (interne)</label>
            <Textarea
              placeholder="Notes techniques internes..."
              value={technicalComments}
              onChange={(e) => {
                setTechnicalComments(e.target.value);
                setIsEditing(true);
              }}
              className="min-h-[60px]"
            />
          </div>

          {isEditing && (
            <Button 
              onClick={handleSave} 
              className="w-full"
              disabled={updateIntervention.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              Enregistrer
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Signature du client */}
      <SignaturePad
        onSignatureComplete={handleSignatureComplete}
        signerName={clientSignatureName}
        onSignerNameChange={setClientSignatureName}
        existingSignature={clientSignatureUrl}
      />

      {/* PDF */}
      <Button variant="outline" className="w-full" onClick={handleDownloadPDF}>
        <FileText className="h-4 w-4 mr-2" />
        Télécharger le rapport PDF
      </Button>
    </div>
  );
};

export default TechnicianInterventionDetail;
