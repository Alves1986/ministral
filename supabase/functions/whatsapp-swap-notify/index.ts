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
import { formatBrazilPhone } from "./_shared/phoneFormatter.ts";
import { sendWhatsAppMessage } from "./_shared/evolutionClient.ts";

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

    const apiUrl      = Deno.env.get("EVOLUTION_API_URL")!;
    const apiKey      = Deno.env.get("EVOLUTION_API_KEY")!;
    // CORREÇÃO: não usar instância global como fallback — cada ministério tem seu próprio WhatsApp
    // Se não encontrar instância específica, retornar erro sem enviar pelo WhatsApp errado

    const { swapRequestId, ministryId, orgId } = await req.json();

    if (!swapRequestId || !ministryId || !orgId) {
      return jsonResponse({ error: "Missing parameters" }, 400);
    }

    // --- SEGURANÇA: Validação de Token JWT e Permissão de Admin (SEC-02) ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Authorization header ausente" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) {
      return jsonResponse({ error: "Não autenticado: " + (userErr?.message || "") }, 401);
    }

    // Busca perfil do usuário
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("is_admin, is_super_admin, organization_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileErr || !profile) {
      return jsonResponse({ error: "Perfil do usuário não encontrado" }, 403);
    }

    const isAuthorized =
      profile.is_super_admin ||
      (profile.is_admin && profile.organization_id === orgId);

    if (!isAuthorized) {
      return jsonResponse({ error: "Acesso negado. Administrador requerido para enviar notificações." }, 403);
    }

    // --- VERIFICAÇÃO DO PLANO E DA FLAG GLOBAL ---
    const { data: org, error: orgErr } = await supabase
      .from("organizations")
      .select("plan_type, whatsapp_enabled")
      .eq("id", orgId)
      .single();

    if (orgErr || !org) {
      return jsonResponse({ error: "Organização não encontrada" }, 404);
    }

    if (org.plan_type !== "enterprise" || !org.whatsapp_enabled) {
      return jsonResponse({ 
        error: "WhatsApp indisponível. Plano Enterprise e ativação global são requeridos.",
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

    // ── 2. Instância WhatsApp do ministério ───────────────────────────────
    const { data: ministryWa } = await supabase
      .from("ministry_whatsapp")
      .select("instance_name")
      .eq("ministry_id", ministryId)
      .eq("connected", true)
      .maybeSingle();

    const instance = ministryWa?.instance_name;

    if (!instance) {
      console.warn(`[whatsapp-swap-notify] Ministério ${ministryId} não tem WhatsApp configurado e conectado. Notificação cancelada para evitar envio pelo canal errado.`);
      return new Response(
        JSON.stringify({ success: false, sent: 0, reason: "ministry_has_no_whatsapp" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // ── 3. Membros elegíveis: têm a função E não são o solicitante ────────
    const { data: memberships } = await supabase
      .from("ministry_members")
      .select("profile_id, functions")
      .eq("ministry_id", ministryId);

    if (!memberships || memberships.length === 0) {
      return jsonResponse({ success: true, sent: 0, reason: "no_members" });
    }

    const eligibleIds = memberships
      .filter(
        (m: any) =>
          m.profile_id !== swapReq.requester_id &&
          Array.isArray(m.functions) &&
          m.functions.includes(swapReq.role)
      )
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
