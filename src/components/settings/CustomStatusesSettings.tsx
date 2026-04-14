import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Edit2, Check, X, GripVertical, Palette } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useCustomStatuses,
  useCreateCustomStatus,
  useUpdateCustomStatus,
  useDeleteCustomStatus,
} from "@/hooks/useCustomStatuses";
import { useUserOrganization } from "@/hooks/useUserOrganization";

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#22c55e", "#06b6d4",
  "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280", "#14b8a6",
];

export default function CustomStatusesSettings() {
  const { data: statuses = [], isLoading } = useCustomStatuses();
  const { data: organizationId } = useUserOrganization();
  const createMutation = useCreateCustomStatus();
  const updateMutation = useUpdateCustomStatus();
  const deleteMutation = useDeleteCustomStatus();

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ label: "", color: "#3b82f6" });

  const baseStatuses = [
    { label: "À planifier", color: "#f59e0b" },
    { label: "Planifiée", color: "#3b82f6" },
    { label: "En cours", color: "#8b5cf6" },
    { label: "Terminée", color: "#22c55e" },
    { label: "À facturer", color: "#f97316" },
    { label: "Archivée", color: "#6b7280" },
  ];

  const handleAdd = async () => {
    if (!form.label.trim() || !organizationId) return;
    const name = form.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    await createMutation.mutateAsync({
      name,
      label: form.label.trim(),
      color: form.color,
      status_order: statuses.length,
      organization_id: organizationId,
    });
    setForm({ label: "", color: "#3b82f6" });
    setIsAdding(false);
  };

  const handleUpdate = async () => {
    if (!editingId || !form.label.trim()) return;
    await updateMutation.mutateAsync({
      id: editingId,
      label: form.label.trim(),
      color: form.color,
    });
    setEditingId(null);
    setForm({ label: "", color: "#3b82f6" });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteMutation.mutateAsync(deleteId);
    setDeleteId(null);
  };

  const startEdit = (status: { id: string; label: string; color: string }) => {
    setEditingId(status.id);
    setForm({ label: status.label, color: status.color });
    setIsAdding(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsAdding(false);
    setForm({ label: "", color: "#3b82f6" });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Statuts personnalisés</CardTitle>
        <CardDescription>
          Ajoutez des statuts supplémentaires en plus des 6 statuts de base. Ces statuts apparaîtront dans les filtres et sur les interventions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Base statuses (read-only) */}
        <div>
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Statuts de base (non modifiables)</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {baseStatuses.map((s) => (
              <span
                key={s.label}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border"
                style={{ backgroundColor: s.color + '20', color: s.color, borderColor: s.color + '40' }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                {s.label}
              </span>
            ))}
          </div>
        </div>

        {/* Custom statuses */}
        <div>
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Statuts personnalisés</Label>
          <div className="space-y-2 mt-2">
            {statuses.length === 0 && !isAdding && (
              <p className="text-sm text-muted-foreground py-3 text-center border rounded-lg border-dashed">
                Aucun statut personnalisé. Cliquez sur "Ajouter" pour en créer un.
              </p>
            )}
            {statuses.map((status) => (
              <div key={status.id} className="flex items-center gap-2 p-2 rounded-lg border bg-card">
                {editingId === status.id ? (
                  <>
                    <Input
                      value={form.label}
                      onChange={(e) => setForm(f => ({ ...f, label: e.target.value }))}
                      placeholder="Nom du statut"
                      className="h-8 text-sm flex-1"
                      onKeyDown={(e) => e.key === 'Enter' && handleUpdate()}
                    />
                    <div className="flex gap-1">
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => setForm(f => ({ ...f, color: c }))}
                          className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                          style={{
                            backgroundColor: c,
                            borderColor: form.color === c ? 'hsl(var(--foreground))' : 'transparent',
                          }}
                        />
                      ))}
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleUpdate} disabled={updateMutation.isPending}>
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border flex-1"
                      style={{ backgroundColor: status.color + '20', color: status.color, borderColor: status.color + '40' }}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: status.color }} />
                      {status.label}
                    </span>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(status)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(status.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            ))}

            {/* Add form */}
            {isAdding && (
              <div className="flex items-center gap-2 p-2 rounded-lg border border-primary/30 bg-primary/5">
                <Input
                  value={form.label}
                  onChange={(e) => setForm(f => ({ ...f, label: e.target.value }))}
                  placeholder="Nom du nouveau statut"
                  className="h-8 text-sm flex-1"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                />
                <div className="flex gap-1">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setForm(f => ({ ...f, color: c }))}
                      className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                      style={{
                        backgroundColor: c,
                        borderColor: form.color === c ? 'hsl(var(--foreground))' : 'transparent',
                      }}
                    />
                  ))}
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleAdd} disabled={createMutation.isPending || !form.label.trim()}>
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {!isAdding && !editingId && (
          <Button variant="outline" size="sm" onClick={() => { setIsAdding(true); setForm({ label: "", color: "#3b82f6" }); }}>
            <Plus className="h-4 w-4 mr-2" />
            Ajouter un statut
          </Button>
        )}

        {/* Delete confirmation */}
        <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer ce statut ?</AlertDialogTitle>
              <AlertDialogDescription>
                Les interventions utilisant ce statut perdront leur statut personnalisé. Cette action est irréversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
