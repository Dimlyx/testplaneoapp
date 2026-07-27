import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Calendar, Loader2, CheckCircle2, AlertTriangle, Moon, Sun, Bell } from 'lucide-react';
import { useTheme } from 'next-themes';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/hooks/use-toast';
import {
  getOneSignalDiagnostics,
  repairOneSignalBinding,
  type OneSignalDiagnostics,
} from '@/lib/onesignal';

type TokenRow = { google_email: string; calendar_id: string; updated_at: string };

export default function TechnicianSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState<TokenRow | null>(null);
  const [diag, setDiag] = useState<OneSignalDiagnostics | null>(null);
  const [pushBusy, setPushBusy] = useState(false);

  const refreshDiag = async () => setDiag(await getOneSignalDiagnostics());
  useEffect(() => { refreshDiag(); }, [user]);

  const repairPush = async () => {
    if (!user) return;
    setPushBusy(true);
    try {
      const ok = await repairOneSignalBinding(user.id);
      toast({
        title: ok ? 'Notifications activées' : 'Activation incomplète',
        description: ok
          ? 'Votre appareil est bien lié à votre compte.'
          : "Vérifiez que les notifications sont autorisées pour PLANEO dans les réglages du téléphone.",
        variant: ok ? undefined : 'destructive',
      });
    } finally {
      await refreshDiag();
      setPushBusy(false);
    }
  };


  const fetchToken = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('user_google_tokens')
      .select('google_email, calendar_id, updated_at')
      .eq('user_id', user.id)
      .maybeSingle();
    setToken(data ?? null);
    setLoading(false);
  };

  useEffect(() => { fetchToken(); }, [user]);

  const connect = async () => {
    try {
      setBusy(true);
      const { data, error } = await supabase.functions.invoke('google-oauth-init', {
        body: { redirectOrigin: window.location.origin },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message ?? String(e), variant: 'destructive' });
      setBusy(false);
    }
  };

  const disconnect = async () => {
    try {
      setBusy(true);
      const { error } = await supabase.functions.invoke('google-oauth-disconnect', { body: {} });
      if (error) throw error;
      toast({ title: 'Google Agenda déconnecté' });
      await fetchToken();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message ?? String(e), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Paramètres</h1>
        <p className="text-sm text-muted-foreground">Gérer vos intégrations personnelles</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              {theme === 'dark' ? (
                <Moon className="h-5 w-5 text-primary" />
              ) : (
                <Sun className="h-5 w-5 text-primary" />
              )}
            </div>
            <div>
              <CardTitle>Apparence</CardTitle>
              <CardDescription>
                Basculer entre le mode clair et le mode sombre.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Mode sombre</span>
            <Switch
              checked={theme === 'dark'}
              onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
              aria-label="Basculer le mode sombre"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Google Agenda</CardTitle>
              <CardDescription>
                Synchroniser automatiquement vos interventions vers votre agenda Google.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
            </div>
          ) : token ? (
            <>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium">Connecté</p>
                  <p className="text-muted-foreground">Compte&nbsp;: {token.google_email}</p>
                  <p className="text-muted-foreground">Agenda&nbsp;: {token.calendar_id}</p>
                </div>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Vos interventions assignées seront créées dans votre Google Agenda.</p>
                <p>• Toute modification (date, heure, lieu) est répercutée automatiquement.</p>
                <p>• La suppression d'une intervention supprime l'événement Google.</p>
              </div>
              <Button variant="destructive" onClick={disconnect} disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Déconnecter Google Agenda
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 border">
                <AlertTriangle className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="text-sm text-muted-foreground">
                  Aucun compte Google connecté. Connectez votre Google Agenda pour recevoir
                  automatiquement vos interventions PLANEO comme événements.
                </div>
              </div>
              <Button onClick={connect} disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Connecter mon Google Agenda
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
