import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface UserWithRole {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'technician' | 'super_admin';
  organization: { id: string; name: string } | null;
}

interface EditUserDialogProps {
  user: UserWithRole | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditUserDialog({ user, open, onOpenChange }: EditUserDialogProps) {
  const queryClient = useQueryClient();
  const [role, setRole] = useState<string>('technician');
  const [organizationId, setOrganizationId] = useState<string>('none');

  useEffect(() => {
    if (user) {
      setRole(user.role);
      setOrganizationId(user.organization?.id || 'none');
    }
  }, [user]);

  const { data: organizations } = useQuery({
    queryKey: ['all-organizations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;

      const newOrgId = organizationId === 'none' ? null : organizationId;

      // Update user_roles
      const { error: roleError } = await supabase
        .from('user_roles')
        .update({ 
          role: role as 'admin' | 'technician' | 'super_admin',
          organization_id: newOrgId,
        })
        .eq('user_id', user.id);

      if (roleError) throw roleError;

      // Update profiles with organization
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ organization_id: newOrgId })
        .eq('id', user.id);

      if (profileError) throw profileError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      toast.success('Utilisateur mis à jour');
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Error updating user:', error);
      toast.error('Erreur lors de la mise à jour');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateUserMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier l'utilisateur</DialogTitle>
        </DialogHeader>
        
        {user && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <p className="font-medium">{user.full_name || 'Sans nom'}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>

            <div className="space-y-2">
              <Label>Rôle</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                  <SelectItem value="admin">Administrateur</SelectItem>
                  <SelectItem value="technician">Technicien</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Organisation</Label>
              <Select value={organizationId} onValueChange={setOrganizationId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    {role === 'super_admin' ? 'Global (pas d\'organisation)' : 'Non assigné'}
                  </SelectItem>
                  {organizations?.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {role !== 'super_admin' && organizationId === 'none' && (
                <p className="text-xs text-amber-600">
                  ⚠️ Sans organisation, l'utilisateur n'aura pas accès aux données
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={updateUserMutation.isPending}>
                {updateUserMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enregistrer
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
