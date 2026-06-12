import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Refresh an access token using the refresh_token
async function refreshAccessToken(refreshToken: string) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Refresh failed: ${JSON.stringify(data)}`);
  return data;
}

async function getValidToken(admin: any, userId: string) {
  const { data: row, error } = await admin.from('user_google_tokens')
    .select('*').eq('user_id', userId).maybeSingle();
  if (error || !row) return null;
  const now = Date.now();
  const exp = new Date(row.expires_at).getTime();
  if (exp > now + 30_000) return row;

  // refresh
  const refreshed = await refreshAccessToken(row.refresh_token);
  const newExpires = new Date(Date.now() + (refreshed.expires_in - 60) * 1000).toISOString();
  await admin.from('user_google_tokens').update({
    access_token: refreshed.access_token,
    expires_at: newExpires,
  }).eq('user_id', userId);
  return { ...row, access_token: refreshed.access_token, expires_at: newExpires };
}

function buildEvent(intervention: any, client: any) {
  const title = `[PLANEO] ${intervention.title || 'Intervention'}`;
  const lines: string[] = [];
  if (client?.name) lines.push(`Client: ${client.name}`);
  if (intervention.intervention_contact_name) lines.push(`Contact: ${intervention.intervention_contact_name}`);
  if (intervention.intervention_phone || client?.phone) lines.push(`Tél: ${intervention.intervention_phone || client?.phone}`);
  if (intervention.description) lines.push('', intervention.description);
  if (intervention.report) lines.push('', 'Rapport:', intervention.report);

  const addressParts = [
    intervention.intervention_address || client?.address,
    intervention.intervention_postal_code || client?.postal_code,
    intervention.intervention_city || client?.city,
  ].filter(Boolean);

  // Normalize a time string to HH:MM:SS (Google requires full RFC3339)
  const normTime = (t: string | null) => {
    if (!t) return null;
    const parts = t.split(':');
    if (parts.length === 2) return `${t}:00`;
    return t;
  };

  // Build start/end
  const date = intervention.scheduled_date;
  const startTime = normTime(intervention.scheduled_time);
  const endDate = intervention.scheduled_end_date || date;
  const endTime = normTime(intervention.scheduled_end_time);

  let start: any, end: any;
  if (date && startTime) {
    start = { dateTime: `${date}T${startTime}`, timeZone: 'Europe/Paris' };
    if (endDate && endTime) {
      end = { dateTime: `${endDate}T${endTime}`, timeZone: 'Europe/Paris' };
    } else {
      // default 1h
      const d = new Date(`${date}T${startTime}`);
      d.setHours(d.getHours() + 1);
      end = { dateTime: d.toISOString().slice(0, 19), timeZone: 'Europe/Paris' };
    }
  } else if (date) {
    start = { date };
    end = { date: endDate || date };
  } else {
    return null; // cannot schedule without date
  }

  return {
    summary: title,
    description: lines.join('\n'),
    location: addressParts.join(', ') || undefined,
    start, end,
  };
}

async function logSync(admin: any, params: {
  userId: string; orgId: string | null; interventionId: string | null;
  action: string; status: string; googleEventId?: string | null; errorMessage?: string | null;
}) {
  try {
    await admin.from('google_sync_logs').insert({
      user_id: params.userId,
      organization_id: params.orgId,
      intervention_id: params.interventionId,
      action: params.action,
      status: params.status,
      google_event_id: params.googleEventId || null,
      error_message: params.errorMessage || null,
    });
  } catch (_) {}
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
    const { data: claims, error: claimsError } = await supabase.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (claimsError || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json();
    const { interventionId, action } = body as { interventionId: string; action: 'upsert' | 'delete' };
    if (!interventionId || !action) {
      return new Response(JSON.stringify({ error: 'Missing interventionId or action' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load intervention (admin to bypass RLS, but ensure caller is allowed via their session)
    const { data: callerCheck } = await supabase.from('interventions')
      .select('id').eq('id', interventionId).maybeSingle();
    if (!callerCheck) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: intervention, error: iErr } = await admin.from('interventions')
      .select('*, clients(*)').eq('id', interventionId).maybeSingle();
    if (iErr || !intervention) {
      return new Response(JSON.stringify({ error: 'Intervention not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const prevUserId = intervention.google_event_user_id;
    const prevEventId = intervention.google_event_id;
    const newTechId = intervention.technician_id;

    // 1) Delete previous event if tech changed or action=delete
    if (prevEventId && prevUserId && (action === 'delete' || prevUserId !== newTechId)) {
      const oldTok = await getValidToken(admin, prevUserId);
      if (oldTok) {
        const delRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(oldTok.calendar_id)}/events/${prevEventId}`,
          { method: 'DELETE', headers: { Authorization: `Bearer ${oldTok.access_token}` } }
        );
        await logSync(admin, {
          userId: prevUserId, orgId: intervention.organization_id, interventionId,
          action: 'delete', status: delRes.ok || delRes.status === 410 || delRes.status === 404 ? 'success' : 'error',
          googleEventId: prevEventId,
          errorMessage: !delRes.ok && delRes.status !== 410 && delRes.status !== 404 ? await delRes.text() : null,
        });
      }
      await admin.from('interventions').update({
        google_event_id: null, google_event_user_id: null,
      }).eq('id', interventionId);
    }

    if (action === 'delete') {
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2) Upsert event for current tech
    if (!newTechId) {
      return new Response(JSON.stringify({ success: true, skipped: 'no_technician' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tok = await getValidToken(admin, newTechId);
    if (!tok) {
      return new Response(JSON.stringify({ success: true, skipped: 'tech_not_connected' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const event = buildEvent(intervention, intervention.clients);
    if (!event) {
      return new Response(JSON.stringify({ success: true, skipped: 'not_scheduled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let res: Response;
    const existingId = (prevUserId === newTechId) ? prevEventId : null;
    if (existingId) {
      res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(tok.calendar_id)}/events/${existingId}`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(event),
        }
      );
    } else {
      res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(tok.calendar_id)}/events`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(event),
        }
      );
    }

    const data = await res.json();
    if (!res.ok) {
      await logSync(admin, {
        userId: newTechId, orgId: intervention.organization_id, interventionId,
        action: existingId ? 'update' : 'create', status: 'error',
        errorMessage: JSON.stringify(data),
      });
      return new Response(JSON.stringify({ error: 'Google API error', details: data }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await admin.from('interventions').update({
      google_event_id: data.id, google_event_user_id: newTechId,
    }).eq('id', interventionId);

    await logSync(admin, {
      userId: newTechId, orgId: intervention.organization_id, interventionId,
      action: existingId ? 'update' : 'create', status: 'success',
      googleEventId: data.id,
    });

    return new Response(JSON.stringify({ success: true, eventId: data.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
