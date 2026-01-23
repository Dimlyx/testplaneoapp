import { useState } from "react";
import { Car, MapPin, LogOut, Home, Clock, ChevronDown, ChevronUp, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface TimelineStep {
  id: string;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  time: string;
  onRecord: () => Promise<void>;
  onTimeChange: (value: string) => void;
  color: string;
  activeColor: string;
}

interface TimelineTrackerProps {
  travelDepartureTime: string;
  arrivalTime: string;
  departureTime: string;
  travelReturnTime: string;
  onStartTravel: () => Promise<void>;
  onStartIntervention: () => Promise<void>;
  onEndIntervention: () => Promise<void>;
  onEndTravel: () => Promise<void>;
  onTravelDepartureTimeChange: (value: string) => void;
  onArrivalTimeChange: (value: string) => void;
  onDepartureTimeChange: (value: string) => void;
  onTravelReturnTimeChange: (value: string) => void;
  isLocked: boolean;
  isCompleted: boolean;
}

const TimelineTracker = ({
  travelDepartureTime,
  arrivalTime,
  departureTime,
  travelReturnTime,
  onStartTravel,
  onStartIntervention,
  onEndIntervention,
  onEndTravel,
  onTravelDepartureTimeChange,
  onArrivalTimeChange,
  onDepartureTimeChange,
  onTravelReturnTimeChange,
  isLocked,
  isCompleted,
}: TimelineTrackerProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingStep, setEditingStep] = useState<string | null>(null);

  const steps: TimelineStep[] = [
    {
      id: "travel-start",
      label: "Départ domicile",
      shortLabel: "Départ",
      icon: Car,
      time: travelDepartureTime,
      onRecord: onStartTravel,
      onTimeChange: onTravelDepartureTimeChange,
      color: "bg-blue-100 text-blue-700 border-blue-300",
      activeColor: "bg-blue-500",
    },
    {
      id: "arrival",
      label: "Arrivée client",
      shortLabel: "Arrivée",
      icon: MapPin,
      time: arrivalTime,
      onRecord: onStartIntervention,
      onTimeChange: onArrivalTimeChange,
      color: "bg-green-100 text-green-700 border-green-300",
      activeColor: "bg-green-500",
    },
    {
      id: "departure",
      label: "Départ client",
      shortLabel: "Départ",
      icon: LogOut,
      time: departureTime,
      onRecord: onEndIntervention,
      onTimeChange: onDepartureTimeChange,
      color: "bg-orange-100 text-orange-700 border-orange-300",
      activeColor: "bg-orange-500",
    },
    {
      id: "travel-end",
      label: "Retour domicile",
      shortLabel: "Retour",
      icon: Home,
      time: travelReturnTime,
      onRecord: onEndTravel,
      onTimeChange: onTravelReturnTimeChange,
      color: "bg-purple-100 text-purple-700 border-purple-300",
      activeColor: "bg-purple-500",
    },
  ];

  // Find the next step to record
  const getNextStepIndex = () => {
    for (let i = 0; i < steps.length; i++) {
      if (!steps[i].time) return i;
    }
    return -1;
  };

  const nextStepIndex = getNextStepIndex();

  // Calculate durations
  const calculateDuration = (start: string, end: string): string | null => {
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

  const handleStepClick = async (step: TimelineStep, index: number) => {
    if (isLocked && step.time) return;
    
    if (!step.time && index === nextStepIndex) {
      await step.onRecord();
    } else if (step.time && !isLocked) {
      setEditingStep(editingStep === step.id ? null : step.id);
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Compact header with current status */}
        <div 
          className="p-4 bg-gradient-to-r from-primary/5 to-primary/10 cursor-pointer flex items-center justify-between"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-primary" />
            <span className="font-medium">Chronométrage</span>
          </div>
          
          {/* Quick status indicators */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1">
              {steps.map((step, i) => (
                <div
                  key={step.id}
                  className={cn(
                    "w-3 h-3 rounded-full transition-all",
                    step.time ? step.activeColor : "bg-muted"
                  )}
                  title={step.time ? `${step.label}: ${step.time}` : step.label}
                />
              ))}
            </div>
            {interventionDuration && (
              <span className="text-sm font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">
                {interventionDuration}
              </span>
            )}
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>

        {/* Expanded timeline */}
        {isExpanded && (
          <div className="p-4 space-y-4">
            {/* Visual timeline */}
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-muted" />
              
              {/* Steps */}
              <div className="space-y-0">
                {steps.map((step, index) => {
                  const StepIcon = step.icon;
                  const isRecorded = !!step.time;
                  const isNext = index === nextStepIndex;
                  const canEdit = isRecorded && !isLocked;
                  const isEditing = editingStep === step.id;

                  return (
                    <div key={step.id} className="relative">
                      {/* Step row */}
                      <div 
                        className={cn(
                          "flex items-center gap-3 py-3 px-2 rounded-lg transition-all cursor-pointer",
                          isNext && "bg-primary/5",
                          isRecorded && !isNext && "hover:bg-muted/50"
                        )}
                        onClick={() => handleStepClick(step, index)}
                      >
                        {/* Icon circle */}
                        <div
                          className={cn(
                            "relative z-10 w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all",
                            isRecorded
                              ? `${step.activeColor} text-white border-transparent`
                              : isNext
                              ? "bg-white border-primary text-primary animate-pulse"
                              : "bg-muted border-muted-foreground/20 text-muted-foreground"
                          )}
                        >
                          <StepIcon className="h-5 w-5" />
                        </div>

                        {/* Label and time */}
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "font-medium truncate",
                            !isRecorded && !isNext && "text-muted-foreground"
                          )}>
                            {step.label}
                          </p>
                          {isRecorded && (
                            <p className="text-lg font-bold text-primary">{step.time}</p>
                          )}
                          {isNext && !isRecorded && (
                            <p className="text-sm text-muted-foreground">Appuyez pour enregistrer</p>
                          )}
                        </div>

                        {/* Action button or edit icon */}
                        {isNext && !isRecorded && !isLocked && (
                          <Button 
                            size="sm" 
                            className="shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              step.onRecord();
                            }}
                          >
                            Enregistrer
                          </Button>
                        )}
                        {canEdit && (
                          <Pencil className={cn(
                            "h-4 w-4 shrink-0 transition-colors",
                            isEditing ? "text-primary" : "text-muted-foreground"
                          )} />
                        )}
                      </div>

                      {/* Edit time input */}
                      {isEditing && canEdit && (
                        <div className="ml-16 mb-2 flex items-center gap-2">
                          <Input
                            type="time"
                            value={step.time}
                            onChange={(e) => step.onTimeChange(e.target.value)}
                            className="w-32"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingStep(null);
                            }}
                          >
                            OK
                          </Button>
                        </div>
                      )}

                      {/* Duration indicator between steps */}
                      {index === 0 && travelDuration && (
                        <div className="ml-16 py-1">
                          <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">
                            Trajet: {travelDuration}
                          </span>
                        </div>
                      )}
                      {index === 1 && interventionDuration && (
                        <div className="ml-16 py-1">
                          <span className="text-xs px-2 py-0.5 bg-green-50 text-green-600 rounded-full font-medium">
                            Intervention: {interventionDuration}
                          </span>
                        </div>
                      )}
                      {index === 2 && returnDuration && (
                        <div className="ml-16 py-1">
                          <span className="text-xs px-2 py-0.5 bg-purple-50 text-purple-600 rounded-full">
                            Retour: {returnDuration}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Summary */}
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
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TimelineTracker;
