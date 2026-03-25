import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID');
    if (!ONESIGNAL_APP_ID) {
      throw new Error('ONESIGNAL_APP_ID is not configured');
    }

    const ONESIGNAL_API_KEY = Deno.env.get('ONESIGNAL_API_KEY');
    if (!ONESIGNAL_API_KEY) {
      throw new Error('ONESIGNAL_API_KEY is not configured');
    }

    const { userId, title, message, interventionId } = await req.json();

    if (!userId || !title) {
      return new Response(
        JSON.stringify({ error: 'userId and title are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build the notification payload targeting the user by external_id (user UUID)
    const payload: Record<string, unknown> = {
      app_id: ONESIGNAL_APP_ID,
      target_channel: "push",
      include_aliases: {
        external_id: [userId],
      },
      headings: { en: title },
      contents: { en: message || title },
    };

    // Add deep link data if intervention_id is provided
    if (interventionId) {
      payload.data = {
        targetUrl: `/technician/intervention/${interventionId}`,
      };
    }

    const response = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${ONESIGNAL_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('OneSignal API error:', JSON.stringify(data));
      throw new Error(`OneSignal API error [${response.status}]: ${JSON.stringify(data)}`);
    }

    const errors = Array.isArray(data?.errors)
      ? data.errors.map((entry: unknown) => String(entry))
      : [];

    const recipients = typeof data?.recipients === 'number' ? data.recipients : null;
    const hasNoSubscribedDevice = errors.some((entry) =>
      entry.toLowerCase().includes('not subscribed')
    );

    if (hasNoSubscribedDevice || recipients === 0) {
      console.warn('Push rejected: no subscribed device for external_id', JSON.stringify(data));
      return new Response(
        JSON.stringify({
          error: 'No subscribed OneSignal device for this user',
          details: data,
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (errors.length > 0) {
      console.error('OneSignal delivery errors:', JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: 'OneSignal delivery error', details: data }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Push notification sent successfully:', JSON.stringify(data));

    return new Response(
      JSON.stringify({ success: true, onesignal_id: data.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error sending push notification:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
