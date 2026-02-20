import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, ClipboardList, TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useMemo } from 'react';
import { ChartClickInfo } from '@/components/charts/ChartClickInfo';

export default function SuperAdminDashboard() {
  const [barClickInfo, setBarClickInfo] = useState<{ label: string; value: number } | null>(null);
  const [pieClickInfo, setPieClickInfo] = useState<{ name: string; value: number } | null>(null);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['super-admin-stats'],
    queryFn: async () => {
      const now = new Date();
      const startOfCurrentMonth = startOfMonth(now).toISOString();
      const startOfLastMonth = startOfMonth(subMonths(now, 1)).toISOString();
      const endOfLastMonth = endOfMonth(subMonths(now, 1)).toISOString();

      // Get demo org IDs to exclude
      const { data: demoOrgs } = await supabase.from('organizations').select('id').eq('email', 'contact@demo-planeo.tech');
      const demoOrgIds = (demoOrgs || []).map(o => o.id);

      const [orgsResult, usersResult, adminsResult, techniciansResult, interventionsThisMonth, interventionsLastMonth] = await Promise.all([
        supabase.from('organizations').select('id', { count: 'exact', head: true }).eq('status', 'active').not('email', 'eq', 'contact@demo-planeo.tech'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).not('organization_id', 'in', `(${demoOrgIds.join(',')})`),
        supabase.from('user_roles').select('id', { count: 'exact', head: true }).eq('role', 'admin').not('organization_id', 'in', `(${demoOrgIds.join(',')})`),
        supabase.from('user_roles').select('id', { count: 'exact', head: true }).eq('role', 'technician').not('organization_id', 'in', `(${demoOrgIds.join(',')})`),
        supabase.from('interventions').select('id', { count: 'exact', head: true }).gte('created_at', startOfCurrentMonth).not('organization_id', 'in', `(${demoOrgIds.join(',')})`),
        supabase.from('interventions').select('id', { count: 'exact', head: true }).gte('created_at', startOfLastMonth).lte('created_at', endOfLastMonth).not('organization_id', 'in', `(${demoOrgIds.join(',')})`),
      ]);

      const currentCount = interventionsThisMonth.count || 0;
      const lastCount = interventionsLastMonth.count || 0;
      const trend = lastCount > 0 ? Math.round(((currentCount - lastCount) / lastCount) * 100) : currentCount > 0 ? 100 : 0;

      return {
        organizations: orgsResult.count || 0,
        totalUsers: usersResult.count || 0,
        admins: adminsResult.count || 0,
        technicians: techniciansResult.count || 0,
        interventionsThisMonth: currentCount,
        interventionsTrend: trend,
      };
    },
  });

  // Interventions per month (last 6 months)
  const { data: monthlyData } = useQuery({
    queryKey: ['super-admin-monthly-interventions'],
    queryFn: async () => {
      const { data: demoOrgs } = await supabase.from('organizations').select('id').eq('email', 'contact@demo-planeo.tech');
      const demoOrgIds = (demoOrgs || []).map(o => o.id);

      const now = new Date();
      const sixMonthsAgo = subMonths(now, 5);
      let query = supabase
        .from('interventions')
        .select('created_at, organization_id')
        .gte('created_at', startOfMonth(sixMonthsAgo).toISOString());
      if (demoOrgIds.length > 0) {
        query = query.not('organization_id', 'in', `(${demoOrgIds.join(',')})`);
      }
      const { data, error } = await query;
      if (error) throw error;

      const months: Record<string, number> = {};
      for (let i = 5; i >= 0; i--) {
        const d = subMonths(now, i);
        const key = format(d, 'yyyy-MM');
        months[key] = 0;
      }
      data?.forEach((row) => {
        const key = format(new Date(row.created_at), 'yyyy-MM');
        if (key in months) months[key]++;
      });

      return Object.entries(months).map(([key, count]) => ({
        month: format(new Date(key + '-01'), 'MMM yy', { locale: fr }),
        interventions: count,
      }));
    },
  });

  // Organization ranking
  const { data: orgRanking, isLoading: isLoadingRanking } = useQuery({
    queryKey: ['super-admin-org-ranking'],
    queryFn: async () => {
      const [orgsRes, interventionsRes, usersRes] = await Promise.all([
        supabase.from('organizations').select('id, name, plan, status').not('email', 'eq', 'contact@demo-planeo.tech'),
        supabase.from('interventions').select('organization_id'),
        supabase.from('user_roles').select('organization_id').in('role', ['admin', 'technician']),
      ]);

      const { data: demoOrgs } = await supabase.from('organizations').select('id').eq('email', 'contact@demo-planeo.tech');
      const demoOrgIds = new Set((demoOrgs || []).map(o => o.id));

      if (orgsRes.error) throw orgsRes.error;

      const intCounts: Record<string, number> = {};
      interventionsRes.data?.forEach((i) => {
        if (i.organization_id && !demoOrgIds.has(i.organization_id)) intCounts[i.organization_id] = (intCounts[i.organization_id] || 0) + 1;
      });

      const userCounts: Record<string, number> = {};
      usersRes.data?.forEach((u) => {
        if (u.organization_id && !demoOrgIds.has(u.organization_id)) userCounts[u.organization_id] = (userCounts[u.organization_id] || 0) + 1;
      });

      return (orgsRes.data || [])
        .map((org) => ({
          ...org,
          interventionCount: intCounts[org.id] || 0,
          userCount: userCounts[org.id] || 0,
        }))
        .sort((a, b) => b.interventionCount - a.interventionCount);
    },
  });

  // Plan distribution for pie chart
  const planDistribution = useMemo(() => {
    if (!orgRanking) return [];
    const counts: Record<string, number> = {};
    orgRanking.forEach((o) => {
      const plan = o.plan || 'essentiel';
      counts[plan] = (counts[plan] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name: name === 'business' ? 'Business' : 'Essentiel', value }));
  }, [orgRanking]);

  const PLAN_COLORS = ['hsl(var(--primary))', 'hsl(var(--muted-foreground))'];

  const statCards = [
    {
      title: 'Organisations actives',
      value: stats?.organizations || 0,
      icon: Building2,
      description: 'Entreprises enregistrées',
    },
    {
      title: 'Utilisateurs',
      value: stats?.totalUsers || 0,
      icon: Users,
      description: `${stats?.admins || 0} admins · ${stats?.technicians || 0} techniciens`,
    },
    {
      title: 'Interventions ce mois',
      value: stats?.interventionsThisMonth || 0,
      icon: ClipboardList,
      description: stats?.interventionsTrend !== undefined
        ? `${stats.interventionsTrend >= 0 ? '+' : ''}${stats.interventionsTrend}% vs mois dernier`
        : '',
      trend: stats?.interventionsTrend,
    },
    {
      title: 'Taux d\'activité',
      value: orgRanking
        ? `${Math.round((orgRanking.filter((o) => o.interventionCount > 0).length / Math.max(orgRanking.length, 1)) * 100)}%`
        : '—',
      icon: TrendingUp,
      description: 'Organisations avec interventions',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tableau de bord Super Admin</h1>
        <p className="text-muted-foreground">
          Vue d'ensemble de toutes les organisations et de l'activité
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className="p-2 rounded-lg bg-primary/10">
                <stat.icon className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold">{stat.value}</span>
                  {'trend' in stat && stat.trend !== undefined && (
                    <span className={`flex items-center text-xs font-medium ${stat.trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {stat.trend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {Math.abs(stat.trend)}%
                    </span>
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Monthly interventions bar chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Évolution des interventions</CardTitle>
            <CardDescription>6 derniers mois · Appuyez sur une barre pour voir le détail</CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyData ? (
              <>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={monthlyData} onClick={(state) => {
                    if (state?.activePayload?.[0]) {
                      const d = state.activePayload[0].payload;
                      setBarClickInfo({ label: d.month, value: d.interventions });
                    }
                  }}>
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Bar dataKey="interventions" name="Interventions" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                {barClickInfo && (
                  <ChartClickInfo
                    label={barClickInfo.label}
                    entries={[{ name: 'Interventions', value: barClickInfo.value, color: 'hsl(var(--primary))' }]}
                  />
                )}
              </>
            ) : (
              <Skeleton className="h-[260px] w-full" />
            )}
          </CardContent>
        </Card>

        {/* Plan distribution pie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Répartition des plans</CardTitle>
            <CardDescription>Par organisation · Appuyez pour voir le détail</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center">
            {planDistribution.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={planDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      dataKey="value"
                      label={({ name, value }) => `${name} (${value})`}
                      onClick={(data) => {
                        setPieClickInfo({ name: data.name, value: data.value });
                      }}
                    >
                      {planDistribution.map((_, i) => (
                        <Cell key={i} fill={PLAN_COLORS[i % PLAN_COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
                {pieClickInfo && (
                  <ChartClickInfo
                    entries={[{ name: pieClickInfo.name, value: pieClickInfo.value, color: PLAN_COLORS[planDistribution.findIndex(p => p.name === pieClickInfo.name) % PLAN_COLORS.length] }]}
                  />
                )}
              </>
            ) : (
              <Skeleton className="h-[260px] w-full" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Organization Ranking Table */}
      <Card>
        <CardHeader>
          <CardTitle>Classement des organisations</CardTitle>
          <CardDescription>Par nombre d'interventions</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingRanking ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : orgRanking && orgRanking.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Organisation</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Utilisateurs</TableHead>
                  <TableHead className="text-right">Interventions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgRanking.map((org, index) => (
                  <TableRow key={org.id}>
                    <TableCell className="font-medium text-muted-foreground">{index + 1}</TableCell>
                    <TableCell className="font-medium">{org.name}</TableCell>
                    <TableCell>
                      <Badge variant={org.plan === 'business' ? 'default' : 'secondary'} className="text-xs">
                        {org.plan === 'business' ? 'Business' : 'Essentiel'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={org.status === 'active' ? 'outline' : 'destructive'} className={`text-xs ${org.status === 'active' ? 'border-emerald-500 text-emerald-600' : ''}`}>
                        {org.status === 'active' ? 'Actif' : org.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{org.userCount}</TableCell>
                    <TableCell className="text-right font-semibold">{org.interventionCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-8">Aucune organisation</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
