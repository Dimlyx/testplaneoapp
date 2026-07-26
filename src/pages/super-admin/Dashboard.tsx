import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Building2,
  Users,
  Timer,
  AlertTriangle,
  Wallet,
  Search,
  ChevronRight,
  Plus,
  CalendarClock,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { differenceInCalendarDays, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import ReminderAlertsWidget from '@/components/super-admin/ReminderAlertsWidget';

const DEMO_EMAIL = 'contact@demo-planeo.tech';

// Tarifs mensuels de référence pour l'estimation du MRR
const PLAN_PRICE: Record<string, number> = { essentiel: 49, business: 99 };

type Stage = 'trial' | 'active' | 'past_due' | 'churn';

const STAGES: { key: Stage; label: string; hint: string; tone: string }[] = [
  { key: 'trial', label: 'Période d\'essai', hint: 'À convertir', tone: 'border-amber-500/60' },
  { key: 'active', label: 'Clients actifs', hint: 'Abonnement en cours', tone: 'border-emerald-500/60' },
  { key: 'past_due', label: 'Impayés', hint: 'Relance nécessaire', tone: 'border-orange-500/60' },
  { key: 'churn', label: 'Suspendus / Annulés', hint: 'Perdus ou en pause', tone: 'border-destructive/60' },
];

function stageOf(org: { status: string | null; subscription_status: string | null }): Stage {
  const sub = org.subscription_status || 'active';
  if (org.status !== 'active' || sub === 'canceled' || sub === 'suspended' || sub === 'inactive') return 'churn';
  if (sub === 'past_due' || sub === 'unpaid') return 'past_due';
  if (sub === 'trial' || sub === 'trialing') return 'trial';
  return 'active';
}

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data: orgs, isLoading } = useQuery({
    queryKey: ['super-admin-cockpit-orgs'],
    queryFn: async () => {
      const [orgsRes, rolesRes] = await Promise.all([
        supabase
          .from('organizations')
          .select('id, name, plan, status, subscription_status, trial_ends_at, created_at, email, city, max_users')
          .neq('email', DEMO_EMAIL),
        supabase.from('user_roles').select('organization_id, role').in('role', ['admin', 'technician']),
      ]);
      if (orgsRes.error) throw orgsRes.error;

      const userCounts: Record<string, number> = {};
      rolesRes.data?.forEach((r) => {
        if (r.organization_id) userCounts[r.organization_id] = (userCounts[r.organization_id] || 0) + 1;
      });

      return (orgsRes.data || []).map((o) => ({
        ...o,
        userCount: userCounts[o.id] || 0,
        stage: stageOf(o),
        trialDaysLeft: o.trial_ends_at ? differenceInCalendarDays(new Date(o.trial_ends_at), new Date()) : null,
      }));
    },
  });

  const filtered = useMemo(() => {
    if (!orgs) return [];
    const q = search.trim().toLowerCase();
    if (!q) return orgs;
    return orgs.filter((o) => `${o.name} ${o.email ?? ''} ${o.city ?? ''}`.toLowerCase().includes(q));
  }, [orgs, search]);

  const byStage = useMemo(() => {
    const map: Record<Stage, typeof filtered> = { trial: [], active: [], past_due: [], churn: [] };
    filtered.forEach((o) => map[o.stage].push(o));
    return map;
  }, [filtered]);

  const kpis = useMemo(() => {
    const all = orgs || [];
    const actives = all.filter((o) => o.stage === 'active');
    const trials = all.filter((o) => o.stage === 'trial');
    const mrr = actives.reduce((sum, o) => sum + (PLAN_PRICE[o.plan] || 0), 0);
    const trialPotential = trials.reduce((sum, o) => sum + (PLAN_PRICE[o.plan] || 0), 0);
    const expiring = trials.filter((o) => o.trialDaysLeft !== null && o.trialDaysLeft <= 7);
    const atRisk = all.filter((o) => o.stage === 'past_due' || o.stage === 'churn');
    const totalUsers = all.reduce((sum, o) => sum + o.userCount, 0);
    const conversion = actives.length + trials.length > 0
      ? Math.round((actives.length / (actives.length + trials.length)) * 100)
      : 0;
    return { actives, trials, mrr, trialPotential, expiring, atRisk, totalUsers, conversion };
  }, [orgs]);

  const watchlist = useMemo(() => {
    return [...(orgs || [])]
      .filter((o) => o.stage === 'trial' || o.stage === 'past_due' || o.stage === 'churn')
      .sort((a, b) => {
        const rank: Record<Stage, number> = { past_due: 0, trial: 1, churn: 2, active: 3 };
        if (rank[a.stage] !== rank[b.stage]) return rank[a.stage] - rank[b.stage];
        return (a.trialDaysLeft ?? 999) - (b.trialDaysLeft ?? 999);
      });
  }, [orgs]);

  const recent = useMemo(
    () => [...(orgs || [])].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 5),
    [orgs]
  );

  const statCards = [
    {
      title: 'Clients actifs',
      value: kpis.actives.length,
      icon: CheckCircle2,
      description: `${kpis.totalUsers} utilisateurs au total`,
    },
    {
      title: 'En période d\'essai',
      value: kpis.trials.length,
      icon: Timer,
      description: `${kpis.expiring.length} se terminent sous 7 jours`,
    },
    {
      title: 'MRR estimé',
      value: `${kpis.mrr} €`,
      icon: Wallet,
      description: `+${kpis.trialPotential} € potentiels en essai`,
    },
    {
      title: 'Comptes à risque',
      value: kpis.atRisk.length,
      icon: AlertTriangle,
      description: 'Impayés, suspendus ou annulés',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cockpit Super Admin</h1>
          <p className="text-muted-foreground">Pilotage commercial des entreprises clientes</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher une entreprise…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 w-full sm:w-64"
            />
          </div>
          <Button onClick={() => navigate('/super-admin/organizations')}>
            <Plus className="mr-2 h-4 w-4" />
            Entreprises
          </Button>
        </div>
      </div>

      <ReminderAlertsWidget />

      {/* KPI */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <div className="p-2 rounded-lg bg-primary/10">
                <stat.icon className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-20" /> : <div className="text-2xl font-bold">{stat.value}</div>}
              <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Conversion */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Taux de conversion essai → client</CardTitle>
          <CardDescription>
            {kpis.actives.length} clients payants sur {kpis.actives.length + kpis.trials.length} comptes engagés
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Progress value={kpis.conversion} className="h-2 flex-1" />
            <span className="text-sm font-semibold w-12 text-right">{kpis.conversion}%</span>
          </div>
        </CardContent>
      </Card>

      {/* Pipeline */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Pipeline clients</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {STAGES.map((stage) => {
            const items = byStage[stage.key];
            return (
              <Card key={stage.key} className={`border-t-4 ${stage.tone}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{stage.label}</CardTitle>
                    <Badge variant="secondary">{items.length}</Badge>
                  </div>
                  <CardDescription className="text-xs">{stage.hint}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {isLoading ? (
                    <Skeleton className="h-16 w-full" />
                  ) : items.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">Aucune entreprise</p>
                  ) : (
                    items.map((org) => (
                      <button
                        key={org.id}
                        onClick={() => navigate(`/super-admin/organizations/${org.id}`)}
                        className="w-full text-left rounded-lg border bg-card p-3 transition-colors active:bg-muted"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-medium leading-tight break-words">{org.name}</span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <Badge variant={org.plan === 'business' ? 'default' : 'secondary'} className="text-[10px]">
                            {org.plan === 'business' ? 'Business' : 'Essentiel'}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            <Users className="mr-1 h-3 w-3" />
                            {org.userCount}
                          </Badge>
                          {stage.key === 'trial' && org.trialDaysLeft !== null && (
                            <Badge
                              variant={org.trialDaysLeft <= 3 ? 'destructive' : 'outline'}
                              className="text-[10px]"
                            >
                              <CalendarClock className="mr-1 h-3 w-3" />
                              {org.trialDaysLeft < 0 ? 'Expiré' : `J-${org.trialDaysLeft}`}
                            </Badge>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Watchlist */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Comptes à suivre</CardTitle>
            <CardDescription>Essais à convertir, impayés et comptes inactifs</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : watchlist.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Rien à signaler, tout est à jour</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entreprise</TableHead>
                    <TableHead>Situation</TableHead>
                    <TableHead>Échéance</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {watchlist.map((org) => (
                    <TableRow key={org.id}>
                      <TableCell className="font-medium">
                        {org.name}
                        <div className="text-xs text-muted-foreground">{org.email || '—'}</div>
                      </TableCell>
                      <TableCell>
                        {org.stage === 'trial' && <Badge variant="outline">Essai</Badge>}
                        {org.stage === 'past_due' && <Badge variant="destructive">Impayé</Badge>}
                        {org.stage === 'churn' && (
                          <Badge variant="secondary">
                            <XCircle className="mr-1 h-3 w-3" />
                            Inactif
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {org.trial_ends_at
                          ? format(new Date(org.trial_ends_at), 'd MMM yyyy', { locale: fr })
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/super-admin/organizations/${org.id}`)}
                        >
                          Gérer
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Derniers comptes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Derniers comptes créés</CardTitle>
            <CardDescription>Nouvelles entreprises sur la plateforme</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : recent.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Aucune entreprise</p>
            ) : (
              recent.map((org) => (
                <button
                  key={org.id}
                  onClick={() => navigate(`/super-admin/organizations/${org.id}`)}
                  className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors active:bg-muted"
                >
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{org.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(org.created_at), 'd MMM yyyy', { locale: fr })}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
