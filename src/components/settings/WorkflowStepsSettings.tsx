import { useState } from "react";
import { ListChecks, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  const [openTypes, setOpenTypes] = useState<Record<string, boolean>>({});

  const toggleType = (typeId: string) => {
    setOpenTypes((prev) => ({ ...prev, [typeId]: !prev[typeId] }));
  };

  if (loadingTypes || loadingSteps) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListChecks className="h-5 w-5" />
          Étapes du workflow
        </CardTitle>
        <CardDescription>
          Configurez les étapes personnalisées pour chaque type d'intervention.
          Les techniciens devront compléter ces étapes lors de leurs interventions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {types.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Créez d'abord des types d'intervention dans l'onglet "Types"
          </div>
        ) : (
          <div className="space-y-3">
            {types.map((type) => {
              const steps = stepsByType[type.id] || [];
              const isOpen = openTypes[type.id] ?? false;
              const colorClass = COLORS[type.color] || "bg-gray-500";

              return (
                <Collapsible key={type.id} open={isOpen} onOpenChange={() => toggleType(type.id)}>
                  <div className="border rounded-lg overflow-hidden">
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <Badge className={`${colorClass} text-white`}>
                            {type.label}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {steps.length} étape{steps.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="border-t bg-muted/20 p-4">
                        <WorkflowSchemaBuilder
                          typeId={type.id}
                          steps={steps}
                          allowLoop={type.allow_loop}
                        />
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
