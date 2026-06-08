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
    
    // Fallback caso a instance name não esteja na ENV
    const instanceName = Deno.env.get("EVOLUTION_INSTANCE_NAME") || "ministral-global-v2";

    if (!evolutionApiUrl || !evolutionApiKey) {
      throw new Error("Credenciais da Evolution API não configuradas no Supabase Secrets.");
    }

    evolutionApiUrl = evolutionApiUrl.replace(/\/+$/, "");

    const typebotPayload = {
      enabled: true,
      url: "https://typebot.co",
      typebot: "ministral-confirma-o-de-escala-5uucq2t",
      expire: 20,
      keywordFinish: "#SAIR",
      delayMessage: 1000,
      triggerType: "keyword",
      triggerOperator: "contains",
      triggerValue: "ministral",
      unknownMessage: "",
      listeningFromMe: false,
      stopBotFromMe: false,
      keepOpen: false,
      debounceTime: 10
    };

    const endpoint = `${evolutionApiUrl}/typebot/create/${instanceName}`;

    console.log(`Configurando Typebot na URL: ${endpoint}`);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": evolutionApiKey,
      },
      body: JSON.stringify(typebotPayload),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(`Falha na Evolution API: ${JSON.stringify(result)}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Typebot configurado com sucesso!", result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
