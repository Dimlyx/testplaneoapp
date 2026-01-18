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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Wrench } from "lucide-react";
import { useClientEquipment, useAddInterventionEquipment, ClientEquipment } from "@/hooks/useInterventionEquipment";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface AddEquipmentDialogProps {
  clientId: string;
  interventionId: string;
  existingEquipmentIds: string[];
}

const AddEquipmentDialog = ({ clientId, interventionId, existingEquipmentIds }: AddEquipmentDialogProps) => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"select" | "create">("select");
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>("");
  
  // New equipment form
  const [newEquipmentType, setNewEquipmentType] = useState("");
  const [newBrand, setNewBrand] = useState("");
  const [newModel, setNewModel] = useState("");
  const [newSerialNumber, setNewSerialNumber] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const { data: clientEquipment = [] } = useClientEquipment(clientId);
  const addEquipment = useAddInterventionEquipment();

  // Filter out already added equipment
  const availableEquipment = clientEquipment.filter(
    eq => !existingEquipmentIds.includes(eq.id)
  );

  const handleAddExisting = async () => {
    if (!selectedEquipmentId) return;
    
    await addEquipment.mutateAsync({
      interventionId,
      equipmentId: selectedEquipmentId,
    });
    
    setSelectedEquipmentId("");
    setOpen(false);
  };

  const handleCreateAndAdd = async () => {
    if (!newEquipmentType || !newBrand || !newModel) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir les champs obligatoires.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      // Create new equipment
      const { data: newEquipment, error } = await supabase
        .from('equipment')
        .insert({
          client_id: clientId,
          equipment_type: newEquipmentType,
          brand: newBrand,
          model: newModel,
          serial_number: newSerialNumber || null,
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
      setNewEquipmentType("");
      setNewBrand("");
      setNewModel("");
      setNewSerialNumber("");
      setMode("select");
      setOpen(false);
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Ajouter un équipement
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Mode selector */}
          <div className="flex gap-2">
            <Button
              variant={mode === "select" ? "default" : "outline"}
              className="flex-1"
              onClick={() => setMode("select")}
              size="sm"
            >
              Existant
            </Button>
            <Button
              variant={mode === "create" ? "default" : "outline"}
              className="flex-1"
              onClick={() => setMode("create")}
              size="sm"
            >
              Nouveau
            </Button>
          </div>

          {mode === "select" ? (
            <>
              {availableEquipment.length > 0 ? (
                <div className="space-y-3">
                  <Label>Sélectionner un équipement</Label>
                  <Select value={selectedEquipmentId} onValueChange={setSelectedEquipmentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir un équipement..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableEquipment.map((eq) => (
                        <SelectItem key={eq.id} value={eq.id}>
                          {eq.brand} {eq.model} ({eq.equipment_type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    onClick={handleAddExisting} 
                    disabled={!selectedEquipmentId || addEquipment.isPending}
                    className="w-full"
                  >
                    Ajouter
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucun équipement disponible pour ce client.
                  <br />
                  Créez-en un nouveau.
                </p>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <div>
                <Label>Type d'équipement *</Label>
                <Input
                  placeholder="Ex: Climatiseur, Chaudière..."
                  value={newEquipmentType}
                  onChange={(e) => setNewEquipmentType(e.target.value)}
                />
              </div>
              <div>
                <Label>Marque *</Label>
                <Input
                  placeholder="Ex: Daikin, Atlantic..."
                  value={newBrand}
                  onChange={(e) => setNewBrand(e.target.value)}
                />
              </div>
              <div>
                <Label>Modèle *</Label>
                <Input
                  placeholder="Ex: FTXM35..."
                  value={newModel}
                  onChange={(e) => setNewModel(e.target.value)}
                />
              </div>
              <div>
                <Label>Numéro de série</Label>
                <Input
                  placeholder="Optionnel"
                  value={newSerialNumber}
                  onChange={(e) => setNewSerialNumber(e.target.value)}
                />
              </div>
              <Button 
                onClick={handleCreateAndAdd} 
                disabled={isCreating || addEquipment.isPending}
                className="w-full"
              >
                Créer et ajouter
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddEquipmentDialog;
