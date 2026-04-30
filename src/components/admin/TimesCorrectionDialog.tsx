import { useState, useEffect, useMemo } from "react";
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
import { Clock, Edit2, AlertTriangle } from "lucide-react";
import { useUpdateIntervention, Intervention } from "@/hooks/useInterventions";

interface TimesCorrectionDialogProps {
  intervention: Intervention;
  onSuccess?: () => void;
}

/** Convertit "HH:mm" en minutes depuis minuit, ou null. */
function toMin(t: string | null | undefined): number | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

/**
 * Détecte les incohérences chronologiques.
 * Tolère le franchissement de minuit pour le retour (return_arrival peut être < return_start).
 */
function detectIncoherence(
  travelDep: string,
  arrival: string,
  departure: string,
  returnStart: string,
  returnArrival: string,
): string | null {
  const td = toMin(travelDep);
  const a = toMin(arrival);
  const d = toMin(departure);
  const rs = toMin(returnStart);
  const ra = toMin(returnArrival);

  if (td !== null && a !== null && a < td) return "Arrivée client avant le départ domicile.";
  if (a !== null && d !== null && d < a) return "Fin d'intervention avant l'arrivée client.";
  if (d !== null && rs !== null && rs < d) return "Départ retour avant la fin d'intervention.";
  // Pour le retour, autoriser passage de minuit (diff < 12h sinon suspect).
  if (rs !== null && ra !== null) {
    let diff = ra - rs;
    if (diff < 0) diff += 24 * 60;
    if (diff > 12 * 60) return "Durée de retour supérieure à 12h, probablement incohérent.";
  }
  return null;
}

export function TimesCorrectionDialog({ intervention, onSuccess }: TimesCorrectionDialogProps) {
  const [open, setOpen] = useState(false);
  const [travelDepartureTime, setTravelDepartureTime] = useState("");
  const [arrivalTime, setArrivalTime] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [travelReturnTime, setTravelReturnTime] = useState("");
  const [travelReturnArrivalTime, setTravelReturnArrivalTime] = useState("");

  const updateIntervention = useUpdateIntervention();

  // Initialize values when dialog opens
  useEffect(() => {
    if (open) {
      setTravelDepartureTime(intervention.travel_departure_time?.substring(0, 5) || "");
      setArrivalTime(intervention.arrival_time?.substring(0, 5) || "");
      setDepartureTime(intervention.departure_time?.substring(0, 5) || "");
      setTravelReturnTime(intervention.travel_return_time?.substring(0, 5) || "");
      setTravelReturnArrivalTime(
        (intervention as any).travel_return_arrival_time?.substring(0, 5) || ""
      );
    }
  }, [open, intervention]);

  const incoherence = useMemo(
    () =>
      detectIncoherence(
        travelDepartureTime,
        arrivalTime,
        departureTime,
        travelReturnTime,
        travelReturnArrivalTime,
      ),
    [travelDepartureTime, arrivalTime, departureTime, travelReturnTime, travelReturnArrivalTime],
  );

  const handleSave = async () => {
    await updateIntervention.mutateAsync({
      id: intervention.id,
      travel_departure_time: travelDepartureTime || null,
      arrival_time: arrivalTime || null,
      departure_time: departureTime || null,
      travel_return_time: travelReturnTime || null,
      travel_return_arrival_time: travelReturnArrivalTime || null,
    });
    setOpen(false);
    onSuccess?.();
  };

  const handleClear = (
    field: "travel" | "arrival" | "departure" | "returnStart" | "returnArrival",
  ) => {
    switch (field) {
      case "travel":
        setTravelDepartureTime("");
        break;
      case "arrival":
        setArrivalTime("");
        break;
      case "departure":
        setDepartureTime("");
        break;
      case "returnStart":
        setTravelReturnTime("");
        break;
      case "returnArrival":
        setTravelReturnArrivalTime("");
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
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Correction des temps
          </DialogTitle>
          <DialogDescription>
            Modifiez manuellement les horodatages de l'intervention si le technicien a oublié de
            cliquer sur les boutons.
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
                onClick={() => handleClear("travel")}
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
                onClick={() => handleClear("arrival")}
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
                onClick={() => handleClear("departure")}
                className="text-muted-foreground"
              >
                Effacer
              </Button>
            </div>
          </div>

          {/* Départ retour (depuis le client) */}
          <div className="space-y-2">
            <Label htmlFor="return-start" className="flex items-center gap-2">
              <span className="text-orange-600">🏠</span> Départ retour (depuis client)
            </Label>
            <div className="flex gap-2">
              <Input
                id="return-start"
                type="time"
                value={travelReturnTime}
                onChange={(e) => setTravelReturnTime(e.target.value)}
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleClear("returnStart")}
                className="text-muted-foreground"
              >
                Effacer
              </Button>
            </div>
          </div>

          {/* Arrivée domicile */}
          <div className="space-y-2">
            <Label htmlFor="return-arrival" className="flex items-center gap-2">
              <span className="text-orange-600">🏡</span> Arrivée domicile
            </Label>
            <div className="flex gap-2">
              <Input
                id="return-arrival"
                type="time"
                value={travelReturnArrivalTime}
                onChange={(e) => setTravelReturnArrivalTime(e.target.value)}
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleClear("returnArrival")}
                className="text-muted-foreground"
              >
                Effacer
              </Button>
            </div>
          </div>

          {/* Avertissement d'incohérence */}
          {incoherence && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm flex gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <p className="text-red-800 dark:text-red-200">
                <strong>Incohérence détectée :</strong> {incoherence}
              </p>
            </div>
          )}

          {/* Info box */}
          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm">
            <p className="text-amber-800 dark:text-amber-200">
              <strong>Note :</strong> Ces modifications sont destinées aux corrections
              exceptionnelles. Les temps doivent normalement être enregistrés par le technicien
              sur le terrain.
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
