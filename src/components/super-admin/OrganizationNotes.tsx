import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { format, isPast } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Phone, Mail, Users, StickyNote, MessageSquare, Pencil, Trash2, Save, X, Plus, Bell, BellOff, BellRing, AlarmClock } from 'lucide-react';

type Category = 'note' | 'appel' | 'email' | 'reunion' | 'autre';

const CATEGORIES: { value: Category; label: string; icon: any; color: string }[] = [
  { value: 'note', label: 'Note', icon: StickyNote, color: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300' },
  { value: 'appel', label: 'Appel', icon: Phone, color: 'bg-blue-500/15 text-blue-700 dark:text-blue-300' },
  { value: 'email', label: 'Email', icon: Mail, color: 'bg-purple-500/15 text-purple-700 dark:text-purple-300' },
  { value: 'reunion', label: 'Réunion', icon: Users, color: 'bg-green-500/15 text-green-700 dark:text-green-300' },
  { value: 'autre', label: 'Autre', icon: MessageSquare, color: 'bg-gray-500/15 text-gray-700 dark:text-gray-300' },
];

function getCategoryMeta(cat: string) {
  return CATEGORIES.find(c => c.value === cat) ?? CATEGORIES[0];
}

// Convert ISO -> value for <input type="datetime-local">
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Props {
  organizationId: string;
}

export default function OrganizationNotes({ organizationId }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<Category>('note');
  const [reminder, setReminder] = useState<string>('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState<Category>('note');
  const [editReminder, setEditReminder] = useState<string>('');

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['organization-notes', organizationId] });
    queryClient.invalidateQueries({ queryKey: ['super-admin-reminders'] });
  };

  const { data: notes, isLoading } = useQuery({
    queryKey: ['organization-notes', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organization_notes')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Non authentifié');
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', user.id)
        .maybeSingle();
      const { error } = await supabase.from('organization_notes').insert({
        organization_id: organizationId,
        author_id: user.id,
        author_name: profile?.full_name || profile?.email || user.email || 'Super Admin',
        content: content.trim(),
        category,
        reminder_at: reminder ? new Date(reminder).toISOString() : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setContent(''); setCategory('note'); setReminder('');
      invalidate();
      toast.success('Note ajoutée');
    },
    onError: (e: any) => toast.error(e.message || 'Erreur lors de l\'ajout'),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingId) return;
      const { error } = await supabase
        .from('organization_notes')
        .update({
          content: editContent.trim(),
          category: editCategory,
          reminder_at: editReminder ? new Date(editReminder).toISOString() : null,
        })
        .eq('id', editingId);
      if (error) throw error;
    },
    onSuccess: () => { setEditingId(null); invalidate(); toast.success('Note modifiée'); },
    onError: (e: any) => toast.error(e.message || 'Erreur'),
  });

  const toggleDoneMutation = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase
        .from('organization_notes')
        .update({ reminder_done: done })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e: any) => toast.error(e.message || 'Erreur'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('organization_notes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Note supprimée'); },
    onError: (e: any) => toast.error(e.message || 'Erreur'),
  });

  const startEdit = (n: any) => {
    setEditingId(n.id);
    setEditContent(n.content);
    setEditCategory(n.category);
    setEditReminder(toLocalInput(n.reminder_at));
  };

  return (
    <div className="space-y-4">
      {/* Formulaire d'ajout */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Ajouter une note ou un échange
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => {
                    const Icon = c.icon;
                    return (
                      <SelectItem key={c.value} value={c.value}>
                        <span className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5" />
                          {c.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Contenu</Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Échange téléphonique, demande client, suivi commercial..."
                rows={3}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-[260px_1fr]">
            <div>
              <Label className="text-xs flex items-center gap-1">
                <AlarmClock className="h-3.5 w-3.5" /> Rappel (optionnel)
              </Label>
              <Input
                type="datetime-local"
                value={reminder}
                onChange={(e) => setReminder(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => createMutation.mutate()} disabled={!content.trim() || createMutation.isPending}>
              <Plus className="mr-2 h-4 w-4" /> Ajouter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Historique */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">
          Historique ({notes?.length ?? 0})
        </h3>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : !notes || notes.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Aucune note pour le moment.
            </CardContent>
          </Card>
        ) : (
          notes.map((n: any) => {
            const meta = getCategoryMeta(n.category);
            const Icon = meta.icon;
            const isEditing = editingId === n.id;
            const hasReminder = !!n.reminder_at;
            const overdue = hasReminder && !n.reminder_done && isPast(new Date(n.reminder_at));
            return (
              <Card key={n.id} className={overdue ? 'border-red-500/50' : ''}>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={meta.color} variant="secondary">
                        <Icon className="h-3 w-3 mr-1" />
                        {meta.label}
                      </Badge>
                      {hasReminder && (
                        <Badge
                          variant="secondary"
                          className={
                            n.reminder_done
                              ? 'bg-muted text-muted-foreground'
                              : overdue
                                ? 'bg-red-500/15 text-red-700 dark:text-red-300'
                                : 'bg-orange-500/15 text-orange-700 dark:text-orange-300'
                          }
                        >
                          {n.reminder_done ? <BellOff className="h-3 w-3 mr-1" /> : overdue ? <BellRing className="h-3 w-3 mr-1" /> : <Bell className="h-3 w-3 mr-1" />}
                          Rappel : {format(new Date(n.reminder_at), 'd MMM yyyy à HH:mm', { locale: fr })}
                          {n.reminder_done && ' (fait)'}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {n.author_name || 'Super Admin'} ·{' '}
                        {format(new Date(n.created_at), 'd MMM yyyy à HH:mm', { locale: fr })}
                        {n.updated_at !== n.created_at && ' (modifié)'}
                      </span>
                    </div>
                    {!isEditing && (
                      <div className="flex gap-1">
                        {hasReminder && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8"
                            onClick={() => toggleDoneMutation.mutate({ id: n.id, done: !n.reminder_done })}
                          >
                            {n.reminder_done ? 'Rouvrir' : 'Marquer fait'}
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(n)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer cette note ?</AlertDialogTitle>
                              <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMutation.mutate(n.id)}>
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <Select value={editCategory} onValueChange={(v) => setEditCategory(v as Category)}>
                          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map(c => (
                              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="datetime-local"
                          value={editReminder}
                          onChange={(e) => setEditReminder(e.target.value)}
                          className="w-[230px]"
                        />
                        {editReminder && (
                          <Button variant="ghost" size="sm" onClick={() => setEditReminder('')}>
                            Supprimer rappel
                          </Button>
                        )}
                      </div>
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={3}
                      />
                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                          <X className="h-4 w-4 mr-1" /> Annuler
                        </Button>
                        <Button size="sm" onClick={() => updateMutation.mutate()} disabled={!editContent.trim()}>
                          <Save className="h-4 w-4 mr-1" /> Enregistrer
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{n.content}</p>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
