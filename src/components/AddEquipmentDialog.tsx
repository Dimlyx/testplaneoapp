import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Wrench } from "lucide-react";
import { useAddInterventionEquipment } from "@/hooks/useInterventionEquipment";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface AddEquipmentDialogProps {
  clientId: string;
  interventionId: string;
  existingEquipmentIds: string[];
  organizationId?: string | null;
}

const AddEquipmentDialog = ({ clientId, interventionId, existingEquipmentIds, organizationId }: AddEquipmentDialogProps) => {
  const [open, setOpen] = useState(false);
  const [equipmentType, setEquipmentType] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const addEquipment = useAddInterventionEquipment();

  const handleCreateAndAdd = async () => {
    const type = equipmentType.trim() || "Équipement";
    
    setIsCreating(true);
    try {
      // Create new equipment with minimal info and organization
      const { data: newEquipment, error } = await supabase
        .from('equipment')
        .insert({
          client_id: clientId,
          equipment_type: type,
          brand: "À identifier",
          model: "À identifier",
          organization_id: organizationId || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Add to intervention
      await addEquipment.mutateAsync({
        interventionId,
        equipmentId: newEquipment.id,
      });

      // Reset form
      setEquipmentType("");
      setOpen(false);
      
      toast({
        title: "Équipement ajouté",
        description: "Prenez les photos pour documenter l'équipement.",
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full" variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          Ajouter un équipement
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Ajouter un équipement
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Ajoutez un équipement rapidement. Vous pourrez le documenter avec des photos.
          </p>
          
          <div>
            <Label>Type d'équipement (optionnel)</Label>
            <Input
              placeholder="Ex: Climatiseur, Chaudière..."
              value={equipmentType}
              onChange={(e) => setEquipmentType(e.target.value)}
            />
          </div>
          
          <Button 
            onClick={handleCreateAndAdd} 
            disabled={isCreating || addEquipment.isPending}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Ajouter
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddEquipmentDialog;
