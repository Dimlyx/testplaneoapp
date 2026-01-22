import { useState, useEffect } from 'react';
import { useMaintenanceAlerts, useCreateMaintenanceAlert, useUpdateMaintenanceAlert, useDeleteMaintenanceAlert, MaintenanceAlert, AlertRecurrence, AlertStatus } from '@/hooks/useMaintenanceAlerts';
import { useClients } from '@/hooks/useClients';
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
import { Bell, Plus, Edit, Trash2, Calendar, RefreshCw, CheckCircle, Clock, XCircle, AlertTriangle } from 'lucide-react';
import { format, parseISO, isPast, isToday, isFuture, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const recurrenceLabels: Record<AlertRecurrence, string> = {
  once: 'Une fois',
  weekly: 'Hebdomadaire',
  monthly: 'Mensuel',
  quarterly: 'Trimestriel',
  yearly: 'Annuel',
};

const statusLabels: Record<AlertStatus, string> = {
  pending: 'En attente',
  acknowledged: 'Pris en compte',
  completed: 'Terminé',
  dismissed: 'Ignoré',
};

const statusColors: Record<AlertStatus, string> = {
  pending: 'bg-amber-500',
  acknowledged: 'bg-blue-500',
  completed: 'bg-green-500',
  dismissed: 'bg-gray-500',
};

interface AlertFormData {
  title: string;
  description: string;
  client_id: string;
  alert_date: string;
  recurrence: AlertRecurrence;
}

export default function MaintenanceAlerts() {
  const queryClient = useQueryClient();
  const { data: alerts = [], isLoading } = useMaintenanceAlerts();
  const { data: clients = [] } = useClients();
  const createAlert = useCreateMaintenanceAlert();
  const updateAlert = useUpdateMaintenanceAlert();
  const deleteAlert = useDeleteMaintenanceAlert();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState<MaintenanceAlert | null>(null);
  const [formData, setFormData] = useState<AlertFormData>({
    title: '',
    description: '',
    client_id: '',
    alert_date: format(new Date(), 'yyyy-MM-dd'),
    recurrence: 'once',
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
      recurrence: 'once',
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
      recurrence: formData.recurrence,
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

  const getAlertUrgency = (alertDate: string) => {
    const date = parseISO(alertDate);
    if (isPast(date) && !isToday(date)) return 'overdue';
    if (isToday(date)) return 'today';
    if (isFuture(date) && date <= addDays(new Date(), 7)) return 'upcoming';
    return 'future';
  };

  const urgencyBadge = (alertDate: string, status: AlertStatus) => {
    if (status === 'completed' || status === 'dismissed') return null;
    
    const urgency = getAlertUrgency(alertDate);
    switch (urgency) {
      case 'overdue':
        return <Badge variant="destructive" className="ml-2">En retard</Badge>;
      case 'today':
        return <Badge className="ml-2 bg-amber-500">Aujourd'hui</Badge>;
      case 'upcoming':
        return <Badge variant="secondary" className="ml-2">Cette semaine</Badge>;
      default:
        return null;
    }
  };

  // Filter alerts by status
  const pendingAlerts = alerts.filter(a => a.status === 'pending');
  const acknowledgedAlerts = alerts.filter(a => a.status === 'acknowledged');
  const completedAlerts = alerts.filter(a => a.status === 'completed' || a.status === 'dismissed');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Bell className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Alertes Maintenance</h1>
            <p className="text-muted-foreground">Gestion des alertes de maintenance préventive</p>
          </div>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
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
                <Select
                  value={formData.client_id}
                  onValueChange={(value) => setFormData({ ...formData, client_id: value })}
                >
                  <SelectTrigger>
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
                  <Label htmlFor="recurrence">Récurrence</Label>
                  <Select
                    value={formData.recurrence}
                    onValueChange={(value: AlertRecurrence) => setFormData({ ...formData, recurrence: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="once">Une fois</SelectItem>
                      <SelectItem value="weekly">Hebdomadaire</SelectItem>
                      <SelectItem value="monthly">Mensuel</SelectItem>
                      <SelectItem value="quarterly">Trimestriel</SelectItem>
                      <SelectItem value="yearly">Annuel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

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

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En attente</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingAlerts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pris en compte</CardTitle>
            <AlertTriangle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{acknowledgedAlerts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En retard</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {alerts.filter(a => a.status === 'pending' && getAlertUrgency(a.alert_date) === 'overdue').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Terminées</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedAlerts.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts table */}
      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">
            Actives ({pendingAlerts.length + acknowledgedAlerts.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Historique ({completedAlerts.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Alerte</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Récurrence</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...pendingAlerts, ...acknowledgedAlerts].length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Aucune alerte active
                      </TableCell>
                    </TableRow>
                  ) : (
                    [...pendingAlerts, ...acknowledgedAlerts]
                      .sort((a, b) => new Date(a.alert_date).getTime() - new Date(b.alert_date).getTime())
                      .map((alert) => (
                        <TableRow key={alert.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{alert.title}</p>
                              {alert.description && (
                                <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                                  {alert.description}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {alert.clients?.name || <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                              {format(parseISO(alert.alert_date), 'dd MMM yyyy', { locale: fr })}
                              {urgencyBadge(alert.alert_date, alert.status)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {alert.recurrence !== 'once' && (
                                <RefreshCw className="h-3 w-3 text-muted-foreground" />
                              )}
                              {recurrenceLabels[alert.recurrence]}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={alert.status}
                              onValueChange={(value: AlertStatus) => handleStatusChange(alert, value)}
                            >
                              <SelectTrigger className="w-[140px]">
                                <div className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full ${statusColors[alert.status]}`} />
                                  {statusLabels[alert.status]}
                                </div>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">En attente</SelectItem>
                                <SelectItem value="acknowledged">Pris en compte</SelectItem>
                                <SelectItem value="completed">Terminé</SelectItem>
                                <SelectItem value="dismissed">Ignoré</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenDialog(alert)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon">
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
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Alerte</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Récurrence</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completedAlerts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Aucune alerte dans l'historique
                      </TableCell>
                    </TableRow>
                  ) : (
                    completedAlerts.map((alert) => (
                      <TableRow key={alert.id} className="opacity-60">
                        <TableCell>
                          <div>
                            <p className="font-medium">{alert.title}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {alert.clients?.name || <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell>
                          {format(parseISO(alert.alert_date), 'dd MMM yyyy', { locale: fr })}
                        </TableCell>
                        <TableCell>{recurrenceLabels[alert.recurrence]}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={statusColors[alert.status]}>
                            {statusLabels[alert.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
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
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
