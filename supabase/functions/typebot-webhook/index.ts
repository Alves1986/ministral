/**
 * typebot-webhook — Recebe payloads do Typebot (confirmação / troca de escala).
 *
 * Payload esperado:
 * {
 *   "phone": "5542991534011",
 *   "action": "confirmed" | "swap_requested",
 *   "reason": "Vou viajar no fim de semana",   // opcional
 *   "typebot_session_id": "abc123"              // opcional, para rastreio
 * }
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- INLINE UTILS ---
function formatBrazilPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("55")) digits = digits.slice(2);
  if (digits.length < 10 || digits.length > 11) return null;
  return "55" + digits;
}
// --------------------

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

function jsonResponse(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

serve(async (req: Request) => {
  // ATENÇÃO: Webhook do Typebot desativada a pedido do usuário
  return jsonResponse({ error: "Typebot webhook is disabled" }, 503);

  // --- CORS preflight ---
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed" }, 405);
  }

  try {
    // --- Autenticação via webhook secret ---
    const expectedSecret = Deno.env.get("TYPEBOT_WEBHOOK_SECRET");
    if (expectedSecret) {
      const providedSecret = req.headers.get("x-webhook-secret");
      if (providedSecret !== expectedSecret) {
        console.warn("[typebot-webhook] Secret inválido ou ausente");
        return jsonResponse({ error: "Unauthorized" }, 401);
      }
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { phone, action, reason, typebot_session_id } = body;

    if (!phone || !action) {
      return jsonResponse({ error: "Missing required fields: phone, action" }, 400);
    }

    if (!["confirmed", "swap_requested"].includes(action)) {
      return jsonResponse({ error: `Invalid action: ${action}. Expected 'confirmed' or 'swap_requested'` }, 400);
    }

    // --- 1. Normaliza o phone ---
    const normalizedPhone = formatBrazilPhone(phone);
    if (!normalizedPhone) {
      return jsonResponse({ error: `Invalid phone: ${phone}` }, 400);
    }

    console.log(`[typebot-webhook] action=${action} phone=${normalizedPhone} session=${typebot_session_id || "n/a"}`);

    // --- 2. Busca o membro pelo WhatsApp ---
    // Tenta busca direta primeiro
    let memberId: string | null = null;
    let memberName: string | null = null;
    let organizationId: string | null = null;

    const { data: directProfile } = await supabase
      .from("profiles")
      .select("id, name, organization_id, whatsapp")
      .eq("whatsapp", normalizedPhone)
      .maybeSingle();

    if (directProfile) {
      memberId = directProfile.id;
      memberName = directProfile.name;
      organizationId = directProfile.organization_id;
    } else {
      // Fallback: busca todos os perfis com whatsapp e normaliza para comparar
      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("id, name, organization_id, whatsapp")
        .not("whatsapp", "is", null);

      const found = (allProfiles ?? []).find(
        (p: { whatsapp: string }) => formatBrazilPhone(p.whatsapp) === normalizedPhone
      );

      if (found) {
        memberId = found.id;
        memberName = found.name;
        organizationId = found.organization_id;
      }
    }

    if (!memberId || !organizationId) {
      console.warn(`[typebot-webhook] Membro não encontrado para phone: ${normalizedPhone}`);
      return jsonResponse({ error: "member_not_found", phone: normalizedPhone }, 404);
    }

    console.log(`[typebot-webhook] Membro encontrado: ${memberName} (${memberId}) org=${organizationId}`);

    // --- 3. Busca ministérios do membro ---
    const { data: memberships } = await supabase
      .from("ministry_members")
      .select("ministry_id, functions")
      .eq("profile_id", memberId);

    if (!memberships || memberships.length === 0) {
      return jsonResponse({ error: "member_has_no_ministries" }, 404);
    }

    const ministryIds = memberships.map((m: { ministry_id: string }) => m.ministry_id);

    // --- 4. Busca escalas futuras do membro (próximos 14 dias) ---
    const today = new Date().toISOString().slice(0, 10);
    const futureDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const { data: assignments } = await supabase
      .from("schedule_assignments")
      .select("id, ministry_id, event_date, role, confirmed, event_rule_id, event_rules(title, time)")
      .eq("organization_id", organizationId)
      .eq("member_id", memberId)
      .in("ministry_id", ministryIds)
      .gte("event_date", today)
      .lte("event_date", futureDate)
      .order("event_date", { ascending: true });

    if (!assignments || assignments.length === 0) {
      return jsonResponse({
        ok: true,
        action: "no_assignments",
        message: "Nenhuma escala encontrada nos próximos 14 dias",
        member_name: memberName
      });
    }

    // Pega a próxima escala não confirmada (ou a primeira disponível)
    const nextAssignment = assignments.find((a: { confirmed: boolean }) => !a.confirmed) || assignments[0];
    const eventRule = nextAssignment.event_rules as { title?: string; time?: string } | null;

    // --- 5. Processa a ação ---
    if (action === "confirmed") {
      // Confirma presença na próxima escala
      const { error: updateError } = await supabase
        .from("schedule_assignments")
        .update({ confirmed: true })
        .eq("id", nextAssignment.id);

      if (updateError) {
        console.error("[typebot-webhook] Erro ao confirmar:", updateError);
        return jsonResponse({ error: "failed_to_confirm" }, 500);
      }

      console.log(`[typebot-webhook] ✅ Presença confirmada: ${memberName} em ${nextAssignment.event_date}`);

      return jsonResponse({
        ok: true,
        action: "confirmed",
        member_name: memberName,
        event_date: nextAssignment.event_date,
        event_title: eventRule?.title || "Evento",
        role: nextAssignment.role
      });
    }

    if (action === "swap_requested") {
      // Verifica se já existe um pedido pendente para esta mesma vaga
      const eventDatetime = `${nextAssignment.event_date}T${eventRule?.time || "00:00"}`;

      const { data: existing } = await supabase
        .from("swap_requests")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("ministry_id", nextAssignment.ministry_id)
        .eq("requester_id", memberId)
        .eq("role", nextAssignment.role)
        .eq("event_datetime", eventDatetime)
        .eq("status", "pending")
        .maybeSingle();

      if (existing) {
        return jsonResponse({
          ok: true,
          action: "swap_already_pending",
          message: "Já existe uma solicitação pendente para esta escala",
          swap_request_id: existing.id
        });
      }

      // Cria o pedido de troca
      const { data: swapReq, error: insertError } = await supabase
        .from("swap_requests")
        .insert({
          organization_id: organizationId,
          ministry_id: nextAssignment.ministry_id,
          requester_id: memberId,
          requester_name: memberName,
          event_rule_id: nextAssignment.event_rule_id,
          event_title: eventRule?.title || "Evento",
          event_date: nextAssignment.event_date,
          event_datetime: eventDatetime,
          role: nextAssignment.role,
          status: "pending",
          reason: reason || null,
          origin: "whatsapp_typebot"
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("[typebot-webhook] Erro ao criar swap_request:", insertError);
        return jsonResponse({ error: "failed_to_create_swap" }, 500);
      }

      console.log(`[typebot-webhook] 🔄 Swap criado: ${swapReq.id} por ${memberName}`);

      // Dispara notificação WhatsApp para os membros (non-blocking)
      supabase.functions.invoke("whatsapp-swap-notify", {
        body: {
          swapRequestId: swapReq.id,
          ministryId: nextAssignment.ministry_id,
          orgId: organizationId
        }
      }).catch((err: Error) => {
        console.warn("[typebot-webhook] whatsapp-swap-notify falhou silenciosamente:", err);
      });

      return jsonResponse({
        ok: true,
        action: "swap_requested",
        member_name: memberName,
        swap_request_id: swapReq.id,
        event_date: nextAssignment.event_date,
        event_title: eventRule?.title || "Evento",
        role: nextAssignment.role,
        reason: reason || null
      });
    }

    return jsonResponse({ error: "Unhandled action" }, 400);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[typebot-webhook] Erro crítico:", errorMessage);
    return jsonResponse({ error: "Internal error" }, 500);
  }
});
