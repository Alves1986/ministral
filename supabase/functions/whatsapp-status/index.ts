import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Variáveis de ambiente não configuradas.");
    }

    const evolutionApiUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");

    const { instance_name } = await req.json();

    if (!instance_name) {
       throw new Error("instance_name é obrigatório");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const endpoint = `${evolutionApiUrl}/instance/connectionState/${instance_name}`;
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'apikey': evolutionApiKey as string
      }
    });

    if (!response.ok) {
        throw new Error("Erro ao consultar a Evolution API");
    }

    const result = await response.json();
    
    // instance usually returns state -> 'open', 'close', 'connecting'
    const state = result.instance?.state || result.state;
    
    if (state === 'open') {
        const phone = result.instance?.owner || result.owner || '';
        
        await supabase.from('ministry_whatsapp').update({
            connected: true,
            phone_number: phone,
            updated_at: new Date().toISOString()
        }).eq('instance_name', instance_name);

        return new Response(JSON.stringify({ state: 'open', phone }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ state }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    
  } catch (error: any) {
    console.error("Erro no Edge Function:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
