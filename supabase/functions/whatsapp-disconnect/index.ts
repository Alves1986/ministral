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
      throw new Error("Variáveis do Supabase não configuradas.");
    }

    const evolutionApiUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");

    const { instance_name, ministry_id } = await req.json();

    if (!instance_name || !ministry_id) {
       throw new Error("instance_name e ministry_id são obrigatórios");
    }

    const endpoint = `${evolutionApiUrl}/instance/delete/${instance_name}`;
    await fetch(endpoint, {
      method: 'DELETE',
      headers: {
        'apikey': evolutionApiKey as string
      }
    });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    await supabase.from('ministry_whatsapp').update({
        connected: false,
        phone_number: null,
        updated_at: new Date().toISOString()
    }).eq('ministry_id', ministry_id);

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    
  } catch (error: any) {
    console.error("Erro no Edge Function:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
