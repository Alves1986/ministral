import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { generateOrientationsWithAI } from "../whatsapp-reminders/ai-service.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const { ministryName, ministryType } = await req.json();
    const openRouterApiKey = Deno.env.get("OPENROUTER_API_KEY");

    if (!ministryName || !ministryType) {
      return new Response(JSON.stringify({ error: "Missing ministryName or ministryType" }), { status: 400, headers: corsHeaders });
    }

    if (!openRouterApiKey) {
        return new Response(JSON.stringify({ error: "API key not configured." }), { status: 500, headers: corsHeaders });
    }

    const instructions = await generateOrientationsWithAI(ministryName, ministryType, openRouterApiKey);

    return new Response(JSON.stringify({ instructions }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Error generating instructions:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
