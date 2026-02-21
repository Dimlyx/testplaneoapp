import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Loader2, Trash2, Eye, EyeOff, KeyRound, Mail, UserCircle } from 'lucide-react';

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
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (user) {
      setRole(user.role);
      setOrganizationId(user.organization?.id || 'none');
      setFullName(user.full_name || '');
      setEmail(user.email);
      setNewPassword('');
      setShowPassword(false);
    }
  }, [user]);

  // Fetch phone from profile
  const { data: profileData } = useQuery({
    queryKey: ['user-profile-detail', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('profiles')
        .select('phone')
        .eq('id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id && open,
  });

  useEffect(() => {
    if (profileData) {
      setPhone(profileData.phone || '');
    }
  }, [profileData]);

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

  const invokeManageUser = async (action: string, extra: Record<string, unknown> = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Non authentifié');
    const { data, error } = await supabase.functions.invoke('manage-user', {
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: { action, userId: user?.id, ...extra },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const updateRoleMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const newOrgId = organizationId === 'none' ? null : organizationId;
      const { error: roleError } = await supabase
        .from('user_roles')
        .update({ role: role as 'admin' | 'technician' | 'super_admin', organization_id: newOrgId })
        .eq('user_id', user.id);
      if (roleError) throw roleError;
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ organization_id: newOrgId })
        .eq('id', user.id);
      if (profileError) throw profileError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      toast.success('Rôle et entreprise mis à jour');
    },
    onError: (e) => toast.error(e.message),
  });

  const updateProfileMutation = useMutation({
    mutationFn: () => invokeManageUser('update_profile', { full_name: fullName, phone }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      toast.success('Profil mis à jour');
    },
    onError: (e) => toast.error(e.message),
  });

  const updateEmailMutation = useMutation({
    mutationFn: () => invokeManageUser('update_email', { email }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      toast.success('Email mis à jour');
    },
    onError: (e) => toast.error(e.message),
  });

  const updatePasswordMutation = useMutation({
    mutationFn: () => invokeManageUser('update_password', { password: newPassword }),
    onSuccess: () => {
      setNewPassword('');
      toast.success('Mot de passe mis à jour');
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => invokeManageUser('delete'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      toast.success('Utilisateur supprimé');
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Update profile (name, phone)
    await updateProfileMutation.mutateAsync();

    // Update email if changed
    if (email !== user.email) {
      await updateEmailMutation.mutateAsync();
    }

    // Update role/org if changed
    const newOrgId = organizationId === 'none' ? null : organizationId;
    if (role !== user.role || newOrgId !== (user.organization?.id || null)) {
      await updateRoleMutation.mutateAsync();
    }

    // Update password if provided
    if (newPassword) {
      await updatePasswordMutation.mutateAsync();
    }

    onOpenChange(false);
  };

  const isLoading = updateProfileMutation.isPending || updateEmailMutation.isPending || updateRoleMutation.isPending || updatePasswordMutation.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier l'utilisateur</DialogTitle>
            <DialogDescription>Modifiez les informations de cet utilisateur</DialogDescription>
          </DialogHeader>

          {user && (
            <form onSubmit={handleSaveAll} className="space-y-5">
              {/* Identity */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <UserCircle className="h-4 w-4" />
                  Identité
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nom complet</Label>
                  <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Nom complet" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input id="phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="06 00 00 00 00" />
                </div>
              </div>

              <Separator />

              {/* Email */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  Adresse email
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemple.fr" />
                </div>
              </div>

              <Separator />

              {/* Password */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <KeyRound className="h-4 w-4" />
                  Mot de passe
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Nouveau mot de passe</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Laisser vide pour ne pas modifier"
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full w-10"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {newPassword && newPassword.length < 6 && (
                    <p className="text-xs text-destructive">Minimum 6 caractères</p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Role & Org */}
              <div className="space-y-3">
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
                  <Label>Entreprise</Label>
                  <Select value={organizationId} onValueChange={setOrganizationId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        {role === 'super_admin' ? 'Global (pas d\'entreprise)' : 'Non assigné'}
                      </SelectItem>
                      {organizations?.map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {role !== 'super_admin' && organizationId === 'none' && (
                    <p className="text-xs text-amber-600">⚠️ Sans entreprise, l'utilisateur n'aura pas accès aux données</p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Actions */}
              <div className="flex items-center justify-between pt-2">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Supprimer
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={isLoading || (!!newPassword && newPassword.length < 6)}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Enregistrer
                  </Button>
                </div>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet utilisateur ?</AlertDialogTitle>
            <AlertDialogDescription>
              L'utilisateur <strong>{user?.full_name || user?.email}</strong> sera définitivement supprimé. 
              Ses interventions assignées seront désassignées. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
