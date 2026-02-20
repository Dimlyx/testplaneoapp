import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, Legend, 
  AreaChart, Area, CartesianGrid, Tooltip, LineChart, Line 
} from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useMemo, useState } from 'react';
import { 
  ClipboardList, Users, Building2, Wrench, AlertTriangle, CheckCircle, Clock, 
  TrendingUp, Calendar, BarChart3, ArrowUpRight, ArrowDownRight 
} from 'lucide-react';
import { ChartClickInfo } from '@/components/charts/ChartClickInfo';

const COLORS = [
  'hsl(var(--primary))', 
  'hsl(var(--muted-foreground))', 
  'hsl(210, 70%, 50%)', 
  'hsl(150, 60%, 45%)', 
  'hsl(40, 80%, 50%)', 
  'hsl(0, 65%, 50%)'
];

const STATUS_LABELS: Record<string, string> = {
  to_plan: 'À planifier',
  planned: 'Planifiée',
  in_progress: 'En cours',
  completed: 'Terminée',
  to_invoice: 'À facturer',
  archived: 'Archivée',
};

// Helper to exclude demo orgs
const getDemoOrgIds = async () => {
  const { data } = await supabase.from('organizations').select('id').eq('email', 'contact@demo-planeo.tech');
  return (data || []).map(o => o.id);
};

