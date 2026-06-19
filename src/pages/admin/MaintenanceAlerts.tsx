import { useState, useEffect, useMemo } from 'react';
import { useMaintenanceAlerts, useCreateMaintenanceAlert, useUpdateMaintenanceAlert, useDeleteMaintenanceAlert, MaintenanceAlert, AlertRecurrence, AlertStatus } from '@/hooks/useMaintenanceAlerts';
import { useClients } from '@/hooks/useClients';
import { QuickCreateClientDialog } from '@/components/admin/QuickCreateClientDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Bell, Plus, Edit, Trash2, Calendar, RefreshCw, CheckCircle, Clock, XCircle, AlertTriangle, CalendarDays, Search, X, ClipboardList, Filter, ArrowRight, Download, Info, CalendarClock, FileCheck, User, Building2 } from 'lucide-react';
import { format, parseISO, isPast, isToday, isFuture, addDays, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MaintenanceCalendar } from '@/components/admin/MaintenanceCalendar';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';

const recurrenceLabels: Record<AlertRecurrence, string> = {
  once: 'Une fois',
  weekly: 'Hebdomadaire',
  monthly: 'Mensuel',
  quarterly: 'Trimestriel',
  yearly: 'Annuel',
};

const getRecurrenceLabel = (alert: MaintenanceAlert) => {
  const months = alert.recurrence_months;
  if (months !== undefined && months !== null) {
    if (months === 0) return 'Une fois';
    if (months === 1) return 'Tous les mois';
    return `Tous les ${months} mois`;
  }
  return recurrenceLabels[alert.recurrence];
};

const statusLabels: Record<AlertStatus, string> = {
  pending: 'En attente',
  acknowledged: 'Pris en compte',
  completed: 'Terminé',
  dismissed: 'Ignoré',
};

