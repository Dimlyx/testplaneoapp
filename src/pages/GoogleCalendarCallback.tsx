import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

export default function GoogleCalendarCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    if (error) {
      setStatus('error');
      setMessage(error);
      return;
    }
    if (!code || !state) {
      setStatus('error');
      setMessage('Paramètres OAuth manquants');
      return;
    }

    (async () => {
      try {
        const redirectUri = `${window.location.origin}/google-calendar/callback`;
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-oauth-callback`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({ code, redirectUri, state }),
          }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.error) throw new Error(data?.error || `HTTP ${res.status}`);
        setStatus('success');
        setMessage(data?.email || '');
      } catch (e: any) {
        setStatus('error');
        setMessage(e.message ?? String(e));
      }
    })();
  }, [params]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="max-w-md w-full bg-card border rounded-xl p-6 space-y-4 text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
            <h1 className="text-lg font-semibold">Connexion à Google Agenda…</h1>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 className="h-10 w-10 mx-auto text-green-600" />
            <h1 className="text-lg font-semibold">Google Agenda connecté</h1>
            {message && <p className="text-sm text-muted-foreground">{message}</p>}
            <Button onClick={() => navigate('/technician/parametres')} className="w-full">
              Retour aux paramètres
            </Button>
          </>
        )}
        {status === 'error' && (
          <>
            <AlertTriangle className="h-10 w-10 mx-auto text-destructive" />
            <h1 className="text-lg font-semibold">Échec de la connexion</h1>
            <p className="text-sm text-muted-foreground break-words">{message}</p>
            <Button onClick={() => navigate('/technician/parametres')} className="w-full">
              Retour aux paramètres
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
