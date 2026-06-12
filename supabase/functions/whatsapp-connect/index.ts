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

    let evolutionApiUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");

    if (!evolutionApiUrl || !evolutionApiKey) {
      throw new Error("Credenciais da Evolution API não configuradas.");
    }
    
    // Remove barra final para evitar URLs com barra dupla como //instance/create
    evolutionApiUrl = evolutionApiUrl.replace(/\/+$/, "");

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
      
      const instances = await Promise.all(list.map(async (i: any) => {
        const instanceName = i.instance?.instanceName || i.instanceName || i.name || "desconhecido";
        let state = i.instance?.status || i.instance?.state || i.status || i.connectionStatus || i.state || "close";
        
        // Busca o estado real da conexão (necessário na v2)
        try {
          const stateEndpoint = `${evolutionApiUrl}/instance/connectionState/${instanceName}`;
          const stateRes = await fetch(stateEndpoint, {
            headers: { "apikey": evolutionApiKey }
          });
          if (stateRes.ok) {
            const stateJson = await stateRes.json();
            const realState = stateJson?.instance?.state || stateJson?.state || stateJson?.instance?.status || stateJson?.status;
            if (realState) state = realState;
          }
        } catch (e) {
          console.error("Erro ao buscar connectionState para", instanceName, e);
        }

        return {
          instanceName,
          state,
          phone: i.instance?.owner || i.owner || undefined,
        };
      }));

      return new Response(
        JSON.stringify({ instances }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Nome da instância global do sistema
    const instanceName = instance_name || "ministral-global-v2";

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
        const state = existing.instance?.status || existing.instance?.state || existing.status || existing.connectionStatus || existing.state || "close";
        if (state === "open") {
          return new Response(
            JSON.stringify({ connected: true, instanceName, state }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        // Instância existe mas não está conectada — busca QR Code via /connect com retry
        const qrEndpoint = `${evolutionApiUrl}/instance/connect/${instanceName}`;
        const maxRetries = 4;
        const delays = [1000, 2000, 3000, 5000]; // ms

        let qrcodeBase64: string | null = null;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
          if (attempt > 0) {
            await new Promise(r => setTimeout(r, delays[attempt]));
          }

          try {
            const qrResponse = await fetch(qrEndpoint, {
              method: "GET",
              headers: { "apikey": evolutionApiKey },
            });

            if (qrResponse.ok) {
              const qrResult = await qrResponse.json();
              // Evolution API v2.3.7: { base64: "data:image/png;...", code: "2@...", pairingCode: null }
              const extracted =
                qrResult.base64 ||
                qrResult.qrcode?.base64 ||
                qrResult.code ||
                qrResult.qr ||
                null;

              if (extracted && typeof extracted === "string" && extracted.length > 50) {
                qrcodeBase64 = extracted;
                break;
              }
            }
          } catch (e) {
            console.warn(`[whatsapp-connect] Reconnect tentativa ${attempt + 1}/${maxRetries}:`, e);
          }
        }

        if (qrcodeBase64) {
          return new Response(
            JSON.stringify({ success: true, instanceName, qrcode: qrcodeBase64, state }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ error: "QR Code não gerado. A instância existe mas não respondeu com QR. Tente novamente." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── Cria nova instância na Evolution API ──
    const createEndpoint = `${evolutionApiUrl}/instance/create`;

    const buildCreatePayload = () => JSON.stringify({
      instanceName,
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
    });

    let createResponse = await fetch(createEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": evolutionApiKey,
      },
      body: buildCreatePayload(),
    });

    let result = await createResponse.json();

    // ── Auto-recovery: instância fantasma (exists in Prisma but not in manager) ──
    // A Evolution API retorna 403 "already in use" quando a instância foi desconectada
    // pelo celular sem ser deletada via API. Solução: deletar e recriar automaticamente.
    if (!createResponse.ok && createResponse.status === 403 && JSON.stringify(result).includes("already in use")) {
      console.log(`[whatsapp-connect] Instância "${instanceName}" travada (403 already in use). Iniciando auto-recovery...`);

      // Tenta logout primeiro (revoga sessão WhatsApp Web)
      try {
        await fetch(`${evolutionApiUrl}/instance/logout/${instanceName}`, {
          method: "DELETE",
          headers: { "apikey": evolutionApiKey },
        });
      } catch (e) {
        console.warn("[whatsapp-connect] Auto-recovery: logout falhou (ignorado):", e);
      }

      // Deleta a instância do Prisma
      const delRes = await fetch(`${evolutionApiUrl}/instance/delete/${instanceName}`, {
        method: "DELETE",
        headers: { "apikey": evolutionApiKey },
      });

      if (!delRes.ok && delRes.status !== 404) {
        const delBody = await delRes.text().catch(() => "");
        console.error(`[whatsapp-connect] Auto-recovery: falha ao deletar (${delRes.status}): ${delBody}`);
        return new Response(
          JSON.stringify({ error: `Instância em estado inválido e não foi possível limpá-la. Tente novamente em alguns segundos. (${delRes.status})` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[whatsapp-connect] Auto-recovery: instância "${instanceName}" deletada. Aguardando 2s antes de recriar...`);
      await new Promise(r => setTimeout(r, 2000));

      // Recria a instância limpa
      createResponse = await fetch(createEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": evolutionApiKey,
        },
        body: buildCreatePayload(),
      });

      result = await createResponse.json();
      console.log(`[whatsapp-connect] Auto-recovery: create após reset — status ${createResponse.status}`);
    }

    if (!createResponse.ok) {
      return new Response(
        JSON.stringify({ error: `Falha ao criar instância na Evolution API (Status ${createResponse.status}): ${JSON.stringify(result)}`, payload: result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Já conectado
    const createdState = result.instance?.status || result.instance?.state || result.status || result.connectionStatus || result.state;
    if (createdState === "open") {
      return new Response(
        JSON.stringify({ connected: true, instanceName }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Evolution API v2.3.7: QR code não vem no create ──
    // O create retorna qrcode:{count:0}. Precisamos buscar via GET /instance/connect
    // com retry pois o Baileys precisa de alguns segundos para inicializar.
    let qrcodeBase64: string | null = null;

    // Tenta extrair do resultado do create primeiro (compatibilidade com versões anteriores)
    if (result.qrcode?.base64) {
      qrcodeBase64 = result.qrcode.base64;
    } else if (result.hash?.qrcode) {
      qrcodeBase64 = result.hash.qrcode;
    } else if (typeof result.base64 === "string" && result.base64.startsWith("data:")) {
      qrcodeBase64 = result.base64;
    }

    // Se não veio no create, busca via /instance/connect com retry
    if (!qrcodeBase64) {
      const connectEndpoint = `${evolutionApiUrl}/instance/connect/${instanceName}`;
      const maxRetries = 4;
      const delays = [2000, 3000, 5000, 5000]; // ms

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        // Aguarda antes de tentar (o Baileys precisa inicializar)
        await new Promise(r => setTimeout(r, delays[attempt]));

        try {
          const qrRes = await fetch(connectEndpoint, {
            method: "GET",
            headers: { "apikey": evolutionApiKey },
          });

          if (qrRes.ok) {
            const qrJson = await qrRes.json();
            // Evolution API v2.3.7 retorna { base64: "data:image/png;base64,...", code: "2@...", pairingCode: null }
            const extracted =
              qrJson.base64 ||
              qrJson.qrcode?.base64 ||
              qrJson.code ||
              qrJson.qr ||
              null;

            if (extracted && typeof extracted === "string" && extracted.length > 50) {
              qrcodeBase64 = extracted;
              break;
            }
          }
        } catch (e) {
          console.warn(`[whatsapp-connect] Tentativa ${attempt + 1}/${maxRetries} falhou:`, e);
        }
      }
    }

    if (!qrcodeBase64) {
      return new Response(
        JSON.stringify({ error: `QR Code não gerado após criar instância. Tente novamente em alguns segundos.`, payload: result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
