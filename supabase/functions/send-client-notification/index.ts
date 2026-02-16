import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY');
    if (!BREVO_API_KEY) {
      throw new Error('BREVO_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { interventionId } = await req.json();
    if (!interventionId) {
      throw new Error('interventionId is required');
    }

    // Fetch intervention with client info
    const { data: intervention, error: intError } = await supabase
      .from('interventions')
      .select('*, clients(name, email)')
      .eq('id', interventionId)
      .single();

    if (intError || !intervention) {
      throw new Error('Intervention not found');
    }

    // Use intervention-specific email or client email
    const recipientEmail = intervention.intervention_email || intervention.clients?.email;
    if (!recipientEmail) {
      throw new Error('Aucun email disponible pour ce client ou cette intervention');
    }

    const recipientName = intervention.intervention_contact_name || intervention.clients?.name || 'Client';

    // Format date
    const scheduledDate = intervention.scheduled_date 
      ? new Date(intervention.scheduled_date).toLocaleDateString('fr-FR', { 
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        })
      : 'Date non définie';

    const scheduledTime = intervention.scheduled_time 
      ? intervention.scheduled_time.substring(0, 5)
      : null;

    // Fetch organization info for branding
    const { data: org } = await supabase
      .from('organizations')
      .select('name, email, phone')
      .eq('id', intervention.organization_id)
      .single();

    const orgName = org?.name || 'Notre entreprise';
    const orgEmail = org?.email || '';
    const orgPhone = org?.phone || '';

    // Build address
    const addressParts = [
      intervention.intervention_address,
      intervention.intervention_building ? `Bâtiment ${intervention.intervention_building}` : null,
      intervention.intervention_floor ? `Étage ${intervention.intervention_floor}` : null,
      [intervention.intervention_postal_code, intervention.intervention_city].filter(Boolean).join(' '),
    ].filter(Boolean);

    const addressHtml = addressParts.length > 0 
      ? `<p style="margin: 0; color: #374151;">${addressParts.join('<br>')}</p>`
      : '';

    const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="background: #003057; padding: 24px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 22px;">${orgName}</h1>
      </div>
      <div style="padding: 32px 24px;">
        <p style="color: #374151; font-size: 16px;">Bonjour ${recipientName},</p>
        <p style="color: #374151; font-size: 16px;">Nous vous informons qu'une intervention a été planifiée :</p>
        
        <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <h2 style="margin: 0 0 12px 0; color: #111827; font-size: 18px;">${intervention.title}</h2>
          <p style="margin: 0 0 8px 0; color: #374151;">
            📅 <strong>${scheduledDate}</strong>${scheduledTime ? ` à <strong>${scheduledTime}</strong>` : ''}
          </p>
          ${addressHtml ? `<div style="margin-top: 8px;">📍 ${addressHtml}</div>` : ''}
        </div>

        ${intervention.description ? `<p style="color: #6b7280; font-size: 14px;">${intervention.description}</p>` : ''}
        
        <p style="color: #374151; font-size: 16px;">N'hésitez pas à nous contacter pour toute question.</p>
        <p style="color: #374151; font-size: 16px;">Cordialement,<br><strong>${orgName}</strong></p>
      </div>
      <div style="background: #f9fafb; padding: 16px 24px; text-align: center; font-size: 12px; color: #9ca3af;">
        ${orgEmail ? `<p style="margin: 0;">${orgEmail}</p>` : ''}
        ${orgPhone ? `<p style="margin: 0;">${orgPhone}</p>` : ''}
      </div>
    </div>`;

    // Send email via Brevo
    const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: orgName, email: 'noreply@planeo.tech' },
        to: [{ email: recipientEmail, name: recipientName }],
        subject: `Intervention planifiée - ${intervention.title}`,
        htmlContent: emailHtml,
      }),
    });

    const brevoData = await brevoResponse.json();

    if (!brevoResponse.ok) {
      console.error('Brevo error:', brevoData);
      throw new Error(`Erreur Brevo: ${brevoData.message || JSON.stringify(brevoData)}`);
    }

    return new Response(JSON.stringify({ success: true, messageId: brevoData.messageId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error sending notification:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
