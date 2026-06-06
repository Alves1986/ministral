import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * whatsapp-keepalive
 *
 * Função de keep-alive para prevenir a hibernação do servidor Evolution API.
 * Deve ser chamada a cada 5 minutos via pg_cron (Supabase Cron).
 *
 * O que faz:
 * 1. Busca todas as instâncias ativas no banco (ministry_whatsapp + instância global)
 * 2. Para cada instância, faz um GET /instance/connectionState/{name}
 * 3. Se a instância estiver 'close', tenta reconectar via /instance/connect/{name}
 * 4. Retorna um relatório de status de todas as instâncias
 */

async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number } = {}
): Promise<Response> {
  const { timeout = 8000, ...rest } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function pingInstance(
  apiUrl: string,
  apiKey: string,
  instanceName: string
): Promise<{ instance: string; state: string; action: string }> {
  let state = "unknown";
  let action = "none";

  try {
    const resp = await fetchWithTimeout(
      `${apiUrl}/instance/connectionState/${instanceName}`,
      { headers: { apikey: apiKey }, timeout: 8000 }
    );

    if (resp.ok) {
      const data = await resp.json().catch(() => ({}));
      state = data?.instance?.state || data?.state || "unknown";
    } else {
      state = `error_${resp.status}`;
    }
  } catch (e: any) {
    state = `timeout_or_error: ${e?.message?.slice(0, 60) || "?"}`;
  }

  // Se desconectada, tenta reconectar
  if (state === "close" || state === "unknown") {
    action = "reconnect_attempted";
    console.log(`[keepalive] Instância "${instanceName}" está "${state}". Reconectando...`);
    try {
      const reconnResp = await fetchWithTimeout(
        `${apiUrl}/instance/connect/${instanceName}`,
        { headers: { apikey: apiKey }, timeout: 10000 }
      );
      const reconnData = await reconnResp.json().catch(() => ({}));
      action = reconnResp.ok
        ? `reconnect_ok (${reconnData?.instance?.state || "?"})`
        : `reconnect_failed_${reconnResp.status}`;
      console.log(`[keepalive] Reconexão de "${instanceName}": ${action}`);
    } catch (e: any) {
      action = `reconnect_error: ${e?.message?.slice(0, 60) || "?"}`;
      console.error(`[keepalive] Erro ao reconectar "${instanceName}":`, action);
    }
  } else {
    action = "ok";
    console.log(`[keepalive] Instância "${instanceName}" OK (${state})`);
  }

  return { instance: instanceName, state, action };
}

serve(async (req: Request) => {
  // Aceita tanto chamadas via cron (sem corpo) quanto via webhook autenticado
  const cronSecret = Deno.env.get("WHATSAPP_CRON_SECRET");
  if (cronSecret) {
    const headerSecret = req.headers.get("x-cron-secret");
    const authHeader = req.headers.get("Authorization");
    const isServiceKey = authHeader?.includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "NEVER");

    // Permite: cron secret correto OU chamada interna via service role
    if (headerSecret !== cronSecret && !isServiceKey) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json" },
      });
    }
  }

  const evolutionApiUrl = Deno.env.get("EVOLUTION_API_URL");
  const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");
  const defaultInstance = Deno.env.get("EVOLUTION_INSTANCE_NAME") || "ministral-global";
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!evolutionApiUrl || !evolutionApiKey) {
    return new Response(
      JSON.stringify({ error: "EVOLUTION_API_URL ou EVOLUTION_API_KEY não configurados." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // Coleta todas as instâncias ativas (global + por ministério)
  const instancesToPing = new Set<string>([defaultInstance]);

  if (supabaseUrl && supabaseServiceKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { data: mnWhatsapps } = await supabase
        .from("ministry_whatsapp")
        .select("instance_name")
        .eq("connected", true);

      (mnWhatsapps || []).forEach((mw: any) => {
        if (mw.instance_name) instancesToPing.add(mw.instance_name);
      });
    } catch (e) {
      console.warn("[keepalive] Não foi possível buscar instâncias do banco:", e);
    }
  }

  console.log(`[keepalive] Pingando ${instancesToPing.size} instância(s):`, [...instancesToPing]);

  // Pinga todas em paralelo
  const results = await Promise.all(
    [...instancesToPing].map((inst) => pingInstance(evolutionApiUrl, evolutionApiKey, inst))
  );

  return new Response(
    JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
      instances_checked: results.length,
      results,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
