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

    // ── Validação de autorização — apenas super_admin pode conectar instância global ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authorization header ausente.");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");

    const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !user) {
      throw new Error("Usuário não autenticado: " + (userErr?.message || "Não encontrado"));
    }

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("is_super_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (profileErr || !profile) {
      throw new Error("Perfil do usuário não encontrado.");
    }

    if (!profile.is_super_admin) {
      return new Response(
        JSON.stringify({ error: "Acesso negado. Apenas super administradores podem conectar instâncias WhatsApp globais." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Parâmetros opcionais do body ──
    const reqBody = await req.json().catch(() => ({}));
    const action: string | undefined = reqBody.action;
    const instance_name: string | undefined = reqBody.instance_name;

    // ── action='list': retorna todas as instâncias existentes na Evolution API ──
    if (action === "list") {
      const fetchEndpoint = `${evolutionApiUrl}/instance/fetchInstances`;
      const fetchResponse = await fetch(fetchEndpoint, {
        method: "GET",
        headers: { "apikey": evolutionApiKey },
      });

      if (!fetchResponse.ok) {
        return new Response(
          JSON.stringify({ instances: [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const raw = await fetchResponse.json();
      const list = Array.isArray(raw) ? raw : [];
      const instances = list.map((i: any) => ({
        instanceName: i.instance?.instanceName || i.instanceName || i.name || "desconhecido",
        state: i.instance?.state || i.state || "close",
        phone: i.instance?.owner || i.owner || undefined,
      }));

      return new Response(
        JSON.stringify({ instances }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Nome da instância global do sistema
    const instanceName = instance_name || "ministral-global";

    // ── Verifica se a instância já existe na Evolution API ──
    const fetchEndpoint = `${evolutionApiUrl}/instance/fetchInstances`;
    const fetchResponse = await fetch(fetchEndpoint, {
      method: "GET",
      headers: { "apikey": evolutionApiKey },
    });

    if (fetchResponse.ok) {
      const instances = await fetchResponse.json();
      const existing = Array.isArray(instances)
        ? instances.find((i: any) => i.instance?.instanceName === instanceName || i.name === instanceName)
        : null;

      if (existing) {
        const state = existing.instance?.state || existing.state;
        if (state === "open") {
          return new Response(
            JSON.stringify({ connected: true, instanceName, state }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        // Instância existe mas não está conectada — tenta buscar QR Code
        const qrEndpoint = `${evolutionApiUrl}/instance/connect/${instanceName}`;
        const qrResponse = await fetch(qrEndpoint, {
          method: "GET",
          headers: { "apikey": evolutionApiKey },
        });
        if (qrResponse.ok) {
          const qrResult = await qrResponse.json();
          const qrcodeBase64 =
            qrResult.qrcode?.base64 ||
            qrResult.base64 ||
            qrResult.qr ||
            null;
          return new Response(
            JSON.stringify({ success: true, instanceName, qrcode: qrcodeBase64, state }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // ── Cria nova instância na Evolution API ──
    const createEndpoint = `${evolutionApiUrl}/instance/create`;
    const createResponse = await fetch(createEndpoint, {
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

    const result = await createResponse.json();

    // Já conectado
    if (result.instance?.state === "open" || result.state === "open") {
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

    return new Response(
      JSON.stringify({ success: true, instanceName, qrcode: qrcodeBase64 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[whatsapp-connect] Erro:", error);
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
