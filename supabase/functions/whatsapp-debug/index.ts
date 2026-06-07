import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    let evolutionApiUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");

    if (!evolutionApiUrl || !evolutionApiKey) {
      throw new Error("Credenciais da Evolution API não configuradas.");
    }
    
    evolutionApiUrl = evolutionApiUrl.replace(/\/+$/, "");

    const reqBody = await req.json();
    const { endpoint, method = "GET", body } = reqBody;

    const res = await fetch(`${evolutionApiUrl}${endpoint}`, {
      method,
      headers: {
        "apikey": evolutionApiKey,
        "Content-Type": "application/json"
      },
      body: body ? JSON.stringify(body) : undefined
    });

    const status = res.status;
    const text = await res.text();

    return new Response(
      JSON.stringify({ status, text }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
