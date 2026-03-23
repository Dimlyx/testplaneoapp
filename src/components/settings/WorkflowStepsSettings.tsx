import { useState } from "react";
import { ListChecks } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useWorkflowStepsByType } from "@/hooks/useWorkflowSteps";
import { useInterventionTypes } from "@/hooks/useInterventionTypes";
import WorkflowSchemaBuilder from "./WorkflowSchemaBuilder";

const COLORS: Record<string, string> = {
  red: "bg-red-500",
  blue: "bg-blue-500",
  green: "bg-green-500",
  yellow: "bg-yellow-500",
  purple: "bg-purple-500",
  orange: "bg-orange-500",
  pink: "bg-pink-500",
  gray: "bg-gray-500",
};

export default function WorkflowStepsSettings() {
  const { data: types = [], isLoading: loadingTypes } = useInterventionTypes();
  const { data: stepsByType = {}, isLoading: loadingSteps } = useWorkflowStepsByType();
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);

  const selectedType = types.find((t) => t.id === selectedTypeId);

  if (loadingTypes || loadingSteps) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            Étapes du workflow
          </CardTitle>
          <CardDescription>
            Cliquez sur un type d'intervention pour configurer ses étapes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {types.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Créez d'abord des types d'intervention dans l'onglet "Types"
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {types.map((type) => {
                const steps = stepsByType[type.id] || [];
                const colorClass = COLORS[type.color] || "bg-gray-500";

                return (
                  <button
                    key={type.id}
                    onClick={() => setSelectedTypeId(type.id)}
                    className="flex flex-col items-center gap-2 p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer text-center"
                  >
                    <Badge className={`${colorClass} text-white`}>
                      {type.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {steps.length} étape{steps.length !== 1 ? "s" : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedTypeId} onOpenChange={(open) => !open && setSelectedTypeId(null)}>
        <DialogContent className="max-w-[95vw] w-[95vw] max-h-[90vh] h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {selectedType && (
                <>
                  <Badge className={`${COLORS[selectedType.color] || "bg-gray-500"} text-white`}>
                    {selectedType.label}
                  </Badge>
                  <span>— Configuration des étapes</span>
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedType && (
            <WorkflowSchemaBuilder
              typeId={selectedType.id}
              steps={stepsByType[selectedType.id] || []}
              allowLoop={selectedType.allow_loop}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
