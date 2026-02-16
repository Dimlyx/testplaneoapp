import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Plus, Megaphone, Building2, Trash2, Send } from 'lucide-react';

export default function Announcements() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [targetType, setTargetType] = useState<'all' | 'specific'>('all');
  const [selectedOrgIds, setSelectedOrgIds] = useState<string[]>([]);

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['announcements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: organizations = [] } = useQuery({
    queryKey: ['organizations-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, status')
        .eq('status', 'active')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('announcements').insert({
        title,
        content,
        target_type: targetType,
        target_organization_ids: targetType === 'specific' ? selectedOrgIds : [],
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      toast.success('Annonce envoyée avec succès');
      resetForm();
    },
    onError: () => toast.error("Erreur lors de l'envoi"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      toast.success('Annonce supprimée');
    },
  });

  const resetForm = () => {
    setTitle('');
    setContent('');
    setTargetType('all');
    setSelectedOrgIds([]);
    setDialogOpen(false);
  };

  const toggleOrg = (orgId: string) => {
    setSelectedOrgIds(prev =>
      prev.includes(orgId) ? prev.filter(id => id !== orgId) : [...prev, orgId]
    );
  };

  const getTargetLabel = (ann: any) => {
    if (ann.target_type === 'all') return 'Toutes les organisations';
    const count = ann.target_organization_ids?.length || 0;
    return `${count} organisation${count > 1 ? 's' : ''}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Communication</h1>
          <p className="text-muted-foreground">Envoyez des annonces aux organisations</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle annonce
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nouvelle annonce</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Titre</label>
                <Input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Ex: Maintenance prévue le..."
                />
              </div>
              <div>
                <label className="text-sm font-medium">Contenu</label>
                <Textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="Décrivez votre annonce..."
                  rows={4}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Destinataires</label>
                <Select value={targetType} onValueChange={(v: 'all' | 'specific') => setTargetType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les organisations</SelectItem>
                    <SelectItem value="specific">Organisations spécifiques</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {targetType === 'specific' && (
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Sélectionner les organisations ({selectedOrgIds.length})
                  </label>
                  <ScrollArea className="h-40 rounded-md border p-3">
                    <div className="space-y-2">
                      {organizations.map(org => (
                        <label key={org.id} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={selectedOrgIds.includes(org.id)}
                            onCheckedChange={() => toggleOrg(org.id)}
                          />
                          <span className="text-sm">{org.name}</span>
                        </label>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
              <Button
                className="w-full"
                onClick={() => createMutation.mutate()}
                disabled={!title.trim() || !content.trim() || createMutation.isPending || (targetType === 'specific' && selectedOrgIds.length === 0)}
              >
                <Send className="mr-2 h-4 w-4" />
                Envoyer l'annonce
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : announcements.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Megaphone className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Aucune annonce envoyée</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {announcements.map(ann => (
            <Card key={ann.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{ann.title}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(ann.created_at), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {getTargetLabel(ann)}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => deleteMutation.mutate(ann.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{ann.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
