import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Building2, Plus, UserPlus, Trash2, Users, UserCog, Activity, ClipboardList, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface UserFormData {
  email: string;
  password: string;
  full_name: string;
  role: 'admin' | 'technician';
}

const initialUserFormData: UserFormData = {
  email: '',
  password: '',
  full_name: '',
  role: 'technician',
};

export default function OrganizationDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [userFormData, setUserFormData] = useState<UserFormData>(initialUserFormData);

  const { data: organization, isLoading: isLoadingOrg } = useQuery({
    queryKey: ['organization', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: users, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['organization-users', id],
    queryFn: async () => {
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .eq('organization_id', id);

      if (rolesError) throw rolesError;

      if (!roles || roles.length === 0) return [];

      const userIds = roles.map(r => r.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      return profiles?.map(profile => ({
        ...profile,
        role: roles.find(r => r.user_id === profile.id)?.role || 'technician',
      })) || [];
    },
    enabled: !!id,
  });

  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['organization-stats', id],
    queryFn: async () => {
      const [clientsResult, interventionsResult] = await Promise.all([
        supabase.from('clients').select('id', { count: 'exact', head: true }).eq('organization_id', id),
        supabase.from('interventions').select('id', { count: 'exact', head: true }).eq('organization_id', id),
      ]);

      return {
        clients: clientsResult.count || 0,
        interventions: interventionsResult.count || 0,
        users: users?.length || 0,
      };
    },
    enabled: !!id && !!users,
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      // Create user via Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: data.full_name,
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Échec de la création de l\'utilisateur');

      const userId = authData.user.id;

      // Wait a bit for the trigger to create the initial records
      await new Promise(resolve => setTimeout(resolve, 500));

      // Update the user role with organization and correct role
      const { error: roleError } = await supabase
        .from('user_roles')
        .update({ 
          role: data.role,
          organization_id: id,
        })
        .eq('user_id', userId);

      if (roleError) {
        // If update fails, try inserting instead (in case trigger didn't run)
        const { error: insertRoleError } = await supabase
          .from('user_roles')
          .insert({ 
            user_id: userId,
            role: data.role,
            organization_id: id,
          });
        if (insertRoleError) throw insertRoleError;
      }

      // Update profile with organization
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          organization_id: id,
          full_name: data.full_name,
        })
        .eq('id', userId);

      if (profileError) {
        // If update fails, try inserting instead
        const { error: insertProfileError } = await supabase
          .from('profiles')
          .insert({ 
            id: userId,
            email: data.email,
            organization_id: id,
            full_name: data.full_name,
          });
        if (insertProfileError) throw insertProfileError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-users', id] });
      queryClient.invalidateQueries({ queryKey: ['organization-stats', id] });
      toast.success('Utilisateur créé avec succès');
      setIsAddUserDialogOpen(false);
      setUserFormData(initialUserFormData);
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      // Remove organization from user role
      const { error } = await supabase
        .from('user_roles')
        .update({ organization_id: null })
        .eq('user_id', userId);

      if (error) throw error;

      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ organization_id: null })
        .eq('id', userId);

      if (profileError) throw profileError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-users', id] });
      queryClient.invalidateQueries({ queryKey: ['organization-stats', id] });
      toast.success('Utilisateur retiré de l\'organisation');
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    createUserMutation.mutate(userFormData);
  };

  if (isLoadingOrg) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium">Organisation introuvable</h3>
        <Button asChild className="mt-4">
          <Link to="/super-admin/organizations">Retour aux organisations</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/super-admin/organizations">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{organization.name}</h1>
            <p className="text-muted-foreground">{organization.slug}</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" asChild>
            <a href="/admin" target="_blank" rel="noopener noreferrer">
              <Eye className="mr-2 h-4 w-4" />
              Voir comme admin
            </a>
          </Button>
          <Badge variant={organization.status === 'active' ? 'default' : 'secondary'}>
            {organization.status === 'active' ? 'Actif' : organization.status}
          </Badge>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Utilisateurs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingStats ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-bold">{users?.length || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Clients</CardTitle>
            <UserCog className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingStats ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-bold">{stats?.clients || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Interventions</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingStats ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-bold">{stats?.interventions || 0}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">Utilisateurs</TabsTrigger>
          <TabsTrigger value="info">Informations</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Utilisateurs de l'organisation</h2>
            <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Ajouter un utilisateur
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Ajouter un utilisateur</DialogTitle>
                  <DialogDescription>
                    Créez un nouveau compte utilisateur pour cette organisation
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateUser}>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="full_name">Nom complet *</Label>
                      <Input
                        id="full_name"
                        value={userFormData.full_name}
                        onChange={(e) => setUserFormData(prev => ({ ...prev, full_name: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={userFormData.email}
                        onChange={(e) => setUserFormData(prev => ({ ...prev, email: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Mot de passe *</Label>
                      <Input
                        id="password"
                        type="password"
                        value={userFormData.password}
                        onChange={(e) => setUserFormData(prev => ({ ...prev, password: e.target.value }))}
                        required
                        minLength={6}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Rôle *</Label>
                      <Select
                        value={userFormData.role}
                        onValueChange={(value: 'admin' | 'technician') => 
                          setUserFormData(prev => ({ ...prev, role: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Administrateur</SelectItem>
                          <SelectItem value="technician">Technicien</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsAddUserDialogOpen(false)}>
                      Annuler
                    </Button>
                    <Button type="submit" disabled={createUserMutation.isPending}>
                      Créer l'utilisateur
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoadingUsers ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : users && users.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Utilisateur</TableHead>
                      <TableHead>Rôle</TableHead>
                      <TableHead>Créé le</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                              {user.role === 'admin' ? (
                                <UserCog className="h-4 w-4 text-primary" />
                              ) : (
                                <Activity className="h-4 w-4 text-primary" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium">{user.full_name || 'Sans nom'}</p>
                              <p className="text-sm text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                            {user.role === 'admin' ? 'Administrateur' : 'Technicien'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(user.created_at), 'dd MMM yyyy', { locale: fr })}
                        </TableCell>
                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Retirer l'utilisateur ?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  L'utilisateur sera retiré de cette organisation mais son compte ne sera pas supprimé.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteUserMutation.mutate(user.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Retirer
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12">
                  <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-medium">Aucun utilisateur</h3>
                  <p className="text-muted-foreground">
                    Ajoutez des utilisateurs à cette organisation
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="info">
          <Card>
            <CardHeader>
              <CardTitle>Informations de l'organisation</CardTitle>
              <CardDescription>Détails et coordonnées</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <p className="font-medium">{organization.email || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Téléphone</Label>
                  <p className="font-medium">{organization.phone || '-'}</p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Adresse</Label>
                <p className="font-medium">
                  {organization.address ? (
                    <>
                      {organization.address}<br />
                      {organization.postal_code} {organization.city}
                    </>
                  ) : '-'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">SIRET</Label>
                  <p className="font-medium">{organization.siret || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">N° TVA</Label>
                  <p className="font-medium">{organization.tva_number || '-'}</p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Créée le</Label>
                <p className="font-medium">
                  {format(new Date(organization.created_at), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
