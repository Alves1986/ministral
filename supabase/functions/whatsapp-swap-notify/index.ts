/**
 * whatsapp-swap-notify — Chamada pelo app quando um membro abre um pedido de troca.
 *
 * Busca todos os membros do ministério com a função necessária,
 * envia mensagem WhatsApp para cada um e cria registros em whatsapp_pending_actions.
 *
 * ── CHAMADA DO APP ────────────────────────────────────────────────────────────
 * const { error } = await supabase.functions.invoke('whatsapp-swap-notify', {
 *   body: { swapRequestId, ministryId, orgId }
 * });
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// --- INLINE UTILS ---
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function fetchWithTimeout(resource: string, options: RequestInit & { timeout?: number }): Promise<Response> {
  const { timeout = 8000, ...fetchOptions } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(resource, { ...fetchOptions, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(id);
  }
}
export async function sendWhatsAppMessage(
  apiUrl: string,
  apiKey: string,
  instanceName: string,
  phone: string,
  text: string,
  options: { timeout?: number; retries?: number; delayMs?: number; presence?: "composing" | "recording" | "paused" } = {}
): Promise<{ success: boolean; error?: string }> {
  const { timeout = 8000, retries = 2, delayMs = 1200, presence = "composing" } = options;
  const endpoint = `${apiUrl}/message/sendText/${instanceName}`;
  let lastError = "";
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: apiKey },
        body: JSON.stringify({ number: phone, options: { delay: delayMs, presence }, text }),
        timeout,
      });
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        lastError = `Evolution API ${response.status}: ${body}`;
        
        // Se a instância pareceu 'open' na verificação mas o socket caiu na hora de enviar
        if (response.status === 428 || body.includes('Connection Closed') || body.includes('Not Connected')) {
          console.warn(`[whatsapp-swap-notify] Conexão fechada detectada no envio (${instanceName}). Forçando reconexão (tentativa ${attempt + 1})...`);
          try {
            await fetchWithTimeout(`${apiUrl}/instance/connect/${instanceName}`, { headers: { apikey: apiKey }, timeout: 10000 });
            await sleep(8000); // Aguarda o socket do Baileys subir
          } catch (e) {
            console.error(`[whatsapp-swap-notify] Falha ao tentar forçar reconexão:`, e);
          }
        }
        
        if (attempt < retries) { await sleep(1000 * (attempt + 1)); continue; }
        return { success: false, error: lastError };
      }
      return { success: true };
    } catch (err: any) {
      lastError = err?.message || String(err);
      if (attempt < retries) { await sleep(1000 * (attempt + 1)); continue; }
    }
  }
  return { success: false, error: lastError };
}
export function formatBrazilPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("55")) digits = digits.slice(2);
  if (digits.length < 10 || digits.length > 11) return null;
  return "55" + digits;
}
export function phoneFromJid(remoteJid: string): string | null {
  const raw = remoteJid.split("@")[0];
  const digits = raw.replace(/\D/g, "");
  if (!digits || digits.length < 10) return null;
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  return formatBrazilPhone(digits);
}
// --------------------

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: object, status = 200) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders }
  });
};

serve(async (req: Request) => {
  // Responde a preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const apiUrl = Deno.env.get("EVOLUTION_API_URL")!;
    const apiKey = Deno.env.get("EVOLUTION_API_KEY")!

    const { swapRequestId, ministryId, orgId } = await req.json();

    if (!swapRequestId || !ministryId || !orgId) {
      return jsonResponse({ error: "Missing parameters" }, 400);
    }

    // --- JWT: verifica identidade do usuário autenticado ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Authorization header ausente" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) {
      return jsonResponse({ error: "Não autenticado: " + (userErr?.message || "") }, 401);
    }

    // Qualquer membro autenticado pode disparar notificação de troca
    // (não exigimos is_admin — verificamos apenas que pertence à mesma organização)
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileErr || !profile) {
      return jsonResponse({ error: "Perfil do usuário não encontrado" }, 403);
    }

    if (profile.organization_id !== orgId) {
      return jsonResponse({ error: "Acesso negado. Usuário não pertence a esta organização." }, 403);
    }

    const { data: org, error: orgErr } = await supabase
      .from("organizations")
      .select("plan_type, whatsapp_enabled")
      .eq("id", orgId)
      .single();

    if (orgErr || !org) {
      return jsonResponse({ error: "Organização não encontrada" }, 404);
    }

    const planOk = org.plan_type === "enterprise" || org.plan_type === "pro";
    if (!planOk || !org.whatsapp_enabled) {
      return jsonResponse({ 
        error: "WhatsApp indisponível. Plano Pro/Enterprise e ativação global são requeridos.",
        code: "WHATSAPP_DISABLED"
      }, 403);
    }

    // ── 1. Busca o swap request ───────────────────────────────────────────
    const { data: swapReq, error: swapErr } = await supabase
      .from("swap_requests")
      .select("*")
      .eq("id", swapRequestId)
      .eq("organization_id", orgId)
      .single();

    if (swapErr || !swapReq) {
      return jsonResponse({ error: "Swap request not found" }, 404);
    }

    // ── 2. Instância WhatsApp: usa sempre a global como fallback ───────────────────
    const defaultInstance = Deno.env.get("EVOLUTION_INSTANCE_NAME") || "ministral-global";
    const { data: ministryWa } = await supabase
      .from("ministry_whatsapp")
      .select("instance_name")
      .eq("ministry_id", ministryId)
      .eq("connected", true)
      .maybeSingle();

    // Preferência: instância própria do ministério → instância global
    const instance = ministryWa?.instance_name || defaultInstance;
    console.log(`[whatsapp-swap-notify] Usando instância: ${instance} (ministério: ${ministryId})`);

    // ── 3. Membros elegiíveis: têm a função OU são admin, e não são o solicitante ──
    const { data: memberships } = await supabase
      .from("ministry_members")
      .select("profile_id, functions, role")
      .eq("ministry_id", ministryId);

    if (!memberships || memberships.length === 0) {
      return jsonResponse({ success: true, sent: 0, reason: "no_members" });
    }

    const eligibleIds = memberships
      .filter((m: any) => {
        if (m.profile_id === swapReq.requester_id) return false; // não notifica o próprio solicitante
        const isAdmin = m.role === 'admin';
        const hasSameFunction = Array.isArray(m.functions) && m.functions.includes(swapReq.role);
        return isAdmin || hasSameFunction; // admins + membros com a mesma função
      })
      .map((m: any) => m.profile_id as string);

    if (eligibleIds.length === 0) {
      console.log(`[whatsapp-swap-notify] Nenhum membro elegível para função: ${swapReq.role}`);
      return jsonResponse({ success: true, sent: 0, reason: "no_eligible_members" });
    }

    // ── 4. Busca perfis com WhatsApp ──────────────────────────────────────
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name, whatsapp")
      .in("id", eligibleIds)
      .not("whatsapp", "is", null);

    if (!profiles || profiles.length === 0) {
      return jsonResponse({ success: true, sent: 0, reason: "no_phones" });
    }

    // ── 5. Monta a mensagem ───────────────────────────────────────────────
    const dt       = swapReq.event_datetime ?? "";
    const datePart = dt.split("T")[0];
    const timePart = dt.split("T")[1]?.substring(0, 5) ?? "";
    const [y, m, d] = datePart.split("-");
    const dateDisplay = `${d}/${m}/${y}`;

    const msg =
      `🔄 *Troca de Escala*\n\n` +
      `*${swapReq.requester_name}* precisa de um substituto:\n\n` +
      `📋 *Função:* ${swapReq.role}\n` +
      `📅 *Evento:* ${swapReq.event_title}\n` +
      `🗓️ *Data:* ${dateDisplay}\n` +
      `⏰ *Horário:* ${timePart}\n\n` +
      `Responda *SIM* para assumir esta escala diretamente pelo WhatsApp ou acesse o aplicativo web.`;

    // ── 6. Envia mensagens e grava as ações pendentes ──────────────────────
    let sent = 0;

    for (const profile of profiles) {
      const phone = formatBrazilPhone((profile as any).whatsapp);
      if (!phone) continue;

      const { success: msgOk, error: msgErr } = await sendWhatsAppMessage(
        apiUrl, apiKey, instance, phone, msg, { retries: 1 }
      );

      if (msgOk) {
        sent++;

        // Gravar ação pendente na tabela whatsapp_pending_actions para interceptação pelo webhook
        const { error: pendingErr } = await supabase
          .from("whatsapp_pending_actions")
          .insert({
            organization_id: orgId,
            ministry_id: ministryId,
            member_id: profile.id,
            phone: phone,
            type: "swap_accept",
            swap_request_id: swapRequestId,
            status: "pending",
            event_date: datePart
          });

        if (pendingErr) {
          console.error(`[whatsapp-swap-notify] Erro ao criar ação pendente para ${phone}:`, pendingErr.message);
        }

        // Gravar log de uso do WhatsApp (assíncrono/não-bloqueante)
        supabase.from("whatsapp_usage_logs").insert({
          organization_id: orgId,
          ministry_id: ministryId,
          instance_name: instance
        }).then(({ error: logErr }) => {
          if (logErr) console.warn(`[whatsapp-swap-notify] Falha ao registrar log:`, logErr.message);
        });
      } else {
        console.warn(`[whatsapp-swap-notify] Falha ao enviar para ${phone}:`, msgErr);
      }
    }

    console.log(`[whatsapp-swap-notify] Swap ${swapRequestId}: ${sent}/${profiles.length} mensagens enviadas.`);

    return jsonResponse({ success: true, sent, total: profiles.length });
  } catch (err: any) {
    console.error("[whatsapp-swap-notify] Erro crítico:", err);
    return jsonResponse({ error: "Internal error" }, 500);
  }
});
