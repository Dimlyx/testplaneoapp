import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function hmacSign(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  const b = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return b.replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = claims.claims.sub;
    const { redirectOrigin } = await req.json().catch(() => ({ redirectOrigin: null }));
    const origin = redirectOrigin || 'https://app.planeo.tech';

    const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
    if (!clientId) {
      return new Response(JSON.stringify({ error: 'GOOGLE_OAUTH_CLIENT_ID manquant' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Signed state so the callback doesn't need an authenticated session
    // (the OAuth redirect may land in a different browser/webview without it).
    const issuedAt = Date.now();
    const payload = `${userId}|${origin}|${issuedAt}`;
    const payloadB64 = btoa(payload).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    const sig = await hmacSign(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, payloadB64);
    const state = `${payloadB64}.${sig}`;

    const redirectUri = `${origin}/google-calendar/callback`;

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/calendar.events openid email',
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    return new Response(JSON.stringify({ url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
