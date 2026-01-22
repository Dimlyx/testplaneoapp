import { useState } from "react";
import { Plus, Trash2, Tag } from "lucide-react";
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
  DialogTrigger,
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
import {
  useInterventionTypes,
  useCreateInterventionType,
  useDeleteInterventionType,
} from "@/hooks/useInterventionTypes";

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
  const createType = useCreateInterventionType();
  const deleteType = useDeleteInterventionType();

  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("blue");
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || !label.trim()) return;

    await createType.mutateAsync({
      name: name.toLowerCase().replace(/\s+/g, "_"),
      label: label.trim(),
      color,
    });

    setName("");
    setLabel("");
    setColor("blue");
    setDialogOpen(false);
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
            Gérez les différents types d'intervention disponibles
          </CardDescription>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouveau type d'intervention</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="label">Libellé</Label>
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
                  Utilisé en interne, sans espaces ni caractères spéciaux
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
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Annuler</Button>
              </DialogClose>
              <Button
                onClick={handleCreate}
                disabled={!name.trim() || !label.trim() || createType.isPending}
              >
                {createType.isPending ? "Création..." : "Créer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {types.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Aucun type d'intervention configuré
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Libellé</TableHead>
                <TableHead>Identifiant</TableHead>
                <TableHead>Couleur</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {types.map((type) => (
                <TableRow key={type.id}>
                  <TableCell className="font-medium">{type.label}</TableCell>
                  <TableCell>
                    <code className="text-sm bg-muted px-2 py-1 rounded">
                      {type.name}
                    </code>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={`${getColorClass(type.color)} text-white`}
                    >
                      {type.color}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Supprimer ce type ?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Cette action est irréversible. Les interventions
                            existantes de ce type ne seront pas affectées mais
                            le type ne sera plus disponible pour les nouvelles
                            interventions.
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
