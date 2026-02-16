import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useUserOrganization';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Megaphone, X } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export function AnnouncementBanner() {
  const { user } = useAuth();
  const { data: organizationId } = useUserOrganization();
  const queryClient = useQueryClient();

  const { data: unreadAnnouncements = [] } = useQuery({
    queryKey: ['unread-announcements', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      // Get all announcements targeting this org
      const { data: announcements, error: annError } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });
      if (annError) throw annError;

      // Filter to relevant announcements
      const relevant = (announcements || []).filter(a =>
        a.target_type === 'all' || (a.target_organization_ids || []).includes(organizationId)
      );

      if (relevant.length === 0) return [];

      // Get reads for this org
      const { data: reads, error: readError } = await supabase
        .from('announcement_reads')
        .select('announcement_id')
        .eq('organization_id', organizationId);
      if (readError) throw readError;

      const readIds = new Set((reads || []).map(r => r.announcement_id));
      return relevant.filter(a => !readIds.has(a.id));
    },
    enabled: !!organizationId,
  });

  const markReadMutation = useMutation({
    mutationFn: async (announcementId: string) => {
      if (!organizationId || !user?.id) return;
      const { error } = await supabase.from('announcement_reads').insert({
        announcement_id: announcementId,
        organization_id: organizationId,
        read_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unread-announcements'] });
    },
  });

  if (unreadAnnouncements.length === 0) return null;

  return (
    <div className="space-y-3">
      {unreadAnnouncements.map(ann => (
        <Card key={ann.id} className="border-2 border-primary bg-primary/5 animate-in fade-in slide-in-from-top-2 duration-300">
          <CardContent className="py-4 px-5">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-primary/10 shrink-0 mt-0.5">
                <Megaphone className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-foreground">{ann.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(ann.created_at), 'dd MMMM yyyy', { locale: fr })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => markReadMutation.mutate(ann.id)}
                    title="Marquer comme lu"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-foreground/80 mt-2 whitespace-pre-wrap">{ann.content}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
