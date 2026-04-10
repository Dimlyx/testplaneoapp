import { ArrowLeft, CheckCircle, ClipboardList, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import DynamicStepContent from "./DynamicStepContent";
import { useState } from "react";

interface EquipmentDetailPanelProps {
  loopIdx: number;
  loopableSteps: any[];
  stepCompletions: any[];
  interventionId: string;
  loopTriggerStepId?: string;
  allowLoop?: boolean;
  isLocked: boolean;
  isCompleting: boolean;
  skippedStepIds: Set<string>;
  onComplete: (stepId: string, comment?: string, photoUrl?: string, checklistData?: any, multipleChoiceData?: any, loopIndex?: number) => Promise<void>;
  onClose: () => void;
}

const EquipmentDetailPanel = ({
  loopIdx,
  loopableSteps,
  stepCompletions,
  interventionId,
  loopTriggerStepId,
  allowLoop,
  isLocked,
  isCompleting,
  skippedStepIds,
  onComplete,
  onClose,
}: EquipmentDetailPanelProps) => {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 bg-background animate-slide-in-right flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-background sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-500" />
          <h2 className="font-semibold text-lg">Équipement {loopIdx + 1}</h2>
        </div>
      </div>

      {/* Steps list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loopableSteps.map((step) => {
          if (skippedStepIds.has(step.id)) return null;
          
          const completion = stepCompletions.find(
            (c: any) => c.step_id === step.id && (c.loop_index ?? 0) === loopIdx
          );
          const isStepCompleted = !!completion?.completed_at;
          const isMainLoopTrigger = step.id === loopTriggerStepId && allowLoop;
          const isConditionalBranch = step.is_loop_trigger && !isMainLoopTrigger && allowLoop;
          const stepKey = `panel-${step.id}-${loopIdx}`;
          const isExpanded = expandedStep === stepKey;

          return (
            <Card
              key={stepKey}
              className={`transition-all ${isExpanded ? 'ring-2 ring-primary/30' : ''}`}
            >
              <button
                type="button"
                className="w-full text-left p-4 flex items-center gap-3"
                onClick={() => setExpandedStep(isExpanded ? null : stepKey)}
              >
                <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                  isStepCompleted
                    ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {isStepCompleted ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : isMainLoopTrigger || isConditionalBranch ? (
                    <RefreshCw className="h-4 w-4" />
                  ) : (
                    <ClipboardList className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{step.label}</p>
                  {isStepCompleted && completion?.comment && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {completion.comment}
                    </p>
                  )}
                </div>
                <CheckCircle className={`h-5 w-5 shrink-0 ${isStepCompleted ? 'text-green-500' : 'text-muted-foreground/30'}`} />
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 border-t pt-3">
                  {(isMainLoopTrigger || isConditionalBranch) ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950 p-3 rounded-lg">
                        <CheckCircle className="h-5 w-5" />
                        <span className="font-medium text-sm">
                          {completion?.comment || "Étape validée"}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <DynamicStepContent
                      step={step}
                      interventionId={interventionId}
                      completion={completion}
                      onComplete={(stepId, comment, photoUrl, checklistData, multipleChoiceData) =>
                        onComplete(stepId, comment, photoUrl, checklistData, multipleChoiceData, loopIdx)
                      }
                      isLocked={isLocked}
                      isCompleting={isCompleting}
                      loopIndex={loopIdx}
                    />
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default EquipmentDetailPanel;