const statusConfig: Record<AlertStatus, { bg: string; text: string; dot: string }> = {
  pending: { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
  acknowledged: { bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-700 dark:text-blue-400', dot: 'bg-blue-500' },
  completed: { bg: 'bg-green-50 dark:bg-green-950/30', text: 'text-green-700 dark:text-green-400', dot: 'bg-green-500' },
  dismissed: { bg: 'bg-muted', text: 'text-muted-foreground', dot: 'bg-muted-foreground' },
};

interface AlertFormData {
  title: string;
  description: string;
  client_id: string;
  alert_date: string;
  recurrence: AlertRecurrence;
  recurrence_months: number;
  day_of_month: number | null;
}

export default function MaintenanceAlerts() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const alertsView = searchParams.get('view') || 'active';
  const { data: alerts = [], isLoading } = useMaintenanceAlerts();
  const { data: clients = [] } = useClients();
  const createAlert = useCreateMaintenanceAlert();
  const updateAlert = useUpdateMaintenanceAlert();
  const deleteAlert = useDeleteMaintenanceAlert();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState<MaintenanceAlert | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClient, setFilterClient] = useState<string>('all');
  const [showCreateClient, setShowCreateClient] = useState(false);
  const [filterRecurrence, setFilterRecurrence] = useState<string>('all');
  const [quickFilter, setQuickFilter] = useState<'all' | 'overdue' | 'today' | 'week' | 'once' | 'recurring'>('all');
  const [formData, setFormData] = useState<AlertFormData>({
    title: '',
    description: '',
    client_id: '',
    alert_date: format(new Date(), 'yyyy-MM-dd'),
    recurrence: 'monthly',
    recurrence_months: 0,
    day_of_month: null,
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('maintenance-alerts-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'maintenance_alerts' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['maintenance-alerts'] });
          queryClient.invalidateQueries({ queryKey: ['pending-alerts'] });
          queryClient.invalidateQueries({ queryKey: ['upcoming-alerts'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      client_id: '',
      alert_date: format(new Date(), 'yyyy-MM-dd'),
      recurrence: 'monthly',
      recurrence_months: 0,
      day_of_month: null,
    });
    setEditingAlert(null);
  };

  const handleOpenDialog = (alert?: MaintenanceAlert) => {
    if (alert) {
      setEditingAlert(alert);
      setFormData({
        title: alert.title,
        description: alert.description || '',
        client_id: alert.client_id || '',
        alert_date: alert.alert_date,
        recurrence: alert.recurrence,
        recurrence_months: alert.recurrence_months ?? 0,
        day_of_month: alert.day_of_month ?? null,
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const data = {
      title: formData.title,
      description: formData.description || undefined,
      client_id: formData.client_id || undefined,
      alert_date: formData.alert_date,
      recurrence: formData.recurrence_months === 0 ? 'once' as AlertRecurrence : 'monthly' as AlertRecurrence,
      recurrence_months: formData.recurrence_months,
      day_of_month: formData.recurrence_months > 0 ? formData.day_of_month : null,
    };

    if (editingAlert) {
      await updateAlert.mutateAsync({ id: editingAlert.id, ...data });
    } else {
      await createAlert.mutateAsync(data);
    }
    
    setIsDialogOpen(false);
    resetForm();
  };

  const handleStatusChange = async (alert: MaintenanceAlert, newStatus: AlertStatus) => {
    await updateAlert.mutateAsync({ id: alert.id, status: newStatus });
  };

  const handleCreateIntervention = (alert: MaintenanceAlert) => {
    const params = new URLSearchParams();
    if (alert.client_id) params.set('client_id', alert.client_id);
    params.set('title', `Maintenance: ${alert.title}`);
    if (alert.description) params.set('description', alert.description);
    navigate(`/admin/interventions/new?${params.toString()}`);
  };

  const getAlertUrgency = (alertDate: string) => {
    const date = parseISO(alertDate);
    if (isPast(date) && !isToday(date)) return 'overdue';
    if (isToday(date)) return 'today';
    if (isFuture(date) && date <= addDays(new Date(), 7)) return 'upcoming';
    return 'future';
  };

  const getUrgencyBadge = (alertDate: string, status: AlertStatus) => {
    if (status === 'completed' || status === 'dismissed') return null;
    const urgency = getAlertUrgency(alertDate);
    const daysOverdue = differenceInDays(new Date(), parseISO(alertDate));
    switch (urgency) {
      case 'overdue':
        return (
          <Badge variant="destructive" className="text-xs">
            {daysOverdue} j. retard
          </Badge>
        );
      case 'today':
        return <Badge className="bg-amber-500 text-white text-xs">Aujourd'hui</Badge>;
      case 'upcoming':
        return <Badge variant="secondary" className="text-xs">Cette semaine</Badge>;
      default:
        return null;
    }
  };

  // Filtered alerts
  const filteredAlerts = useMemo(() => {
    return alerts.filter(a => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = a.title.toLowerCase().includes(q);
        const matchClient = a.clients?.name?.toLowerCase().includes(q);
        const matchDesc = a.description?.toLowerCase().includes(q);
        if (!matchTitle && !matchClient && !matchDesc) return false;
      }
      if (filterClient !== 'all' && a.client_id !== filterClient) return false;
      if (filterRecurrence === 'once' && a.recurrence_months !== 0) return false;
      if (filterRecurrence === 'recurring' && a.recurrence_months === 0) return false;
      if (quickFilter !== 'all') {
        const u = getAlertUrgency(a.alert_date);
        const active = a.status === 'pending' || a.status === 'acknowledged';
        if (quickFilter === 'overdue' && !(active && u === 'overdue')) return false;
        if (quickFilter === 'today' && !(active && u === 'today')) return false;
        if (quickFilter === 'week' && !(active && (u === 'today' || u === 'upcoming'))) return false;
        if (quickFilter === 'once' && a.recurrence_months !== 0) return false;
        if (quickFilter === 'recurring' && a.recurrence_months === 0) return false;
      }
      return true;
    });
  }, [alerts, searchQuery, filterClient, filterRecurrence, quickFilter]);

  const pendingAlerts = filteredAlerts.filter(a => a.status === 'pending');
  const acknowledgedAlerts = filteredAlerts.filter(a => a.status === 'acknowledged');
  const completedAlerts = filteredAlerts.filter(a => a.status === 'completed' || a.status === 'dismissed');
  const activeAlerts = [...pendingAlerts, ...acknowledgedAlerts].sort(
    (a, b) => new Date(a.alert_date).getTime() - new Date(b.alert_date).getTime()
  );

  // Stats from unfiltered data
  const overdueCount = alerts.filter(a => a.status === 'pending' && getAlertUrgency(a.alert_date) === 'overdue').length;
  const todayCount = alerts.filter(a => (a.status === 'pending' || a.status === 'acknowledged') && getAlertUrgency(a.alert_date) === 'today').length;
  const upcomingCount = alerts.filter(a => (a.status === 'pending' || a.status === 'acknowledged') && getAlertUrgency(a.alert_date) === 'upcoming').length;
  const completedThisMonthCount = alerts.filter(a => {
    if (a.status !== 'completed') return false;
    const d = parseISO(a.updated_at || a.alert_date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const nextDue = useMemo(() => {
    const today = new Date();
    return [...alerts]
      .filter(a => (a.status === 'pending' || a.status === 'acknowledged') && parseISO(a.alert_date) >= today)
      .sort((a, b) => new Date(a.alert_date).getTime() - new Date(b.alert_date).getTime())[0];
  }, [alerts]);

  // Clients under maintenance contract
  const contractClients = useMemo(() => {
    return clients
      .filter((c) => c.has_maintenance_contract)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [clients]);

  const today = new Date();
  const getContractStatus = (endDate: string | null) => {
    if (!endDate) return null;
    const end = parseISO(endDate);
    const days = differenceInDays(end, today);
    if (days < 0) return { label: 'Expiré', variant: 'destructive' as const, days };
    if (days <= 30) return { label: `${days} j restants`, variant: 'warning' as const, days };
    if (days <= 90) return { label: `${days} j restants`, variant: 'secondary' as const, days };
    return { label: `${days} j restants`, variant: 'outline' as const, days };
  };

  const hasFilters = searchQuery.trim() !== '' || filterClient !== 'all' || filterRecurrence !== 'all' || quickFilter !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setFilterClient('all');
    setFilterRecurrence('all');
    setQuickFilter('all');
  };

  const handleExport = () => {
    const rows = [
      ['Titre', 'Client', 'Date', 'Récurrence', 'Statut', 'Description'],
      ...filteredAlerts.map(a => [
        a.title,
        a.clients?.name || '',
        a.alert_date,
        getRecurrenceLabel(a),
        statusLabels[a.status],
        (a.description || '').replace(/\n/g, ' '),
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `alertes-maintenance-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Bell className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Alertes maintenance</h1>
            <p className="text-sm text-muted-foreground">
              Planification et suivi · {alerts.length} alerte{alerts.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Exporter
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()} size="default">
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle alerte
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {editingAlert ? 'Modifier l\'alerte' : 'Créer une alerte'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Titre *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ex: Maintenance annuelle climatisation"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Détails de l'alerte..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="client">Client</Label>
                <div className="flex gap-2">
                  <Select
                    value={formData.client_id}
                    onValueChange={(value) => setFormData({ ...formData, client_id: value })}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Sélectionner un client (optionnel)" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" size="icon" onClick={() => setShowCreateClient(true)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="alert_date">Date d'alerte *</Label>
                  <Input
                    id="alert_date"
                    type="date"
                    value={formData.alert_date}
                    onChange={(e) => setFormData({ ...formData, alert_date: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="recurrence_months">Récurrence (mois)</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">Tous les</span>
                    <Input
                      id="recurrence_months"
                      type="number"
                      min={0}
                      max={120}
                      value={formData.recurrence_months}
                      onChange={(e) => setFormData({ ...formData, recurrence_months: parseInt(e.target.value) || 0 })}
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">mois</span>
                  </div>
                  <p className="text-xs text-muted-foreground">0 = une seule fois</p>
                </div>
              </div>

              {formData.recurrence_months > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="day_of_month">Jour du mois (optionnel)</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">Tous les</span>
                    <Input
                      id="day_of_month"
                      type="number"
                      min={1}
                      max={31}
                      placeholder="ex: 10"
                      value={formData.day_of_month ?? ''}
                      onChange={(e) => {
                        const v = e.target.value === '' ? null : Math.min(31, Math.max(1, parseInt(e.target.value) || 1));
                        setFormData({ ...formData, day_of_month: v });
                      }}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">du mois</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Laissez vide pour conserver la date d'alerte initiale.</p>
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={createAlert.isPending || updateAlert.isPending}>
                  {editingAlert ? 'Mettre à jour' : 'Créer'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <button
          type="button"
          onClick={() => setQuickFilter(quickFilter === 'overdue' ? 'all' : 'overdue')}
          className={cn(
            "text-left rounded-xl border bg-card p-4 transition-colors",
            "border-l-4 border-l-destructive",
            quickFilter === 'overdue' && "ring-2 ring-destructive/40",
            overdueCount > 0 && "bg-destructive/5"
          )}
        >
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">En retard</p>
          <p className={cn("text-3xl font-bold mt-1", overdueCount > 0 ? "text-destructive" : "text-foreground")}>
            {overdueCount}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {overdueCount > 0 ? 'Action requise' : 'Tout est à jour'}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setQuickFilter(quickFilter === 'today' ? 'all' : 'today')}
          className={cn(
            "text-left rounded-xl border bg-card p-4 transition-colors",
            "border-l-4 border-l-amber-500",
            quickFilter === 'today' && "ring-2 ring-amber-500/40"
          )}
        >
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">À faire aujourd'hui</p>
          <p className="text-3xl font-bold mt-1">{todayCount}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {todayCount === 0 ? 'Rien de prévu' : `${todayCount} à traiter`}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setQuickFilter(quickFilter === 'week' ? 'all' : 'week')}
          className={cn(
            "text-left rounded-xl border bg-card p-4 transition-colors",
            "border-l-4 border-l-blue-500",
            quickFilter === 'week' && "ring-2 ring-blue-500/40"
          )}
        >
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cette semaine</p>
          <p className="text-3xl font-bold mt-1">{todayCount + upcomingCount}</p>
          <p className="text-xs text-muted-foreground mt-1">
            dont {todayCount} aujourd'hui
          </p>
        </button>

        <div className="rounded-xl border bg-card p-4 border-l-4 border-l-green-500">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Terminées (mois)</p>
          <p className="text-3xl font-bold mt-1 text-green-600 dark:text-green-500">{completedThisMonthCount}</p>
          <p className="text-xs text-muted-foreground mt-1">
            sur {alerts.filter(a => a.status === 'completed').length} au total
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4 border-l-4 border-l-primary col-span-2 md:col-span-3 lg:col-span-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Proch. échéance</p>
          {nextDue ? (
            <>
              <p className="text-2xl font-bold mt-1">
                {format(parseISO(nextDue.alert_date), 'dd MMM', { locale: fr })}
              </p>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {nextDue.clients?.name ? `${nextDue.clients.name} · ` : ''}{nextDue.title}
              </p>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold mt-1 text-muted-foreground">—</p>
              <p className="text-xs text-muted-foreground mt-1">Aucune à venir</p>
            </>
          )}
        </div>
      </div>

      {/* Overdue info banner */}
      {overdueCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <Info className="h-4 w-4 text-primary shrink-0" />
          <p className="flex-1">
            <span className="font-semibold">{overdueCount} maintenance{overdueCount > 1 ? 's' : ''} en retard</span> à traiter.
          </p>
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-primary"
            onClick={() => setQuickFilter('overdue')}
          >
            Voir les alertes concernées →
          </Button>
        </div>
      )}

      {/* Search & Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par titre, client, description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterClient} onValueChange={setFilterClient}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les clients</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterRecurrence} onValueChange={setFilterRecurrence}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <RefreshCw className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Récurrence" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                <SelectItem value="once">Une fois</SelectItem>
                <SelectItem value="recurring">Récurrentes</SelectItem>
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="ghost" size="icon" onClick={clearFilters} className="shrink-0">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={alertsView} onValueChange={(v) => { const p = new URLSearchParams(searchParams); if (v === 'active') p.delete('view'); else p.set('view', v); setSearchParams(p, { replace: true }); }} className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">
            Actives ({activeAlerts.length})
          </TabsTrigger>
          <TabsTrigger value="calendar" className="flex items-center gap-1">
            <CalendarDays className="h-4 w-4" />
            Calendrier
          </TabsTrigger>
          <TabsTrigger value="contracts" className="flex items-center gap-1">
            <FileCheck className="h-4 w-4" />
            Contrats ({contractClients.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Historique ({completedAlerts.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar">
          <MaintenanceCalendar 
            alerts={filteredAlerts} 
            onAlertClick={(alert) => handleOpenDialog(alert)}
          />
        </TabsContent>

        <TabsContent value="contracts">
          {contractClients.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 rounded-full bg-muted mb-4">
                  <FileCheck className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-1">Aucun client sous contrat</h3>
                <p className="text-muted-foreground text-sm max-w-sm">
                  Activez l'option « Contrat de maintenance » sur la fiche d'un client pour le retrouver ici.
                </p>
                <Button variant="outline" className="mt-4" onClick={() => navigate('/admin/clients')}>
                  Voir mes clients
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {contractClients.map((c) => {
                const status = getContractStatus(c.contract_end_date);
                const Icon = c.client_type === 'professional' ? Building2 : User;
                return (
                  <Card
                    key={c.id}
                    className={cn(
                      "transition-all border-l-4",
                      status?.variant === 'destructive' && "border-l-destructive",
                      status?.variant === 'warning' && "border-l-amber-500",
                      (!status || status.variant === 'secondary' || status.variant === 'outline') && "border-l-primary/40",
                    )}
                  >
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                            <button
                              onClick={() => navigate(`/admin/clients/${c.id}/edit`)}
                              className="font-semibold text-base truncate text-left hover:underline"
                            >
                              {c.name}
                            </button>
                            {c.contract_type && (
                              <Badge variant="outline" className="text-[10px] font-normal py-0 h-5">
                                {c.contract_type}
                              </Badge>
                            )}
                            {status && (
                              <Badge
                                className={cn(
                                  "text-[10px] py-0 h-5",
                                  status.variant === 'destructive' && "bg-destructive text-destructive-foreground",
                                  status.variant === 'warning' && "bg-amber-500 text-white",
                                )}
                                variant={status.variant === 'destructive' || status.variant === 'warning' ? 'default' : status.variant}
                              >
                                {status.label}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 flex-wrap text-sm text-muted-foreground">
                            {c.contract_start_date && (
                              <span className="flex items-center gap-1.5">
                                <CalendarClock className="h-3.5 w-3.5" />
                                Début : {format(parseISO(c.contract_start_date), 'dd MMM yyyy', { locale: fr })}
                              </span>
                            )}
                            {c.contract_end_date && (
                              <span className="flex items-center gap-1.5">
                                <CalendarClock className="h-3.5 w-3.5" />
                                Fin : {format(parseISO(c.contract_end_date), 'dd MMM yyyy', { locale: fr })}
                              </span>
                            )}
                            {c.contract_visits_per_year != null && (
                              <span className="flex items-center gap-1.5">
                                <RefreshCw className="h-3.5 w-3.5" />
                                {c.contract_visits_per_year} visite{c.contract_visits_per_year > 1 ? 's' : ''} / {({ day: 'jour', week: 'semaine', month: 'mois', year: 'an' } as Record<string,string>)[c.contract_visits_period || 'year']}
                              </span>
                            )}
                            {c.city && <span>{c.city}</span>}
                          </div>
                          {c.contract_notes && (
                            <div className="text-sm text-muted-foreground mt-1">
                              <span className="line-clamp-1">{c.contract_notes}</span>
                              {c.contract_notes.length > 100 && (
                                <button
                                  onClick={() => navigate(`/admin/clients/${c.id}/edit`)}
                                  className="text-primary hover:underline text-xs mt-0.5"
                                >
                                  Lire la suite...
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              resetForm();
                              setFormData({
                                title: c.contract_type ? `Maintenance ${c.contract_type}` : 'Maintenance contractuelle',
                                description: '',
                                client_id: c.id,
                                alert_date: format(new Date(), 'yyyy-MM-dd'),
                                recurrence: 'monthly',
                                recurrence_months: c.contract_visits_per_year && c.contract_visits_per_year > 0
                                  ? Math.max(1, Math.round(12 / c.contract_visits_per_year))
                                  : 12,
                                day_of_month: null,
                              });
                              setIsDialogOpen(true);
                            }}
                            className="text-xs gap-1.5"
                          >
                            <Bell className="h-3.5 w-3.5" />
                            <span className="hidden lg:inline">Alerte</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const params = new URLSearchParams();
                              params.set('client_id', c.id);
                              params.set('title', 'Maintenance contractuelle');
                              navigate(`/admin/interventions/new?${params.toString()}`);
                            }}
                            className="text-xs gap-1.5"
                          >
                            <ClipboardList className="h-3.5 w-3.5" />
                            <span className="hidden lg:inline">Intervention</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/admin/clients/${c.id}/edit`)}
                            className="text-xs"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>



        <TabsContent value="active">
          {activeAlerts.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 rounded-full bg-muted mb-4">
                  <Bell className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-1">Aucune alerte active</h3>
                <p className="text-muted-foreground text-sm max-w-sm">
                  {hasFilters ? 'Aucun résultat ne correspond à vos filtres.' : 'Créez votre première alerte de maintenance préventive.'}
                </p>
                {!hasFilters && (
                  <Button className="mt-4" onClick={() => handleOpenDialog()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Créer une alerte
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {activeAlerts.map((alert) => {
                const urgency = getAlertUrgency(alert.alert_date);
                const cfg = statusConfig[alert.status];
                return (
                  <Card key={alert.id} className={cn(
                    "relative overflow-hidden transition-all hover:shadow-md border-l-4",
                    urgency === 'overdue' && alert.status === 'pending' && "border-l-destructive",
                    urgency === 'today' && "border-l-amber-500",
                    urgency === 'upcoming' && "border-l-blue-500",
                    urgency === 'future' && "border-l-border",
                  )}>
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        {/* Left: Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="font-semibold text-base truncate">{alert.title}</h3>
                            {getUrgencyBadge(alert.alert_date, alert.status)}
                            {(alert.recurrence_months > 0 || alert.recurrence !== 'once') && (
                              <Badge variant="outline" className="text-[10px] font-normal gap-1 py-0 h-5">
                                <RefreshCw className="h-2.5 w-2.5" />
                                {getRecurrenceLabel(alert)}
                              </Badge>
                            )}
                          </div>
                          {alert.description && (
                            <p className="text-sm text-muted-foreground line-clamp-1 mb-2">{alert.description}</p>
                          )}
                          <div className="flex items-center gap-3 flex-wrap text-sm text-muted-foreground">
                            {alert.clients?.name && (
                              <span className="font-medium text-foreground">{alert.clients.name}</span>
                            )}
                            <span className="flex items-center gap-1.5">
                              <CalendarClock className="h-3.5 w-3.5" />
                              {format(parseISO(alert.alert_date), 'dd MMM yyyy', { locale: fr })}
                            </span>
                          </div>
                        </div>


                        {/* Right: Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          <Select
                            value={alert.status}
                            onValueChange={(value: AlertStatus) => handleStatusChange(alert, value)}
                          >
                            <SelectTrigger className="w-[145px] h-9">
                              <div className="flex items-center gap-2">
                                <div className={cn("w-2 h-2 rounded-full", cfg.dot)} />
                                <span className="text-sm">{statusLabels[alert.status]}</span>
                              </div>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">En attente</SelectItem>
                              <SelectItem value="acknowledged">Pris en compte</SelectItem>
                              <SelectItem value="completed">Terminé</SelectItem>
                              <SelectItem value="dismissed">Ignoré</SelectItem>
                            </SelectContent>
                          </Select>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCreateIntervention(alert)}
                            className="text-xs gap-1.5"
                            title="Créer une intervention"
                          >
                            <ClipboardList className="h-3.5 w-3.5" />
                            <span className="hidden lg:inline">Intervention</span>
                            <ArrowRight className="h-3 w-3" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => handleOpenDialog(alert)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-9 w-9">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Supprimer l'alerte ?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Cette action est irréversible. L'alerte sera définitivement supprimée.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteAlert.mutate(alert.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Supprimer
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed">
          {completedAlerts.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 rounded-full bg-muted mb-4">
                  <CheckCircle className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-1">Aucun historique</h3>
                <p className="text-muted-foreground text-sm">Les alertes terminées ou ignorées apparaîtront ici.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {completedAlerts.map((alert) => {
                const cfg = statusConfig[alert.status];
                return (
                  <Card key={alert.id} className="opacity-70 hover:opacity-100 transition-opacity">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium truncate">{alert.title}</h3>
                            <Badge variant="secondary" className={cn("text-xs", cfg.bg, cfg.text)}>
                              {statusLabels[alert.status]}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            {alert.clients?.name && <span>{alert.clients.name}</span>}
                            <span>{format(parseISO(alert.alert_date), 'dd MMM yyyy', { locale: fr })}</span>
                            {(alert.recurrence_months > 0 || alert.recurrence !== 'once') && (
                              <span className="flex items-center gap-1">
                                <RefreshCw className="h-3 w-3" />
                                {getRecurrenceLabel(alert)}
                              </span>
                            )}
                          </div>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer l'alerte ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Cette action est irréversible.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteAlert.mutate(alert.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>

    <QuickCreateClientDialog
      open={showCreateClient}
      onOpenChange={setShowCreateClient}
      onClientCreated={(clientId) => {
        setFormData(prev => ({ ...prev, client_id: clientId }));
        setShowCreateClient(false);
      }}
    />
    </>
  );
}
