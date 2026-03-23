import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Tag, Pencil, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  useInterventionTypes,
  useCreateInterventionType,
  useUpdateInterventionType,
  useDeleteInterventionType,
  InterventionType,
} from "@/hooks/useInterventionTypes";
import { useWorkflowStepsByType, useCreateWorkflowStep } from "@/hooks/useWorkflowSteps";

const COLORS = [
  { value: "red", label: "Rouge", class: "bg-red-500" },
  { value: "blue", label: "Bleu", class: "bg-blue-500" },
  { value: "green", label: "Vert", class: "bg-green-500" },
  { value: "yellow", label: "Jaune", class: "bg-yellow-500" },
  { value: "purple", label: "Violet", class: "bg-purple-500" },
  { value: "orange", label: "Orange", class: "bg-orange-500" },
  { value: "pink", label: "Rose", class: "bg-pink-500" },
  { value: "gray", label: "Gris", class: "bg-gray-500" },
];

const getColorClass = (color: string) => {
  const found = COLORS.find((c) => c.value === color);
  return found ? found.class : "bg-gray-500";
};

export default function InterventionTypesSettings() {
  const { data: types = [], isLoading } = useInterventionTypes();
  const { data: stepsByType = {} } = useWorkflowStepsByType();
  const createType = useCreateInterventionType();
  const updateType = useUpdateInterventionType();
  const deleteType = useDeleteInterventionType();
  const createStep = useCreateWorkflowStep();

  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("blue");
  const [trackJourney, setTrackJourney] = useState(true);
  const [allowLoop, setAllowLoop] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<InterventionType | null>(null);

  const resetForm = () => {
    setName("");
    setLabel("");
    setColor("blue");
    setTrackJourney(true);
    setAllowLoop(false);
    setEditingType(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (type: InterventionType) => {
    setEditingType(type);
    setName(type.name);
    setLabel(type.label);
    setColor(type.color);
    setTrackJourney(type.track_journey);
    setAllowLoop(type.allow_loop);
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!label.trim()) return;

    const finalName = name.trim() || label.toLowerCase().replace(/\s+/g, "_");

    if (editingType) {
      await updateType.mutateAsync({
        id: editingType.id,
        name: finalName,
        label: label.trim(),
        color,
        track_journey: trackJourney,
        allow_loop: allowLoop,
      });
    } else {
      await createType.mutateAsync({
        name: finalName,
        label: label.trim(),
        color,
        track_journey: trackJourney,
        allow_loop: allowLoop,
      });
    }

    resetForm();
    setDialogOpen(false);
  };

  const handleDuplicate = async (type: InterventionType) => {
    const newType = await createType.mutateAsync({
      name: type.name + "_copie",
      label: type.label + " (copie)",
      color: type.color,
      track_journey: type.track_journey,
      allow_loop: type.allow_loop,
    });

    // Duplicate workflow steps
    const steps = stepsByType[type.id] || [];
    for (const step of steps) {
      await createStep.mutateAsync({
        intervention_type_id: newType.id,
        name: step.name,
        label: step.label,
        description: step.description || undefined,
        is_mandatory: step.is_mandatory,
        step_order: step.step_order,
        requires_photo: step.requires_photo,
        requires_comment: step.requires_comment,
        requires_signature: step.requires_signature,
      });
    }
  };

  const handleDelete = async (id: string) => {
    await deleteType.mutateAsync(id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Types d'intervention
          </CardTitle>
          <CardDescription>
            Créez, modifiez ou supprimez les types d'intervention. Chaque type peut avoir ses propres étapes de workflow.
          </CardDescription>
        </div>

        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Ajouter
        </Button>
      </CardHeader>
      <CardContent>
        {types.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Aucun type d'intervention configuré. Créez-en un pour commencer.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Libellé</TableHead>
                <TableHead>Identifiant</TableHead>
                <TableHead>Couleur</TableHead>
                <TableHead>Étapes</TableHead>
                <TableHead className="w-[140px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {types.map((type) => {
                const stepsCount = (stepsByType[type.id] || []).length;
                return (
                  <TableRow key={type.id}>
                    <TableCell className="font-medium">{type.label}</TableCell>
                    <TableCell>
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        {type.name}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${getColorClass(type.color)} text-white`}>
                        {type.color}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {stepsCount} étape{stepsCount !== 1 ? "s" : ""}
                      </span>
                    </TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <div className="flex items-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => openEditDialog(type)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Modifier</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDuplicate(type)}
                                disabled={createType.isPending}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Dupliquer avec ses étapes</TooltipContent>
                          </Tooltip>

                          <AlertDialog>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </AlertDialogTrigger>
                              </TooltipTrigger>
                              <TooltipContent>Supprimer</TooltipContent>
                            </Tooltip>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Supprimer « {type.label} » ?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Cette action est irréversible. Les interventions
                                  existantes de ce type ne seront pas affectées, mais
                                  le type et ses étapes ne seront plus disponibles.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(type.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Supprimer
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingType ? "Modifier le type d'intervention" : "Nouveau type d'intervention"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="label">Libellé *</Label>
              <Input
                id="label"
                placeholder="Ex: Dépannage urgent"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Identifiant technique</Label>
              <Input
                id="name"
                placeholder="Ex: depannage_urgent"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Laissez vide pour générer automatiquement
              </p>
            </div>
            <div className="space-y-2">
              <Label>Couleur</Label>
              <Select value={color} onValueChange={setColor}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLORS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${c.class}`} />
                        {c.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Suivi de trajet</Label>
                <p className="text-xs text-muted-foreground">
                  Activer le suivi des temps de trajet pour ce type
                </p>
              </div>
              <Switch checked={trackJourney} onCheckedChange={setTrackJourney} />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Activer la boucle </Label>
                <p className="text-xs text-muted-foreground">
                  Permettre au technicien de répéter les étapes pour plusieurs équipements
                </p>
              </div>
              <Switch checked={allowLoop} onCheckedChange={setAllowLoop} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Annuler</Button>
            </DialogClose>
            <Button
              onClick={handleSubmit}
              disabled={!label.trim() || createType.isPending || updateType.isPending}
            >
              {createType.isPending || updateType.isPending
                ? "Enregistrement..."
                : editingType
                ? "Mettre à jour"
                : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
