import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BellRing, Bell, Check, ExternalLink, AlarmClock } from 'lucide-react';
import { format, isPast, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

export default function ReminderAlertsWidget() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['super-admin-reminders'],
    queryFn: async () => {
      const { data: notes, error } = await supabase
        .from('organization_notes')
        .select('id, content, category, reminder_at, organization_id')
        .not('reminder_at', 'is', null)
        .eq('reminder_done', false)
        .order('reminder_at', { ascending: true })
        .limit(20);
      if (error) throw error;
      if (!notes || notes.length === 0) return [];

      const orgIds = [...new Set(notes.map(n => n.organization_id))];
      const { data: orgs } = await supabase
        .from('organizations')
        .select('id, name')
        .in('id', orgIds);
      const map = new Map((orgs || []).map(o => [o.id, o.name]));
      return notes.map(n => ({ ...n, organization_name: map.get(n.organization_id) || '—' }));
    },
    refetchInterval: 60_000,
  });

  const markDone = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('organization_notes')
        .update({ reminder_done: true })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-reminders'] });
      toast.success('Rappel marqué comme fait');
    },
    onError: (e: any) => toast.error(e.message || 'Erreur'),
  });

  const overdueCount = (data ?? []).filter(n => isPast(new Date(n.reminder_at))).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <AlarmClock className="h-4 w-4" />
            Rappels & alertes
            {overdueCount > 0 && (
              <Badge className="bg-red-500/15 text-red-700 dark:text-red-300">
                {overdueCount} en retard
              </Badge>
            )}
          </CardTitle>
          <CardDescription>Rappels créés depuis les fiches entreprises</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Aucun rappel en attente.
          </p>
        ) : (
          <ul className="divide-y">
            {data.map((n) => {
              const date = new Date(n.reminder_at);
              const overdue = isPast(date);
              return (
                <li key={n.id} className="py-2.5 flex items-start gap-3">
                  <div className={`mt-0.5 p-1.5 rounded-md ${overdue ? 'bg-red-500/15 text-red-600' : 'bg-orange-500/15 text-orange-600'}`}>
                    {overdue ? <BellRing className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <Link
                        to={`/super-admin/organizations/${n.organization_id}`}
                        className="font-semibold text-foreground inline-flex items-center gap-1"
                      >
                        {n.organization_name}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                      <span className={overdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
                        {format(date, 'd MMM yyyy à HH:mm', { locale: fr })}
                        {' · '}
                        {overdue ? 'en retard de ' : 'dans '}
                        {formatDistanceToNow(date, { locale: fr })}
                      </span>
                    </div>
                    <p className="text-sm text-foreground/90 line-clamp-2 mt-0.5">{n.content}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => markDone.mutate(n.id)}
                    disabled={markDone.isPending}
                  >
                    <Check className="h-4 w-4 mr-1" /> Fait
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
