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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email, redirectTo } = await req.json();
    if (!email) {
      throw new Error('email is required');
    }

    // Generate a password reset link via admin API
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: redirectTo || undefined,
      },
    });

    if (linkError) {
      // Don't reveal if the email exists or not
      console.error('Generate link error:', linkError.message);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // The generated link contains the token
    const resetLink = linkData?.properties?.action_link;
    if (!resetLink) {
      console.error('No action_link in response');
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user's profile to find their organization
    const userId = linkData.user?.id;
    let orgName = 'PLANEO';

    if (userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', userId)
        .maybeSingle();

      if (profile?.organization_id) {
        const { data: org } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', profile.organization_id)
          .maybeSingle();
        if (org?.name) orgName = org.name;
      }
    }

    const userName = linkData.user?.user_metadata?.full_name || linkData.user?.email || '';

    // Build the email HTML
    const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="background: #003057; padding: 24px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 22px;">PLANEO</h1>
      </div>
      <div style="padding: 32px 24px;">
        <p style="color: #374151; font-size: 16px;">Bonjour${userName ? ` ${userName}` : ''},</p>
        <p style="color: #374151; font-size: 16px;">
          Vous avez demandé la réinitialisation de votre mot de passe sur <strong>${orgName}</strong>.
        </p>
        <p style="color: #374151; font-size: 16px;">
          Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe :
        </p>
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetLink}" 
             style="display: inline-block; background: #003057; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: bold;">
            Réinitialiser mon mot de passe
          </a>
        </div>

        <p style="color: #6b7280; font-size: 14px;">
          Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email. Votre mot de passe restera inchangé.
        </p>
        <p style="color: #6b7280; font-size: 14px;">
          Ce lien est valable pendant 24 heures.
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        
        <p style="color: #9ca3af; font-size: 12px;">
          Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :<br>
          <a href="${resetLink}" style="color: #003057; word-break: break-all;">${resetLink}</a>
        </p>
      </div>
      <div style="background: #f9fafb; padding: 16px 24px; text-align: center; font-size: 12px; color: #9ca3af;">
        <p style="margin: 0;">© PLANEO - Gestion des interventions SAV</p>
        <p style="margin: 4px 0 0 0;">contact@planeo.tech</p>
      </div>
    </div>`;

    // Send via Brevo
    const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'PLANEO', email: 'noreply@planeo.tech' },
        to: [{ email, name: userName || email }],
        subject: 'Réinitialisation de votre mot de passe - PLANEO',
        htmlContent: emailHtml,
      }),
    });

    const brevoData = await brevoResponse.json();
    if (!brevoResponse.ok) {
      console.error('Brevo error:', brevoData);
      throw new Error(`Erreur Brevo: ${brevoData.message || JSON.stringify(brevoData)}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error sending reset password email:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
