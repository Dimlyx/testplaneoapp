import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, UserCog, Activity } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function SuperAdminDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['super-admin-stats'],
    queryFn: async () => {
      const [orgsResult, usersResult, adminsResult, techniciansResult] = await Promise.all([
        supabase.from('organizations').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('user_roles').select('id', { count: 'exact', head: true }).eq('role', 'admin'),
        supabase.from('user_roles').select('id', { count: 'exact', head: true }).eq('role', 'technician'),
      ]);

      return {
        organizations: orgsResult.count || 0,
        totalUsers: usersResult.count || 0,
        admins: adminsResult.count || 0,
        technicians: techniciansResult.count || 0,
      };
    },
  });

  const { data: recentOrgs, isLoading: isLoadingOrgs } = useQuery({
    queryKey: ['recent-organizations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
  });

  const statCards = [
    {
      title: 'Organisations',
      value: stats?.organizations || 0,
      icon: Building2,
      description: 'Entreprises actives',
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Utilisateurs',
      value: stats?.totalUsers || 0,
      icon: Users,
      description: 'Comptes créés',
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: 'Administrateurs',
      value: stats?.admins || 0,
      icon: UserCog,
      description: 'Admins d\'organisations',
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      title: 'Techniciens',
      value: stats?.technicians || 0,
      icon: Activity,
      description: 'Techniciens terrain',
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tableau de bord Super Admin</h1>
        <p className="text-muted-foreground">
          Vue d'ensemble de toutes les organisations et utilisateurs
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{stat.value}</div>
              )}
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Organizations */}
      <Card>
        <CardHeader>
          <CardTitle>Organisations récentes</CardTitle>
          <CardDescription>
            Les 5 dernières organisations créées
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingOrgs ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : recentOrgs && recentOrgs.length > 0 ? (
            <div className="space-y-3">
              {recentOrgs.map((org) => (
                <div
                  key={org.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{org.name}</p>
                      <p className="text-sm text-muted-foreground">{org.email || 'Pas d\'email'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      org.status === 'active' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {org.status === 'active' ? 'Actif' : org.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Aucune organisation créée
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
