import { useState } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown, Camera, MessageSquare, PenTool, ChevronDown, ChevronRight, ListChecks, Settings2, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  useWorkflowStepsByType,
  useCreateWorkflowStep,
  useUpdateWorkflowStep,
  useDeleteWorkflowStep,
  useReorderWorkflowSteps,
  WorkflowStep,
} from "@/hooks/useWorkflowSteps";
import { useInterventionTypes } from "@/hooks/useInterventionTypes";

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
  const createStep = useCreateWorkflowStep();
  const updateStep = useUpdateWorkflowStep();
  const deleteStep = useDeleteWorkflowStep();
  const reorderSteps = useReorderWorkflowSteps();

  const [openTypes, setOpenTypes] = useState<Record<string, boolean>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [editingStep, setEditingStep] = useState<WorkflowStep | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [isMandatory, setIsMandatory] = useState(false);
  const [requiresPhoto, setRequiresPhoto] = useState(false);
  const [requiresComment, setRequiresComment] = useState(false);
  const [requiresSignature, setRequiresSignature] = useState(false);
  const [checklistItems, setChecklistItems] = useState<{ id: string; label: string }[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState("");

  const resetForm = () => {
    setName("");
    setLabel("");
    setDescription("");
    setIsMandatory(false);
    setRequiresPhoto(false);
    setRequiresComment(false);
    setRequiresSignature(false);
    setChecklistItems([]);
    setNewChecklistItem("");
    setEditingStep(null);
  };

  const openAddDialog = (typeId: string) => {
    setSelectedTypeId(typeId);
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (step: WorkflowStep) => {
    setEditingStep(step);
    setSelectedTypeId(step.intervention_type_id);
    setName(step.name);
    setLabel(step.label);
    setDescription(step.description || "");
    setIsMandatory(step.is_mandatory);
    setRequiresPhoto(step.requires_photo);
    setRequiresComment(step.requires_comment);
    setRequiresSignature(step.requires_signature);
    setChecklistItems(step.checklist_items || []);
    setNewChecklistItem("");
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!label.trim() || !selectedTypeId) return;

    const stepName = name.trim() || label.toLowerCase().replace(/\s+/g, "_");
    const existingSteps = stepsByType[selectedTypeId] || [];
    const nextOrder = existingSteps.length;

    if (editingStep) {
      await updateStep.mutateAsync({
        id: editingStep.id,
        name: stepName,
        label: label.trim(),
        description: description.trim() || undefined,
        is_mandatory: isMandatory,
        requires_photo: requiresPhoto,
        requires_comment: requiresComment,
        requires_signature: requiresSignature,
      });
    } else {
      await createStep.mutateAsync({
        intervention_type_id: selectedTypeId,
        name: stepName,
        label: label.trim(),
        description: description.trim() || undefined,
        is_mandatory: isMandatory,
        step_order: nextOrder,
        requires_photo: requiresPhoto,
        requires_comment: requiresComment,
        requires_signature: requiresSignature,
      });
    }

    setDialogOpen(false);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    await deleteStep.mutateAsync(id);
  };

  const handleMoveStep = async (typeId: string, stepIndex: number, direction: "up" | "down") => {
    const steps = [...(stepsByType[typeId] || [])];
    const targetIndex = direction === "up" ? stepIndex - 1 : stepIndex + 1;
    if (targetIndex < 0 || targetIndex >= steps.length) return;

    // Swap
    const temp = steps[stepIndex];
    steps[stepIndex] = steps[targetIndex];
    steps[targetIndex] = temp;

    await reorderSteps.mutateAsync(
      steps.map((s, i) => ({ id: s.id, step_order: i }))
    );
  };

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
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            openAddDialog(type.id);
                          }}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Ajouter
                        </Button>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="border-t bg-muted/20 p-4">
                        {steps.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            Aucune étape configurée pour ce type d'intervention
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {steps.map((step, index) => (
                              <div
                                key={step.id}
                                className="flex items-center gap-3 p-3 bg-background rounded-md border"
                              >
                                <div className="flex flex-col gap-0.5">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    disabled={index === 0 || reorderSteps.isPending}
                                    onClick={() => handleMoveStep(type.id, index, "up")}
                                  >
                                    <ArrowUp className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    disabled={index === steps.length - 1 || reorderSteps.isPending}
                                    onClick={() => handleMoveStep(type.id, index, "down")}
                                  >
                                    <ArrowDown className="h-3 w-3" />
                                  </Button>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm">
                                      {index + 1}. {step.label}
                                    </span>
                                    {step.is_mandatory && (
                                      <Badge variant="destructive" className="text-xs">
                                        Obligatoire
                                      </Badge>
                                    )}
                                  </div>
                                  {step.description && (
                                    <p className="text-xs text-muted-foreground mt-1 truncate">
                                      {step.description}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-3 mt-2">
                                    {step.requires_photo && (
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Camera className="h-3 w-3" />
                                        Photo
                                      </div>
                                    )}
                                    {step.requires_comment && (
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <MessageSquare className="h-3 w-3" />
                                        Commentaire
                                      </div>
                                    )}
                                    {step.requires_signature && (
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <PenTool className="h-3 w-3" />
                                        Signature
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => openEditDialog(step)}
                                  >
                                    <Settings2 className="h-4 w-4" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Supprimer cette étape ?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Cette action est irréversible. L'étape sera supprimée
                                          de la configuration du workflow.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleDelete(step.id)}
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                          Supprimer
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        )}

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingStep ? "Modifier l'étape" : "Nouvelle étape"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="stepLabel">Libellé de l'étape *</Label>
                <Input
                  id="stepLabel"
                  placeholder="Ex: Vérification du matériel"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stepName">Identifiant technique</Label>
                <Input
                  id="stepName"
                  placeholder="Ex: verification_materiel"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Laissez vide pour générer automatiquement
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="stepDescription">Description</Label>
                <Textarea
                  id="stepDescription"
                  placeholder="Instructions pour le technicien..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="space-y-4 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="mandatory">Étape obligatoire</Label>
                    <p className="text-xs text-muted-foreground">
                      Le technicien devra valider cette étape
                    </p>
                  </div>
                  <Switch
                    id="mandatory"
                    checked={isMandatory}
                    onCheckedChange={setIsMandatory}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Camera className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="requiresPhoto">Photo requise</Label>
                  </div>
                  <Switch
                    id="requiresPhoto"
                    checked={requiresPhoto}
                    onCheckedChange={setRequiresPhoto}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="requiresComment">Commentaire requis</Label>
                  </div>
                  <Switch
                    id="requiresComment"
                    checked={requiresComment}
                    onCheckedChange={setRequiresComment}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PenTool className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="requiresSignature">Signature requise</Label>
                  </div>
                  <Switch
                    id="requiresSignature"
                    checked={requiresSignature}
                    onCheckedChange={setRequiresSignature}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Annuler</Button>
              </DialogClose>
              <Button
                onClick={handleSubmit}
                disabled={!label.trim() || createStep.isPending || updateStep.isPending}
              >
                {createStep.isPending || updateStep.isPending
                  ? "Enregistrement..."
                  : editingStep
                  ? "Mettre à jour"
                  : "Créer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
