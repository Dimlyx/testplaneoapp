import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Users, Plus, Pencil, Trash2, Crown, UserPlus } from 'lucide-react';
import { useTeams, useCreateTeam, useUpdateTeam, useDeleteTeam, TeamWithMembers } from '@/hooks/useTeams';
import { useTechnicians, Technician } from '@/hooks/useTechnicians';
import { useUserOrganization } from '@/hooks/useUserOrganization';
import { toast } from 'sonner';

export default function TeamManagement() {
  const { data: organizationId } = useUserOrganization();
  const { data: teams = [], isLoading } = useTeams();
  const { data: technicians = [] } = useTechnicians(organizationId);
  const createTeam = useCreateTeam();
  const updateTeam = useUpdateTeam();
  const deleteTeam = useDeleteTeam();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TeamWithMembers | null>(null);
  const [teamName, setTeamName] = useState('');
  const [leaderId, setLeaderId] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const openCreate = () => {
    setEditingTeam(null);
    setTeamName('');
    setLeaderId('');
    setSelectedMembers([]);
    setDialogOpen(true);
  };

  const openEdit = (team: TeamWithMembers) => {
    setEditingTeam(team);
    setTeamName(team.name);
    setLeaderId(team.leader_id);
    setSelectedMembers(team.members.map(m => m.user_id).filter(uid => uid !== team.leader_id));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!teamName.trim() || !leaderId || !organizationId) return;
    try {
      if (editingTeam) {
        await updateTeam.mutateAsync({ id: editingTeam.id, name: teamName, leader_id: leaderId, member_ids: selectedMembers });
        toast.success('Équipe mise à jour');
      } else {
        await createTeam.mutateAsync({ name: teamName, leader_id: leaderId, organization_id: organizationId, member_ids: selectedMembers });
        toast.success('Équipe créée');
      }
      setDialogOpen(false);
    } catch {
      toast.error("Erreur lors de l'enregistrement");
    }
  };

  const handleDelete = async (teamId: string) => {
    try {
      await deleteTeam.mutateAsync(teamId);
      toast.success('Équipe supprimée');
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  const getTechName = (userId: string) => {
    const tech = technicians.find(t => t.id === userId);
    return tech?.full_name || tech?.email || userId;
  };

  const toggleMember = (userId: string) => {
    setSelectedMembers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Équipes
        </h2>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Nouvelle équipe
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      ) : teams.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>Aucune équipe créée</p>
            <p className="text-xs mt-1">Créez une équipe pour regrouper vos techniciens</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {teams.map(team => (
            <Card key={team.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{team.name}</CardTitle>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(team)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(team.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Crown className="h-4 w-4 text-yellow-500" />
                  <span className="font-medium">{getTechName(team.leader_id)}</span>
                  <Badge variant="outline" className="text-xs">Chef d'équipe</Badge>
                </div>
                {team.members.filter(m => m.user_id !== team.leader_id).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {team.members
                      .filter(m => m.user_id !== team.leader_id)
                      .map(m => (
                        <Badge key={m.id} variant="secondary" className="text-xs">
                          {getTechName(m.user_id)}
                        </Badge>
                      ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {team.members.length} membre{team.members.length > 1 ? 's' : ''}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTeam ? 'Modifier l\'équipe' : 'Nouvelle équipe'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nom de l'équipe</Label>
              <Input value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="Ex: Équipe Nord" />
            </div>
            <div>
              <Label>Chef d'équipe</Label>
              <Select value={leaderId} onValueChange={setLeaderId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner le chef d'équipe" />
                </SelectTrigger>
                <SelectContent>
                  {technicians.map(tech => (
                    <SelectItem key={tech.id} value={tech.id}>
                      <div className="flex items-center gap-2">
                        <Crown className="h-3.5 w-3.5 text-yellow-500" />
                        {tech.full_name || tech.email}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Membres de l'équipe</Label>
              <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto mt-1">
                {technicians
                  .filter(t => t.id !== leaderId)
                  .map(tech => (
                    <label key={tech.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded">
                      <Checkbox
                        checked={selectedMembers.includes(tech.id)}
                        onCheckedChange={() => toggleMember(tech.id)}
                      />
                      <span className="text-sm">{tech.full_name || tech.email}</span>
                    </label>
                  ))}
                {technicians.filter(t => t.id !== leaderId).length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">Aucun autre technicien disponible</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={!teamName.trim() || !leaderId || createTeam.isPending || updateTeam.isPending}>
              {editingTeam ? 'Mettre à jour' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
