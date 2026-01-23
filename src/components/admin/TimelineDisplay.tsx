import { Car, MapPin, LogOut, Home, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface TimelineDisplayProps {
  travelDepartureTime: string | null;
  arrivalTime: string | null;
  departureTime: string | null;
  travelReturnTime: string | null;
}

const TimelineDisplay = ({
  travelDepartureTime,
  arrivalTime,
  departureTime,
  travelReturnTime,
}: TimelineDisplayProps) => {
  // Calculate durations
  const calculateDuration = (start: string | null, end: string | null): string | null => {
    if (!start || !end) return null;
    const [startH, startM] = start.split(":").map(Number);
    const [endH, endM] = end.split(":").map(Number);
    let totalMinutes = endH * 60 + endM - (startH * 60 + startM);
    if (totalMinutes < 0) totalMinutes += 24 * 60;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) return `${minutes}min`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h${minutes.toString().padStart(2, "0")}`;
  };

  const travelDuration = calculateDuration(travelDepartureTime, arrivalTime);
  const interventionDuration = calculateDuration(arrivalTime, departureTime);
  const returnDuration = calculateDuration(departureTime, travelReturnTime);

  const steps = [
    {
      id: "travel-start",
      label: "Départ domicile",
      icon: Car,
      time: travelDepartureTime,
      color: "bg-blue-500",
      lightColor: "bg-blue-100 text-blue-700",
    },
    {
      id: "arrival",
      label: "Arrivée client",
      icon: MapPin,
      time: arrivalTime,
      color: "bg-green-500",
      lightColor: "bg-green-100 text-green-700",
    },
    {
      id: "departure",
      label: "Départ client",
      icon: LogOut,
      time: departureTime,
      color: "bg-orange-500",
      lightColor: "bg-orange-100 text-orange-700",
    },
    {
      id: "travel-end",
      label: "Retour domicile",
      icon: Home,
      time: travelReturnTime,
      color: "bg-purple-500",
      lightColor: "bg-purple-100 text-purple-700",
    },
  ];

  // Check if any time data exists
  const hasAnyData = steps.some(s => s.time);
  if (!hasAnyData) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Chronométrage
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Visual timeline */}
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-5 top-6 bottom-6 w-0.5 bg-muted" />
          
          {/* Steps */}
          <div className="space-y-1">
            {steps.map((step, index) => {
              const StepIcon = step.icon;
              const isRecorded = !!step.time;

              return (
                <div key={step.id}>
                  {/* Step row */}
                  <div className="flex items-center gap-3 py-2">
                    {/* Icon circle */}
                    <div
                      className={cn(
                        "relative z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all",
                        isRecorded
                          ? `${step.color} text-white`
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      <StepIcon className="h-4 w-4" />
                    </div>

                    {/* Label and time */}
                    <div className="flex-1 flex items-center justify-between">
                      <span className={cn(
                        "text-sm",
                        !isRecorded && "text-muted-foreground"
                      )}>
                        {step.label}
                      </span>
                      {isRecorded && (
                        <span className="font-bold text-lg">{step.time}</span>
                      )}
                    </div>
                  </div>

                  {/* Duration indicator between steps */}
                  {index === 0 && travelDuration && (
                    <div className="ml-12 py-1">
                      <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">
                        Trajet aller: {travelDuration}
                      </span>
                    </div>
                  )}
                  {index === 1 && interventionDuration && (
                    <div className="ml-12 py-1">
                      <span className="text-xs px-2 py-0.5 bg-green-50 text-green-600 rounded-full font-medium">
                        Durée intervention: {interventionDuration}
                      </span>
                    </div>
                  )}
                  {index === 2 && returnDuration && (
                    <div className="ml-12 py-1">
                      <span className="text-xs px-2 py-0.5 bg-purple-50 text-purple-600 rounded-full">
                        Trajet retour: {returnDuration}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary row */}
        {interventionDuration && (
          <div className="pt-3 border-t flex flex-wrap gap-4 text-sm">
            {travelDuration && (
              <div className="flex items-center gap-2">
                <Car className="h-4 w-4 text-blue-500" />
                <span className="text-muted-foreground">Aller:</span>
                <span className="font-medium">{travelDuration}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-green-500" />
              <span className="text-muted-foreground">Intervention:</span>
              <span className="font-bold text-primary">{interventionDuration}</span>
            </div>
            {returnDuration && (
              <div className="flex items-center gap-2">
                <Home className="h-4 w-4 text-purple-500" />
                <span className="text-muted-foreground">Retour:</span>
                <span className="font-medium">{returnDuration}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TimelineDisplay;
