import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Tu es l'assistant IA de PLANEO, une application de gestion d'interventions techniques. Tu aides les utilisateurs (administrateurs et techniciens) à utiliser l'application.

Voici les fonctionnalités principales de PLANEO :
- **Interventions** : Créer, planifier et suivre des interventions techniques. Chaque intervention a un client, un type, un technicien assigné, une date et une heure prévues.
- **Clients** : Gérer les clients (particuliers ou professionnels) avec leurs coordonnées, équipements et historique d'interventions.
- **Équipements** : Suivre les équipements installés chez les clients (marque, modèle, numéro de série).
- **Calendrier** : Vue calendrier pour planifier les interventions par technicien et par semaine.
- **Alertes de maintenance** : Configurer des alertes récurrentes pour la maintenance préventive.
- **Statistiques** : Tableau de bord avec les performances et indicateurs clés.
- **Workflow** : Étapes personnalisables par type d'intervention que les techniciens doivent suivre.
- **Types d'intervention** : Configurer différents types avec des options comme le suivi de trajet et la boucle équipements.

Pour les techniciens :
- Voir leurs interventions assignées
- Suivre le workflow étape par étape
- Prendre des photos, ajouter des commentaires
- Faire signer le client
- Marquer l'arrivée et le départ

Réponds toujours en français, de manière concise et utile. Si tu ne connais pas la réponse, dis-le honnêtement.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...messages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Trop de requêtes, réessayez dans un instant." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Crédits IA épuisés." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "Erreur du service IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
