import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Car, MapPin, Play } from "lucide-react";
import { format } from "date-fns";

type JourneyStatus = "idle" | "traveling" | "arrived" | "working";

interface JourneyTrackerProps {
  interventionStatus: string;
  travelDepartureTime: string | null;
  arrivalTime: string | null;
  onStatusChange: (newStatus: string) => Promise<void>;
  onTimeUpdate: (field: string, value: string) => Promise<void>;
  isUpdating: boolean;
}

const JourneyTracker = ({
  interventionStatus,
  travelDepartureTime,
  arrivalTime,
  onStatusChange,
  onTimeUpdate,
  isUpdating,
}: JourneyTrackerProps) => {
  // Determine initial state based on intervention status and times
  const getInitialState = (): JourneyStatus => {
    if (interventionStatus === "in_progress") return "working";
    if (interventionStatus === "completed" || interventionStatus === "to_invoice" || interventionStatus === "archived") return "working";
    if (arrivalTime) return "arrived";
    if (travelDepartureTime) return "traveling";
    return "idle";
  };

  const [journeyStatus, setJourneyStatus] = useState<JourneyStatus>(getInitialState);

  useEffect(() => {
    setJourneyStatus(getInitialState());
  }, [interventionStatus, travelDepartureTime, arrivalTime]);

  const getCurrentTime = () => format(new Date(), 'HH:mm:ss');

  const handleStartJourney = async () => {
    const time = getCurrentTime();
    await onTimeUpdate("travel_departure_time", time);
    setJourneyStatus("traveling");
  };

  const handleEndJourney = async () => {
    const time = getCurrentTime();
    await onTimeUpdate("arrival_time", time);
    setJourneyStatus("arrived");
  };

  const handleStartIntervention = async () => {
    setJourneyStatus("working");
    await onStatusChange("in_progress");
  };

  // Don't show if intervention is already completed/archived
  if (interventionStatus === "completed" || interventionStatus === "to_invoice" || interventionStatus === "archived") {
    return null;
  }

  // Don't show if intervention is already in progress
  if (interventionStatus === "in_progress") {
    return null;
  }

  return (
    <div className="border-t pt-4 mt-4">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 block">
        Suivi intervention
      </label>
      
      {journeyStatus === "idle" && (
        <Button 
          onClick={handleStartJourney} 
          className="w-full bg-blue-600 hover:bg-blue-700"
          size="lg"
          disabled={isUpdating}
        >
          <Car className="h-5 w-5 mr-2" />
          Démarrer le trajet
        </Button>
      )}

      {journeyStatus === "traveling" && (
        <Button 
          onClick={handleEndJourney} 
          className="w-full bg-orange-600 hover:bg-orange-700"
          size="lg"
          disabled={isUpdating}
        >
          <MapPin className="h-5 w-5 mr-2" />
          Mettre fin au trajet
        </Button>
      )}

      {journeyStatus === "arrived" && (
        <Button 
          onClick={handleStartIntervention} 
          className="w-full bg-green-600 hover:bg-green-700"
          size="lg"
          disabled={isUpdating}
        >
          <Play className="h-5 w-5 mr-2" />
          Commencer l'intervention
        </Button>
      )}
    </div>
  );
};

export default JourneyTracker;
