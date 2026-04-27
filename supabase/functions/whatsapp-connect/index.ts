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
      throw new Error("Variáveis de ambiente do Supabase não configuradas.");
    }

    const evolutionApiUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");

    if (!evolutionApiUrl || !evolutionApiKey) {
      throw new Error("Credenciais da Evolution API não configuradas.");
    }

    const { ministry_id, org_id, instance_name, ministry_name } = await req.json();

    if (!ministry_id || !org_id) {
       throw new Error("ministry_id e org_id são obrigatórios");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Check if the user is authenticated and is admin/leader (could optionally check JWT here for more security)
    
    let instanceName = instance_name;
    if (!instanceName) {
      const safeName = ministry_name 
        ? ministry_name.toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '')
            .substring(0, 20)
        : ministry_id.substring(0, 8);
      instanceName = `min-${safeName}-${org_id.substring(0, 6)}`;
    }

    const endpoint = `${evolutionApiUrl}/instance/create`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey
      },
      body: JSON.stringify({
        instanceName,
        integration: "WHATSAPP-BAILEYS",
        qrcode: true
      })
    });

    const result = await response.json();
    
    // Check if it's already connected
    if (result.state === 'open') {
        const { error: dbErr } = await supabase.from('ministry_whatsapp').upsert({
            org_id,
            ministry_id,
            instance_name: instanceName,
            connected: true,
            updated_at: new Date().toISOString()
        }, { onConflict: 'ministry_id' });

        if (dbErr) throw dbErr;
        
        return new Response(JSON.stringify({ connected: true, instanceName }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let qrcodeBase64 = null;
    
    // Evolution API might return qrcode inside base64 or qrcode object
    if (result.qrcode?.base64) {
        qrcodeBase64 = result.qrcode.base64;
    } else if (result.hash?.qrcode) {
        qrcodeBase64 = result.hash.qrcode; // different version of evolution API
    } else if (result.base64) {
        qrcodeBase64 = result.base64;
    }

    // Save initial state to DB
    const { error: dbErr } = await supabase.from('ministry_whatsapp').upsert({
        org_id,
        ministry_id,
        instance_name: instanceName,
        connected: false,
        updated_at: new Date().toISOString()
    }, { onConflict: 'ministry_id' });

    if (dbErr) throw dbErr;

    return new Response(JSON.stringify({ 
      success: true, 
      instanceName, 
      qrcode: qrcodeBase64 
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    
  } catch (error: any) {
    console.error("Erro no Edge Function:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
