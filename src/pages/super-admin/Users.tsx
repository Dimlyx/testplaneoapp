import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Users, UserCog, Activity, Shield, Building2, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { EditUserDialog } from '@/components/super-admin/EditUserDialog';

interface UserWithRole {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  role: 'admin' | 'technician' | 'super_admin';
  organization: { id: string; name: string } | null;
}

export default function AllUsers() {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);

  const { data: usersWithRoles, isLoading } = useQuery({
    queryKey: ['all-users', searchQuery, roleFilter],
    queryFn: async () => {
      // Get all user roles with organization info
      let rolesQuery = supabase
        .from('user_roles')
        .select(`
          user_id,
          role,
          organization_id,
          organizations (
            id,
            name
          )
        `);

      if (roleFilter !== 'all') {
        rolesQuery = rolesQuery.eq('role', roleFilter as 'admin' | 'super_admin' | 'technician');
      }

      const { data: roles, error: rolesError } = await rolesQuery;
      if (rolesError) throw rolesError;

      if (!roles || roles.length === 0) return [];

      const userIds = roles.map(r => r.user_id);
      
      let profilesQuery = supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);

      if (searchQuery) {
        profilesQuery = profilesQuery.or(`email.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`);
      }

      const { data: profiles, error: profilesError } = await profilesQuery;
      if (profilesError) throw profilesError;

      return profiles?.map(profile => {
        const roleInfo = roles.find(r => r.user_id === profile.id);
        return {
          ...profile,
          role: roleInfo?.role || 'technician',
          organization: roleInfo?.organizations as { id: string; name: string } | null,
        };
      }).filter(Boolean) || [];
    },
  });

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'super_admin':
        return Shield;
      case 'admin':
        return UserCog;
      default:
        return Activity;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'destructive';
      case 'admin':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'Super Admin';
      case 'admin':
        return 'Administrateur';
      default:
        return 'Technicien';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tous les utilisateurs</h1>
        <p className="text-muted-foreground">
          Liste de tous les utilisateurs de la plateforme
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom ou email..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrer par rôle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les rôles</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
                <SelectItem value="admin">Administrateur</SelectItem>
                <SelectItem value="technician">Technicien</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : usersWithRoles && usersWithRoles.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Organisation</TableHead>
                  <TableHead>Créé le</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersWithRoles.map((user) => {
                  const RoleIcon = getRoleIcon(user.role);
                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                            <RoleIcon className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{user.full_name || 'Sans nom'}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(user.role) as 'default' | 'secondary' | 'destructive'}>
                          {getRoleLabel(user.role)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.organization ? (
                          <Link 
                            to={`/super-admin/organizations/${user.organization.id}`}
                            className="flex items-center gap-2 text-sm hover:underline"
                          >
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            {user.organization.name}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            {user.role === 'super_admin' ? 'Global' : 'Non assigné'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {format(new Date(user.created_at), 'dd MMM yyyy', { locale: fr })}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingUser(user as UserWithRole)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">Aucun utilisateur trouvé</h3>
              <p className="text-muted-foreground">
                {searchQuery || roleFilter !== 'all' 
                  ? 'Essayez de modifier vos filtres'
                  : 'Aucun utilisateur dans la plateforme'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <EditUserDialog
        user={editingUser}
        open={!!editingUser}
        onOpenChange={(open) => !open && setEditingUser(null)}
      />
    </div>
  );
}
