import { useState } from "react";
import {
  Camera, MessageSquare, PenTool, ClipboardList, List, RefreshCw,
  Trash2, Plus, GripVertical, ChevronRight, X
} from "lucide-react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  useCreateWorkflowStep, useUpdateWorkflowStep, useDeleteWorkflowStep, useReorderWorkflowSteps,
  WorkflowStep,
} from "@/hooks/useWorkflowSteps";

// Step type palette items
interface StepPreset {
  requires_photo?: boolean;
  requires_comment?: boolean;
  requires_signature?: boolean;
  is_loop_trigger?: boolean;
  hasChecklist?: boolean;
  hasMultipleChoice?: boolean;
}

const STEP_PALETTE: { icon: typeof Camera; label: string; preset: StepPreset }[] = [
  { icon: Camera, label: "Photo", preset: { requires_photo: true } },
  { icon: PenTool, label: "Signature", preset: { requires_signature: true } },
  { icon: MessageSquare, label: "Commentaire", preset: { requires_comment: true } },
  { icon: ClipboardList, label: "Checklist", preset: { hasChecklist: true } },
  { icon: List, label: "Choix multiple", preset: { hasMultipleChoice: true } },
  { icon: RefreshCw, label: "Début boucle", preset: { is_loop_trigger: true } },
];

function getStepIcon(step: WorkflowStep) {
  if ((step as any).is_loop_trigger) return RefreshCw;
  if (step.requires_signature) return PenTool;
  if (step.requires_photo) return Camera;
  if (step.requires_comment) return MessageSquare;
  if (step.checklist_items && step.checklist_items.length > 0) return ClipboardList;
  if (step.multiple_choice_items && step.multiple_choice_items.length > 0) return List;
  return ChevronRight;
}

