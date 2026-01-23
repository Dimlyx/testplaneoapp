import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  ChevronDown, 
  ChevronUp, 
  Wrench, 
  Camera, 
  X, 
  Save,
  Trash2,
  Image as ImageIcon
} from "lucide-react";
import { InterventionEquipment, EquipmentStatus, useUpdateInterventionEquipment, useRemoveInterventionEquipment } from "@/hooks/useInterventionEquipment";
import { useInterventionPhotos, useUploadInterventionPhoto, useDeleteInterventionPhoto, PhotoType } from "@/hooks/useInterventionPhotos";

interface EquipmentLoopCardProps {
  interventionEquipment: InterventionEquipment;
  interventionId: string;
  index: number;
  isReadOnly?: boolean;
}

const EquipmentLoopCard = ({ interventionEquipment, interventionId, index, isReadOnly = false }: EquipmentLoopCardProps) => {
  const [isOpen, setIsOpen] = useState(index === 0);
  const [technicalComments, setTechnicalComments] = useState(interventionEquipment.technical_comments || "");
  const [equipmentStatus, setEquipmentStatus] = useState<EquipmentStatus>(interventionEquipment.equipment_status || "working");
  const [isEditing, setIsEditing] = useState(false);

  const serialNumberInputRef = useRef<HTMLInputElement>(null);
  const duringInputRef = useRef<HTMLInputElement>(null);
  const afterInputRef = useRef<HTMLInputElement>(null);

  const updateEquipment = useUpdateInterventionEquipment();
  const removeEquipment = useRemoveInterventionEquipment();
  
  // Fetch photos filtered by equipment_id
  const { data: allPhotos = [] } = useInterventionPhotos(interventionId);
  const photos = allPhotos.filter(p => p.equipment_id === interventionEquipment.equipment_id);
  
  const uploadPhoto = useUploadInterventionPhoto();
  const deletePhoto = useDeleteInterventionPhoto();

  const equipment = interventionEquipment.equipment;

  const handleSave = async () => {
    await updateEquipment.mutateAsync({
      id: interventionEquipment.id,
      interventionId,
      technical_comments: technicalComments,
      equipment_status: equipmentStatus,
    });
    setIsEditing(false);
  };

  const handleRemove = async () => {
    if (confirm("Retirer cet équipement de l'intervention ?")) {
      await removeEquipment.mutateAsync({
        id: interventionEquipment.id,
        interventionId,
      });
    }
  };

  const handlePhotoCapture = async (photoType: PhotoType, file: File) => {
    await uploadPhoto.mutateAsync({
      interventionId,
      photoType,
      file,
      equipmentId: interventionEquipment.equipment_id,
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
    await deletePhoto.mutateAsync({ id: photoId, photoUrl, interventionId });
  };

  const getPhotosOfType = (type: PhotoType) => photos.filter(p => p.photo_type === type);

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
      <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ImageIcon className="h-4 w-4 text-primary" />
            {title}
          </div>
          {!isReadOnly && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={uploadPhoto.isPending}
            >
              <Camera className="h-3 w-3 mr-1" />
              {uploadPhoto.isPending ? "Envoi..." : "Ajouter"}
            </Button>
          )}
        </div>
        
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange(type)}
        />
        
        {typePhotos.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {typePhotos.map((photo) => (
              <div key={photo.id} className="relative aspect-video rounded-lg overflow-hidden border">
                <img
                  src={photo.photo_url}
                  alt={title}
                  className="w-full h-full object-cover"
                />
                {!isReadOnly && (
                  <button
                    onClick={() => handleDeletePhoto(photo.id, photo.photo_url)}
                    className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 shadow-md"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-16 border-2 border-dashed rounded-lg text-muted-foreground text-sm">
            Aucune photo
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="border-l-4 border-l-primary">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="h-6 w-6 rounded-full p-0 flex items-center justify-center">
                  {index + 1}
                </Badge>
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Wrench className="h-4 w-4" />
                    {equipment?.equipment_type || "Équipement"}
                  </CardTitle>
                  {equipment?.serial_number && (
                    <p className="text-sm text-muted-foreground">
                      {equipment.serial_number}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {equipmentStatus === "working" && (
                  <Badge variant="default" className="bg-green-600">OK</Badge>
                )}
                {equipmentStatus === "needs_intervention" && (
                  <Badge variant="secondary" className="bg-orange-500 text-white">À suivre</Badge>
                )}
                {equipmentStatus === "not_working" && (
                  <Badge variant="destructive">HS</Badge>
                )}
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4 pt-2">
            {/* Photos - Layout vertical */}
            <div className="space-y-3">
              <PhotoSection 
                title="Photo N° de série" 
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
            </div>

            {/* Technical Comments */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Commentaires techniques pour cet équipement
              </label>
              <Textarea
                placeholder="Notes spécifiques à cet équipement..."
                value={technicalComments}
                onChange={(e) => {
                  setTechnicalComments(e.target.value);
                  setIsEditing(true);
                }}
                className="min-h-[60px]"
                disabled={isReadOnly}
              />
            </div>

            {/* Equipment Status */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                État de l'équipement
              </Label>
              <Select
                value={equipmentStatus}
                onValueChange={(value: EquipmentStatus) => {
                  setEquipmentStatus(value);
                  setIsEditing(true);
                }}
                disabled={isReadOnly}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner l'état" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_working">Ne fonctionne pas</SelectItem>
                  <SelectItem value="needs_intervention">Fonctionne - Pièces ou intervention nécessaire</SelectItem>
                  <SelectItem value="working">Fonctionne</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Actions */}
            {!isReadOnly && (
              <div className="flex gap-2">
                {isEditing && (
                  <Button 
                    onClick={handleSave} 
                    className="flex-1"
                    disabled={updateEquipment.isPending}
                    size="sm"
                  >
                    <Save className="h-3 w-3 mr-1" />
                    Enregistrer
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleRemove}
                  disabled={removeEquipment.isPending}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export default EquipmentLoopCard;
