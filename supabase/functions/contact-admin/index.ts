import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non authentifié" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Non authentifié" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { message } = await req.json();
    if (!message || typeof message !== "string" || message.trim().length < 5) {
      return new Response(JSON.stringify({ error: "Message trop court" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (message.length > 5000) {
      return new Response(JSON.stringify({ error: "Message trop long" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch profile + org info
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .maybeSingle();

    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: roleRow } = await service
      .from("user_roles")
      .select("role, organization_id, organizations(name)")
      .eq("user_id", user.id)
      .maybeSingle();

    const senderName = profile?.full_name || user.email || "Utilisateur";
    const senderEmail = profile?.email || user.email || "inconnu";
    const orgName = (roleRow as any)?.organizations?.name || "—";
    const role = (roleRow as any)?.role || "—";

    const escapedMsg = message
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");

    const htmlContent = `
      <h2>Nouveau message depuis l'assistant PLANEO</h2>
      <p><strong>De :</strong> ${senderName} (${senderEmail})</p>
      <p><strong>Entreprise :</strong> ${orgName}</p>
      <p><strong>Rôle :</strong> ${role}</p>
      <hr>
      <p>${escapedMsg}</p>
    `;

    const brevoKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoKey) throw new Error("BREVO_API_KEY manquant");

    const resp = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": brevoKey,
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: "Assistant PLANEO", email: "contact@planeo.tech" },
        to: [{ email: "contact@planeo.tech", name: "Support PLANEO" }],
        replyTo: { email: senderEmail, name: senderName },
        subject: `[PLANEO] Message de ${senderName} (${orgName})`,
        htmlContent,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Brevo error:", errText);
      throw new Error("Échec de l'envoi de l'email");
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("contact-admin error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