// Sortable step node in the flowchart
function SortableFlowNode({
  step, isSelected, isLast, onSelect, onDelete,
}: {
  step: WorkflowStep; isSelected: boolean; isLast: boolean;
  onSelect: () => void; onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const Icon = getStepIcon(step);
  const isLoopTrigger = (step as any).is_loop_trigger;

  return (
    <div ref={setNodeRef} style={style} className="flex flex-col items-center relative group">
      {/* Node */}
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 cursor-pointer transition-all w-full max-w-xs
          ${isSelected
            ? "border-primary bg-primary/5 shadow-md"
            : isLoopTrigger
              ? "border-primary/50 bg-primary/5 hover:border-primary hover:shadow-sm"
              : "border-border bg-background hover:border-primary/50 hover:shadow-sm"
          }`}
        onClick={onSelect}
      >
        <button
          type="button"
          className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground shrink-0"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0
          ${isLoopTrigger ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
          <Icon className="h-4 w-4" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{step.label}</p>
          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
            {step.is_mandatory && (
              <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">Obligatoire</Badge>
            )}
            {isLoopTrigger && (
              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-primary text-primary">Boucle</Badge>
            )}
          </div>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost" size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer cette étape ?</AlertDialogTitle>
              <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Connecting line */}
      {!isLast && (
        <div className="w-0.5 h-6 bg-border" />
      )}
    </div>
  );
}

interface WorkflowSchemaBuilderProps {
  typeId: string;
  steps: WorkflowStep[];
  allowLoop: boolean;
}

export default function WorkflowSchemaBuilder({ typeId, steps, allowLoop }: WorkflowSchemaBuilderProps) {
  const createStep = useCreateWorkflowStep();
  const updateStep = useUpdateWorkflowStep();
  const deleteStep = useDeleteWorkflowStep();
  const reorderSteps = useReorderWorkflowSteps();

  const [selectedStep, setSelectedStep] = useState<WorkflowStep | null>(null);

  // Edit form state
  const [editLabel, setEditLabel] = useState("");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editMandatory, setEditMandatory] = useState(false);
  const [editPhoto, setEditPhoto] = useState(false);
  const [editComment, setEditComment] = useState(false);
  const [editSignature, setEditSignature] = useState(false);
  const [editLoopTrigger, setEditLoopTrigger] = useState(false);
  const [editHasChecklist, setEditHasChecklist] = useState(false);
  const [editChecklistItems, setEditChecklistItems] = useState<{ id: string; label: string }[]>([]);
  const [editHasMultipleChoice, setEditHasMultipleChoice] = useState(false);
  const [editMultipleChoiceItems, setEditMultipleChoiceItems] = useState<{ id: string; label: string }[]>([]);

  // Sub-sheets
  const [checklistSheetOpen, setChecklistSheetOpen] = useState(false);
  const [multipleChoiceSheetOpen, setMultipleChoiceSheetOpen] = useState(false);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [newMultipleChoiceItem, setNewMultipleChoiceItem] = useState("");

  const selectStep = (step: WorkflowStep) => {
    setSelectedStep(step);
    setEditLabel(step.label);
    setEditName(step.name);
    setEditDescription(step.description || "");
    setEditMandatory(step.is_mandatory);
    setEditPhoto(step.requires_photo);
    setEditComment(step.requires_comment);
    setEditSignature(step.requires_signature);
    setEditLoopTrigger((step as any).is_loop_trigger || false);
    setEditHasChecklist((step.checklist_items || []).length > 0);
    setEditChecklistItems(step.checklist_items || []);
    setEditHasMultipleChoice((step.multiple_choice_items || []).length > 0);
    setEditMultipleChoiceItems(step.multiple_choice_items || []);
  };

  const handleAddFromPalette = async (paletteItem: typeof STEP_PALETTE[number]) => {
    const stepLabel = paletteItem.label;
    const stepName = stepLabel.toLowerCase().replace(/\s+/g, "_");
    const nextOrder = steps.length;

    await createStep.mutateAsync({
      intervention_type_id: typeId,
      name: stepName,
      label: stepLabel,
      step_order: nextOrder,
      is_mandatory: false,
      requires_photo: paletteItem.preset.requires_photo || false,
      requires_comment: paletteItem.preset.requires_comment || false,
      requires_signature: paletteItem.preset.requires_signature || false,
      is_loop_trigger: paletteItem.preset.is_loop_trigger || false,
      checklist_items: [],
      multiple_choice_items: [],
    } as any);
  };

  const handleSaveStep = async () => {
    if (!selectedStep || !editLabel.trim()) return;
    await updateStep.mutateAsync({
      id: selectedStep.id,
      name: editName.trim() || editLabel.toLowerCase().replace(/\s+/g, "_"),
      label: editLabel.trim(),
      description: editDescription.trim() || undefined,
      is_mandatory: editMandatory,
      requires_photo: editPhoto,
      requires_comment: editComment,
      requires_signature: editSignature,
      is_loop_trigger: editLoopTrigger,
      checklist_items: editHasChecklist ? editChecklistItems : [],
      multiple_choice_items: editHasMultipleChoice ? editMultipleChoiceItems : [],
    } as any);
    setSelectedStep(null);
  };

  const handleDeleteStep = async (id: string) => {
    if (selectedStep?.id === id) setSelectedStep(null);
    await deleteStep.mutateAsync(id);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = steps.findIndex(s => s.id === active.id);
    const newIndex = steps.findIndex(s => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(steps, oldIndex, newIndex);
    await reorderSteps.mutateAsync(reordered.map((s, i) => ({ id: s.id, step_order: i })));
  };

  return (
    <div className="flex gap-4 min-h-[400px]">
      {/* Left palette */}
      <div className="w-40 shrink-0 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Ajouter une étape
        </p>
        {STEP_PALETTE.map((item) => {
          // Hide loop trigger if not allowed
          if (item.preset.is_loop_trigger && !allowLoop) return null;
          const Icon = item.icon;
          return (
            <Button
              key={item.label}
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2 text-xs h-9"
              onClick={() => handleAddFromPalette(item)}
              disabled={createStep.isPending}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {item.label}
            </Button>
          );
        })}
      </div>

      {/* Center flowchart */}
      <div className="flex-1 flex flex-col items-center py-4 overflow-auto">
        {steps.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground space-y-2">
              <p className="text-sm">Aucune étape</p>
              <p className="text-xs">Cliquez sur un type d'étape à gauche pour commencer</p>
            </div>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={handleDragEnd}>
            <SortableContext items={steps.map(s => s.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col items-center w-full">
                {/* Start indicator */}
                <div className="h-8 w-8 rounded-full bg-muted border-2 border-border flex items-center justify-center mb-1">
                  <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                </div>
                <div className="w-0.5 h-4 bg-border" />

                {steps.map((step, index) => (
                  <SortableFlowNode
                    key={step.id}
                    step={step}
                    isSelected={selectedStep?.id === step.id}
                    isLast={index === steps.length - 1}
                    onSelect={() => selectStep(step)}
                    onDelete={() => handleDeleteStep(step.id)}
                  />
                ))}

                {/* End indicator */}
                <div className="w-0.5 h-4 bg-border mt-0" />
                <div className="h-8 w-8 rounded-full bg-muted border-2 border-border flex items-center justify-center">
                  <div className="h-3 w-3 rounded-sm bg-muted-foreground" />
                </div>
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Right config panel */}
      <div className="w-72 shrink-0 border-l pl-4">
        {selectedStep ? (
          <ScrollArea className="h-[500px] pr-2">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Configuration</h3>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedStep(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Libellé *</Label>
                <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} className="h-8 text-sm" />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Identifiant technique</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 text-sm" placeholder="Auto-généré" />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Description</Label>
                <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={2} className="text-sm" placeholder="Instructions..." />
              </div>

              <div className="space-y-3 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Obligatoire</Label>
                  <Switch checked={editMandatory} onCheckedChange={setEditMandatory} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Camera className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label className="text-xs">Photo</Label>
                  </div>
                  <Switch checked={editPhoto} onCheckedChange={setEditPhoto} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label className="text-xs">Commentaire</Label>
                  </div>
                  <Switch checked={editComment} onCheckedChange={setEditComment} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <PenTool className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label className="text-xs">Signature</Label>
                  </div>
                  <Switch checked={editSignature} onCheckedChange={setEditSignature} />
                </div>

                {allowLoop && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                      <Label className="text-xs">Début boucle</Label>
                    </div>
                    <Switch checked={editLoopTrigger} onCheckedChange={setEditLoopTrigger} />
                  </div>
                )}

                {/* Checklist */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
                      <Label className="text-xs">Checklist</Label>
                    </div>
                    <Switch checked={editHasChecklist} onCheckedChange={setEditHasChecklist} />
                  </div>
                  {editHasChecklist && (
                    <Button variant="outline" size="sm" className="w-full text-xs h-7" onClick={() => setChecklistSheetOpen(true)}>
                      {editChecklistItems.length} item{editChecklistItems.length !== 1 ? "s" : ""} — Configurer
                    </Button>
                  )}
                </div>

                {/* Multiple choice */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <List className="h-3.5 w-3.5 text-muted-foreground" />
                      <Label className="text-xs">Choix multiple</Label>
                    </div>
                    <Switch checked={editHasMultipleChoice} onCheckedChange={setEditHasMultipleChoice} />
                  </div>
                  {editHasMultipleChoice && (
                    <Button variant="outline" size="sm" className="w-full text-xs h-7" onClick={() => setMultipleChoiceSheetOpen(true)}>
                      {editMultipleChoiceItems.length} option{editMultipleChoiceItems.length !== 1 ? "s" : ""} — Configurer
                    </Button>
                  )}
                </div>
              </div>

              <Button onClick={handleSaveStep} className="w-full" size="sm" disabled={!editLabel.trim() || updateStep.isPending}>
                {updateStep.isPending ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          </ScrollArea>
        ) : (
          <div className="flex items-center justify-center h-full text-center">
            <p className="text-xs text-muted-foreground">Sélectionnez une étape pour la configurer</p>
          </div>
        )}
      </div>

      {/* Checklist Sheet */}
      <Sheet open={checklistSheetOpen} onOpenChange={setChecklistSheetOpen}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" /> Checklist
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-4 py-6">
            {editChecklistItems.map((item) => (
              <div key={item.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                <span className="text-sm flex-1">{item.label}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditChecklistItems(prev => prev.filter(i => i.id !== item.id))}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
            {editChecklistItems.length === 0 && (
              <div className="text-center py-6 text-muted-foreground text-sm border-2 border-dashed rounded-lg">Aucun item</div>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="Nouvel item..."
                value={newChecklistItem}
                onChange={(e) => setNewChecklistItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newChecklistItem.trim()) {
                    e.preventDefault();
                    setEditChecklistItems(prev => [...prev, { id: crypto.randomUUID(), label: newChecklistItem.trim() }]);
                    setNewChecklistItem("");
                  }
                }}
              />
              <Button variant="outline" size="icon" disabled={!newChecklistItem.trim()} onClick={() => {
                setEditChecklistItems(prev => [...prev, { id: crypto.randomUUID(), label: newChecklistItem.trim() }]);
                setNewChecklistItem("");
              }}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <SheetFooter>
            <Button onClick={() => setChecklistSheetOpen(false)} className="w-full">
              Terminé ({editChecklistItems.length} item{editChecklistItems.length !== 1 ? "s" : ""})
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Multiple Choice Sheet */}
      <Sheet open={multipleChoiceSheetOpen} onOpenChange={setMultipleChoiceSheetOpen}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <List className="h-5 w-5" /> Choix multiple
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-4 py-6">
            {editMultipleChoiceItems.map((item) => (
              <div key={item.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                <span className="text-sm flex-1">{item.label}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditMultipleChoiceItems(prev => prev.filter(i => i.id !== item.id))}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
            {editMultipleChoiceItems.length === 0 && (
              <div className="text-center py-6 text-muted-foreground text-sm border-2 border-dashed rounded-lg">Aucune option</div>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="Nouvelle option..."
                value={newMultipleChoiceItem}
                onChange={(e) => setNewMultipleChoiceItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newMultipleChoiceItem.trim()) {
                    e.preventDefault();
                    setEditMultipleChoiceItems(prev => [...prev, { id: crypto.randomUUID(), label: newMultipleChoiceItem.trim() }]);
                    setNewMultipleChoiceItem("");
                  }
                }}
              />
              <Button variant="outline" size="icon" disabled={!newMultipleChoiceItem.trim()} onClick={() => {
                setEditMultipleChoiceItems(prev => [...prev, { id: crypto.randomUUID(), label: newMultipleChoiceItem.trim() }]);
                setNewMultipleChoiceItem("");
              }}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <SheetFooter>
            <Button onClick={() => setMultipleChoiceSheetOpen(false)} className="w-full">
              Terminé ({editMultipleChoiceItems.length} option{editMultipleChoiceItems.length !== 1 ? "s" : ""})
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
