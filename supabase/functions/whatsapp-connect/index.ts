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
      throw new Error("Variáveis de ambiente do Supabase não configuradas.");
    }

    const evolutionApiUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");

    if (!evolutionApiUrl || !evolutionApiKey) {
      throw new Error("Credenciais da Evolution API não configuradas.");
    }

    const reqBody = await req.json();
    const ministry_id = reqBody.ministry_id;
    const orgId = reqBody.organization_id || reqBody.org_id;
    const instance_name = reqBody.instance_name;
    const ministry_name = reqBody.ministry_name;

    if (!ministry_id || !orgId) {
      throw new Error("ministry_id e organization_id são obrigatórios");
    }

    // ── CORREÇÃO: Verificar JWT e papel do usuário (admin/super_admin) ─────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authorization header ausente.");
    }

    // Cliente com contexto do usuário autenticado
    const token = authHeader.replace("Bearer ", "");
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !user) {
      throw new Error("Usuário não autenticado: " + (userErr?.message || "Não encontrado"));
    }

    // Verificar se o usuário é admin da organização

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("is_admin, is_super_admin, organization_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileErr || !profile) {
      throw new Error("Perfil do usuário não encontrado.");
    }

    const isAuthorized =
      profile.is_super_admin ||
      (profile.is_admin && profile.organization_id === orgId);

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: "Acesso negado. Apenas administradores podem conectar WhatsApp." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Geração do nome da instância ──────────────────────────────────────
    let instanceName = instance_name;
    if (!instanceName) {
      const safeName = ministry_name
        ? ministry_name
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z0-9]/g, "")
            .substring(0, 25)
        : ministry_id.substring(0, 8);
      instanceName = `${safeName}-${orgId.substring(0, 5)}`;
    }

    const endpoint = `${evolutionApiUrl}/instance/create`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": evolutionApiKey,
      },
      body: JSON.stringify({
        instanceName,
        integration: "WHATSAPP-BAILEYS",
        qrcode: true,
      }),
    });

    const result = await response.json();

    // Já está conectado
    if (result.state === "open") {
      const { error: dbErr } = await supabaseAdmin.from("ministry_whatsapp").upsert({
        organization_id: org_id,
        ministry_id,
        instance_name: instanceName,
        connected:     true,
        updated_at:    new Date().toISOString(),
      }, { onConflict: "ministry_id,organization_id" });

      if (dbErr) throw dbErr;

      return new Response(
        JSON.stringify({ connected: true, instanceName }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extrai o QR Code conforme versão da Evolution API
    let qrcodeBase64: string | null = null;
    if (result.qrcode?.base64) {
      qrcodeBase64 = result.qrcode.base64;
    } else if (result.hash?.qrcode) {
      qrcodeBase64 = result.hash.qrcode;
    } else if (result.base64) {
      qrcodeBase64 = result.base64;
    }

    // Salva estado inicial no banco
    const { error: dbErr } = await supabaseAdmin.from("ministry_whatsapp").upsert({
      organization_id: org_id,
      ministry_id,
      instance_name: instanceName,
      connected:     false,
      updated_at:    new Date().toISOString(),
    }, { onConflict: "ministry_id,organization_id" });

    if (dbErr) throw dbErr;

    return new Response(
      JSON.stringify({ success: true, instanceName, qrcode: qrcodeBase64 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[whatsapp-connect] Erro:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
