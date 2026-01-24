import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock, Edit2 } from "lucide-react";
import { useUpdateIntervention, Intervention } from "@/hooks/useInterventions";

interface TimesCorrectionDialogProps {
  intervention: Intervention;
  onSuccess?: () => void;
}

export function TimesCorrectionDialog({ intervention, onSuccess }: TimesCorrectionDialogProps) {
  const [open, setOpen] = useState(false);
  const [travelDepartureTime, setTravelDepartureTime] = useState("");
  const [arrivalTime, setArrivalTime] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  
  const updateIntervention = useUpdateIntervention();

  // Initialize values when dialog opens
  useEffect(() => {
    if (open) {
      setTravelDepartureTime(intervention.travel_departure_time?.substring(0, 5) || "");
      setArrivalTime(intervention.arrival_time?.substring(0, 5) || "");
      setDepartureTime(intervention.departure_time?.substring(0, 5) || "");
    }
  }, [open, intervention]);

  const handleSave = async () => {
    await updateIntervention.mutateAsync({
      id: intervention.id,
      travel_departure_time: travelDepartureTime || null,
      arrival_time: arrivalTime || null,
      departure_time: departureTime || null,
    });
    setOpen(false);
    onSuccess?.();
  };

  const handleClear = (field: 'travel' | 'arrival' | 'departure') => {
    switch (field) {
      case 'travel':
        setTravelDepartureTime("");
        break;
      case 'arrival':
        setArrivalTime("");
        break;
      case 'departure':
        setDepartureTime("");
        break;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Edit2 className="h-4 w-4 mr-2" />
          Corriger les temps
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Correction des temps
          </DialogTitle>
          <DialogDescription>
            Modifiez manuellement les horodatages de l'intervention si le technicien a oublié de cliquer sur les boutons.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Trajet - Départ domicile */}
          <div className="space-y-2">
            <Label htmlFor="travel-departure" className="flex items-center gap-2">
              <span className="text-blue-600">🚗</span> Départ domicile
            </Label>
            <div className="flex gap-2">
              <Input
                id="travel-departure"
                type="time"
                value={travelDepartureTime}
                onChange={(e) => setTravelDepartureTime(e.target.value)}
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleClear('travel')}
                className="text-muted-foreground"
              >
                Effacer
              </Button>
            </div>
          </div>

          {/* Arrivée chez le client / Début intervention */}
          <div className="space-y-2">
            <Label htmlFor="arrival" className="flex items-center gap-2">
              <span className="text-green-600">🔧</span> Arrivée client / Début intervention
            </Label>
            <div className="flex gap-2">
              <Input
                id="arrival"
                type="time"
                value={arrivalTime}
                onChange={(e) => setArrivalTime(e.target.value)}
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleClear('arrival')}
                className="text-muted-foreground"
              >
                Effacer
              </Button>
            </div>
          </div>

          {/* Fin intervention */}
          <div className="space-y-2">
            <Label htmlFor="departure" className="flex items-center gap-2">
              <span className="text-purple-600">✓</span> Fin intervention
            </Label>
            <div className="flex gap-2">
              <Input
                id="departure"
                type="time"
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleClear('departure')}
                className="text-muted-foreground"
              >
                Effacer
              </Button>
            </div>
          </div>

          {/* Info box */}
          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm">
            <p className="text-amber-800 dark:text-amber-200">
              <strong>Note :</strong> Ces modifications sont destinées aux corrections exceptionnelles. 
              Les temps doivent normalement être enregistrés par le technicien sur le terrain.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={updateIntervention.isPending}>
            {updateIntervention.isPending ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
