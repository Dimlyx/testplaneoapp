import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Car, MapPin, Play, Clock, CheckCircle } from "lucide-react";
import { format } from "date-fns";

interface JourneyTrackerProps {
  interventionStatus: string;
  travelDepartureTime: string | null;
  arrivalTime: string | null;
  departureTime: string | null;
  onStatusChange: (newStatus: string) => Promise<void>;
  onTimeUpdate: (field: string, value: string) => Promise<void>;
  isUpdating: boolean;
}

const JourneyTracker = ({
  interventionStatus,
  travelDepartureTime,
  arrivalTime,
  departureTime,
  onStatusChange,
  onTimeUpdate,
  isUpdating,
}: JourneyTrackerProps) => {
  const getCurrentTime = () => format(new Date(), 'HH:mm:ss');

  const formatTime = (time: string | null) => {
    if (!time) return null;
    return time.substring(0, 5); // HH:mm
  };

  // Travel tracking states
  const hasTravelStarted = !!travelDepartureTime;
  const hasTravelEnded = !!arrivalTime;

  // Intervention tracking states
  const isInterventionStarted = interventionStatus === 'in_progress' || interventionStatus === 'completed' || interventionStatus === 'to_invoice' || interventionStatus === 'archived';
  const isInterventionEnded = !!departureTime;
  const isLocked = interventionStatus === 'completed' || interventionStatus === 'to_invoice' || interventionStatus === 'archived';

  const handleStartTravel = async () => {
    const time = getCurrentTime();
    await onTimeUpdate("travel_departure_time", time);
  };

  const handleEndTravel = async () => {
    const time = getCurrentTime();
    await onTimeUpdate("arrival_time", time);
  };

  const handleStartIntervention = async () => {
    // If travel wasn't tracked, record arrival time now
    if (!arrivalTime) {
      const time = getCurrentTime();
      await onTimeUpdate("arrival_time", time);
    }
    await onStatusChange("in_progress");
  };

  // Don't show if intervention is locked
  if (isLocked) {
    return (
      <div className="space-y-3">
        {/* Summary of times when locked */}
        <Card className="bg-muted/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Clock className="h-4 w-4" />
              <span className="font-medium">Temps enregistrés</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {travelDepartureTime && (
                <div>
                  <span className="text-muted-foreground">Départ trajet:</span>
                  <span className="ml-1 font-medium">{formatTime(travelDepartureTime)}</span>
                </div>
              )}
              {arrivalTime && (
                <div>
                  <span className="text-muted-foreground">Arrivée:</span>
                  <span className="ml-1 font-medium">{formatTime(arrivalTime)}</span>
                </div>
              )}
              {departureTime && (
                <div>
                  <span className="text-muted-foreground">Fin intervention:</span>
                  <span className="ml-1 font-medium">{formatTime(departureTime)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Travel Tracking Section */}
      <div className="border-t pt-4">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 block flex items-center gap-2">
          <Car className="h-3.5 w-3.5" />
          Suivi trajet (optionnel)
        </label>
        
        <div className="flex gap-2">
          {!hasTravelStarted ? (
            <Button 
              onClick={handleStartTravel} 
              variant="outline"
              className="flex-1 border-blue-300 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
              disabled={isUpdating || isInterventionStarted}
            >
              <Car className="h-4 w-4 mr-2" />
              Démarrer trajet
            </Button>
          ) : !hasTravelEnded ? (
            <Button 
              onClick={handleEndTravel} 
              variant="outline"
              className="flex-1 border-orange-300 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
              disabled={isUpdating || isInterventionStarted}
            >
              <MapPin className="h-4 w-4 mr-2" />
              Arrivée sur site
            </Button>
          ) : (
            <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md text-green-700 dark:text-green-300 text-sm">
              <CheckCircle className="h-4 w-4" />
              <span>Trajet: {formatTime(travelDepartureTime)} → {formatTime(arrivalTime)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Intervention Tracking Section - MANDATORY */}
      <div className="border-t pt-4">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 block flex items-center gap-2">
          <Play className="h-3.5 w-3.5" />
          Suivi intervention (obligatoire)
        </label>
        
        {!isInterventionStarted ? (
          <Button 
            onClick={handleStartIntervention} 
            className="w-full bg-green-600 hover:bg-green-700"
            size="lg"
            disabled={isUpdating}
          >
            <Play className="h-5 w-5 mr-2" />
            Démarrer l'intervention
          </Button>
        ) : isInterventionEnded ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md text-green-700 dark:text-green-300 text-sm">
            <CheckCircle className="h-4 w-4" />
            <span>Intervention terminée à {formatTime(departureTime)}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md text-blue-700 dark:text-blue-300 text-sm">
            <Clock className="h-4 w-4 animate-pulse" />
            <span>Intervention en cours depuis {formatTime(arrivalTime)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default JourneyTracker;