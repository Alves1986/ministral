import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl        = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Variáveis de ambiente não configuradas.");
    }

    const evolutionApiUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");

    if (!evolutionApiUrl || !evolutionApiKey) {
      throw new Error("Credenciais da Evolution API (URL e/ou KEY) não configuradas.");
    }

    const body = await req.json().catch(() => ({}));
    const { instance_name, ministry_id } = body;

    if (!instance_name && !ministry_id) {
      throw new Error("instance_name ou ministry_id é obrigatório");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── SEGURANÇA: Validar se a instância pertence à organização e verificar JWT (SEC-02) ──
    let query = supabase.from("ministry_whatsapp").select("instance_name, organization_id");
    
    if (instance_name) {
      query = query.eq("instance_name", instance_name);
    } else {
      query = query.eq("ministry_id", ministry_id);
    }

    const { data: mwa, error: mwaErr } = await query.maybeSingle();

    if (mwaErr || !mwa) {
      throw new Error("Instância WhatsApp não vinculada a nenhum ministério cadastrado.");
    }

    const currentInstanceName = instance_name || mwa.instance_name;
    const targetOrgId = mwa.organization_id;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authorization header ausente.");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) {
      throw new Error("Usuário não autenticado: " + (userErr?.message || "Não encontrado"));
    }

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("is_admin, is_super_admin, organization_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileErr || !profile) {
      throw new Error("Perfil do usuário não encontrado.");
    }

    const isAuthorized =
      profile.is_super_admin ||
      (profile.is_admin && profile.organization_id === targetOrgId);

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: "Acesso negado. Administrador requerido para consultar status." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Executa a consulta de status física na Evolution API ──
    const cleanApiUrl = evolutionApiUrl.trim().replace(/\/+$/, "");
    const cleanInstance = currentInstanceName ? currentInstanceName.trim().replace(/^\/+|\/+$/g, "") : "";
    if (!cleanInstance) throw new Error("Instância inválida.");
    const endpoint = `${cleanApiUrl}/instance/connectionState/${cleanInstance}`;
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        "apikey": evolutionApiKey,
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Erro ao consultar a Evolution API (${response.status}): ${body}`);
    }

    const result = await response.json();

    // instance usually returns state -> 'open', 'close', 'connecting'
    const state = result.instance?.state || result.state;

    if (state === "open") {
      const phone = result.instance?.owner || result.owner || "";

      await supabase.from("ministry_whatsapp").update({
        connected:    true,
        phone_number: phone,
        updated_at:   new Date().toISOString(),
      }).eq("instance_name", currentInstanceName);

      return new Response(
        JSON.stringify({ state: "open", phone }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ state }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[whatsapp-status] Erro:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