export default function SuperAdminStatistics() {
  const [statusClickInfo, setStatusClickInfo] = useState<{ name: string; value: number } | null>(null);

  // Core stats
  const { data: coreStats, isLoading } = useQuery({
    queryKey: ['super-admin-detailed-stats'],
    queryFn: async () => {
      const demoOrgIds = await getDemoOrgIds();
      const excludeDemo = demoOrgIds.length > 0 ? `(${demoOrgIds.join(',')})` : '(00000000-0000-0000-0000-000000000000)';

      const now = new Date();
      const startCurrent = startOfMonth(now).toISOString();
      const startLast = startOfMonth(subMonths(now, 1)).toISOString();
      const endLast = endOfMonth(subMonths(now, 1)).toISOString();

      const [
        orgsAll, orgsActive,
        usersAll, admins, technicians, superAdmins,
        intAll, intThisMonth, intLastMonth,
        clientsAll, alertsAll,
      ] = await Promise.all([
        supabase.from('organizations').select('id', { count: 'exact', head: true }).not('email', 'eq', 'contact@demo-planeo.tech'),
        supabase.from('organizations').select('id', { count: 'exact', head: true }).eq('status', 'active').not('email', 'eq', 'contact@demo-planeo.tech'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).not('organization_id', 'in', excludeDemo),
        supabase.from('user_roles').select('id', { count: 'exact', head: true }).eq('role', 'admin').not('organization_id', 'in', excludeDemo),
        supabase.from('user_roles').select('id', { count: 'exact', head: true }).eq('role', 'technician').not('organization_id', 'in', excludeDemo),
        supabase.from('user_roles').select('id', { count: 'exact', head: true }).eq('role', 'super_admin'),
        supabase.from('interventions').select('id', { count: 'exact', head: true }).not('organization_id', 'in', excludeDemo),
        supabase.from('interventions').select('id', { count: 'exact', head: true }).gte('created_at', startCurrent).not('organization_id', 'in', excludeDemo),
        supabase.from('interventions').select('id', { count: 'exact', head: true }).gte('created_at', startLast).lte('created_at', endLast).not('organization_id', 'in', excludeDemo),
        supabase.from('clients').select('id', { count: 'exact', head: true }).not('organization_id', 'in', excludeDemo),
        supabase.from('maintenance_alerts').select('id', { count: 'exact', head: true }).not('organization_id', 'in', excludeDemo),
      ]);

      const currentMonth = intThisMonth.count || 0;
      const lastMonth = intLastMonth.count || 0;
      const trend = lastMonth > 0 ? Math.round(((currentMonth - lastMonth) / lastMonth) * 100) : currentMonth > 0 ? 100 : 0;

      return {
        totalOrgs: orgsAll.count || 0,
        activeOrgs: orgsActive.count || 0,
        totalUsers: usersAll.count || 0,
        admins: admins.count || 0,
        technicians: technicians.count || 0,
        superAdmins: superAdmins.count || 0,
        totalInterventions: intAll.count || 0,
        interventionsThisMonth: currentMonth,
        interventionsLastMonth: lastMonth,
        trend,
        totalClients: clientsAll.count || 0,
        totalAlerts: alertsAll.count || 0,
      };
    },
  });

  // Interventions by status
  const { data: statusData } = useQuery({
    queryKey: ['super-admin-status-distribution'],
    queryFn: async () => {
      const demoOrgIds = await getDemoOrgIds();
      let query = supabase.from('interventions').select('status, organization_id');
      if (demoOrgIds.length > 0) {
        query = query.not('organization_id', 'in', `(${demoOrgIds.join(',')})`);
      }
      const { data, error } = await query;
      if (error) throw error;
      const counts: Record<string, number> = {};
      data?.forEach(i => { counts[i.status] = (counts[i.status] || 0) + 1; });
      return Object.entries(counts).map(([status, value]) => ({
        name: STATUS_LABELS[status] || status,
        value,
        status,
      }));
    },
  });

  // Monthly evolution (12 months)
  const { data: monthlyEvolution } = useQuery({
    queryKey: ['super-admin-12m-evolution'],
    queryFn: async () => {
      const demoOrgIds = await getDemoOrgIds();
      const now = new Date();
      const twelveMonthsAgo = subMonths(now, 11);
      let query = supabase.from('interventions').select('created_at, organization_id').gte('created_at', startOfMonth(twelveMonthsAgo).toISOString());
      if (demoOrgIds.length > 0) {
        query = query.not('organization_id', 'in', `(${demoOrgIds.join(',')})`);
      }
      const { data, error } = await query;
      if (error) throw error;

      // Also get new orgs per month
      let orgQuery = supabase.from('organizations').select('created_at').gte('created_at', startOfMonth(twelveMonthsAgo).toISOString()).not('email', 'eq', 'contact@demo-planeo.tech');
      const { data: orgData } = await orgQuery;

      const months: Record<string, { interventions: number; orgs: number }> = {};
      for (let i = 11; i >= 0; i--) {
        const key = format(subMonths(now, i), 'yyyy-MM');
        months[key] = { interventions: 0, orgs: 0 };
      }
      data?.forEach(row => {
        const key = format(new Date(row.created_at), 'yyyy-MM');
        if (key in months) months[key].interventions++;
      });
      orgData?.forEach(row => {
        const key = format(new Date(row.created_at), 'yyyy-MM');
        if (key in months) months[key].orgs++;
      });

      return Object.entries(months).map(([key, val]) => ({
        month: format(new Date(key + '-01'), 'MMM yy', { locale: fr }),
        interventions: val.interventions,
        organisations: val.orgs,
      }));
    },
  });

  // Org details table
  const { data: orgDetails } = useQuery({
    queryKey: ['super-admin-org-details-stats'],
    queryFn: async () => {
      const [orgsRes, intRes, usersRes, clientsRes] = await Promise.all([
        supabase.from('organizations').select('id, name, plan, status, created_at').not('email', 'eq', 'contact@demo-planeo.tech'),
        supabase.from('interventions').select('organization_id, status'),
        supabase.from('user_roles').select('organization_id, role').in('role', ['admin', 'technician']),
        supabase.from('clients').select('organization_id'),
      ]);
      if (orgsRes.error) throw orgsRes.error;

      const demoOrgIds = new Set((await getDemoOrgIds()));

      const intByOrg: Record<string, { total: number; completed: number }> = {};
      intRes.data?.forEach(i => {
        if (i.organization_id && !demoOrgIds.has(i.organization_id)) {
          if (!intByOrg[i.organization_id]) intByOrg[i.organization_id] = { total: 0, completed: 0 };
          intByOrg[i.organization_id].total++;
          if (['completed', 'to_invoice', 'archived'].includes(i.status)) intByOrg[i.organization_id].completed++;
        }
      });

      const usersByOrg: Record<string, number> = {};
      usersRes.data?.forEach(u => {
        if (u.organization_id && !demoOrgIds.has(u.organization_id)) {
          usersByOrg[u.organization_id] = (usersByOrg[u.organization_id] || 0) + 1;
        }
      });

      const clientsByOrg: Record<string, number> = {};
      clientsRes.data?.forEach(c => {
        if (c.organization_id && !demoOrgIds.has(c.organization_id)) {
          clientsByOrg[c.organization_id] = (clientsByOrg[c.organization_id] || 0) + 1;
        }
      });

      return (orgsRes.data || []).map(org => ({
        ...org,
        users: usersByOrg[org.id] || 0,
        clients: clientsByOrg[org.id] || 0,
        interventions: intByOrg[org.id]?.total || 0,
        completionRate: intByOrg[org.id]?.total 
          ? Math.round((intByOrg[org.id].completed / intByOrg[org.id].total) * 100) 
          : 0,
        age: differenceInDays(new Date(), new Date(org.created_at)),
      })).sort((a, b) => b.interventions - a.interventions);
    },
  });

  const kpis = [
    { label: 'Interventions totales', value: coreStats?.totalInterventions || 0, icon: ClipboardList, color: 'text-primary' },
    { label: 'Ce mois-ci', value: coreStats?.interventionsThisMonth || 0, icon: Calendar, trend: coreStats?.trend, color: 'text-blue-500' },
    { label: 'Organisations', value: `${coreStats?.activeOrgs || 0} / ${coreStats?.totalOrgs || 0}`, icon: Building2, sub: 'actives / total', color: 'text-emerald-500' },
    { label: 'Utilisateurs', value: coreStats?.totalUsers || 0, icon: Users, sub: `${coreStats?.admins || 0} admins · ${coreStats?.technicians || 0} techs`, color: 'text-orange-500' },
    { label: 'Clients', value: coreStats?.totalClients || 0, icon: Users, color: 'text-purple-500' },
    { label: 'Alertes maintenance', value: coreStats?.totalAlerts || 0, icon: AlertTriangle, color: 'text-amber-500' },
    { label: 'Moy. inter/org', value: coreStats && coreStats.activeOrgs > 0 ? Math.round(coreStats.totalInterventions / coreStats.activeOrgs) : 0, icon: BarChart3, color: 'text-pink-500' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Statistiques détaillées</h1>
        <p className="text-muted-foreground">
          Vue complète de l'activité de la plateforme (hors comptes démo)
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">{kpi.label}</span>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
              {isLoading ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold">{kpi.value}</span>
                  {'trend' in kpi && kpi.trend !== undefined && (
                    <span className={`flex items-center text-xs font-medium ${kpi.trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {kpi.trend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {Math.abs(kpi.trend)}%
                    </span>
                  )}
                </div>
              )}
              {kpi.sub && <p className="text-xs text-muted-foreground mt-0.5">{kpi.sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* 12-month evolution */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Évolution sur 12 mois</CardTitle>
            <CardDescription>Interventions et nouvelles organisations</CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyEvolution ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={monthlyEvolution}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="interventions" name="Interventions" stackId="1" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                  <Area type="monotone" dataKey="organisations" name="Nouvelles orgs" stackId="2" stroke="hsl(150, 60%, 45%)" fill="hsl(150, 60%, 45%)" fillOpacity={0.3} />
                  <Legend />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <Skeleton className="h-[300px] w-full" />
            )}
          </CardContent>
        </Card>

        {/* Status distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Répartition par statut</CardTitle>
            <CardDescription>Toutes interventions confondues</CardDescription>
          </CardHeader>
          <CardContent>
            {statusData ? (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, value }) => `${name} (${value})`}
                      onClick={(d) => setStatusClickInfo({ name: d.name, value: d.value })}
                    >
                      {statusData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
                {statusClickInfo && (
                  <ChartClickInfo
                    entries={[{ name: statusClickInfo.name, value: statusClickInfo.value, color: COLORS[statusData.findIndex(s => s.name === statusClickInfo.name) % COLORS.length] }]}
                  />
                )}
              </>
            ) : (
              <Skeleton className="h-[300px] w-full" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed org table */}
      <Card>
        <CardHeader>
          <CardTitle>Détail par organisation</CardTitle>
          <CardDescription>Activité complète de chaque entreprise</CardDescription>
        </CardHeader>
        <CardContent>
          {orgDetails ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Organisation</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-right">Utilisateurs</TableHead>
                    <TableHead className="text-right">Clients</TableHead>
                    <TableHead className="text-right">Interventions</TableHead>
                    <TableHead className="text-right">Taux réalisation</TableHead>
                    <TableHead className="text-right">Ancienneté</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orgDetails.map((org, i) => (
                    <TableRow key={org.id}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{org.name}</TableCell>
                      <TableCell>
                        <Badge variant={org.plan === 'business' ? 'default' : 'secondary'} className="text-xs">
                          {org.plan === 'business' ? 'Business' : 'Essentiel'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{org.users}</TableCell>
                      <TableCell className="text-right">{org.clients}</TableCell>
                      <TableCell className="text-right font-semibold">{org.interventions}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className={`text-xs ${org.completionRate >= 70 ? 'border-emerald-500 text-emerald-600' : org.completionRate >= 40 ? 'border-amber-500 text-amber-600' : 'border-red-500 text-red-600'}`}>
                          {org.completionRate}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-sm">{org.age}j</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Skeleton className="h-40 w-full" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
