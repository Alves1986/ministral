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

function formatBrazilPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("55")) digits = digits.slice(2);
  if (digits.length < 10 || digits.length > 11) return null;
  return "55" + digits;
}

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const apiUrl      = Deno.env.get("EVOLUTION_API_URL")!;
    const apiKey      = Deno.env.get("EVOLUTION_API_KEY")!;
    const defaultInst = Deno.env.get("EVOLUTION_INSTANCE_NAME")!;

    const { swapRequestId, ministryId, orgId } = await req.json();

    if (!swapRequestId || !ministryId || !orgId) {
      return new Response(JSON.stringify({ error: "Missing parameters" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ── 1. Busca o swap request ───────────────────────────────────────────
    const { data: swapReq, error: swapErr } = await supabase
      .from("swap_requests")
      .select("*")
      .eq("id", swapRequestId)
      .eq("organization_id", orgId)
      .single();

    if (swapErr || !swapReq) {
      return new Response(JSON.stringify({ error: "Swap request not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ── 2. Instância WhatsApp do ministério ───────────────────────────────
    const { data: ministryWa } = await supabase
      .from("ministry_whatsapp")
      .select("instance_name")
      .eq("ministry_id", ministryId)
      .eq("connected", true)
      .maybeSingle();

    const instance = ministryWa?.instance_name ?? defaultInst;

    // ── 3. Membros elegíveis: têm a função E não são o solicitante ────────
    const { data: memberships } = await supabase
      .from("ministry_members")
      .select("profile_id, functions")
      .eq("ministry_id", ministryId);

    if (!memberships || memberships.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, reason: "no_members" }), {
        headers: { "Content-Type": "application/json" },
      });
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
      return new Response(JSON.stringify({ success: true, sent: 0, reason: "no_eligible_members" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // ── 4. Busca perfis com WhatsApp ──────────────────────────────────────
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name, whatsapp")
      .in("id", eligibleIds)
      .not("whatsapp", "is", null);

    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, reason: "no_phones" }), {
        headers: { "Content-Type": "application/json" },
      });
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
      `Responda *SIM* para assumir esta escala.`;

    // ── 6. Envia mensagens e cria pending_actions ─────────────────────────
    let sent = 0;
    const pendingToInsert: any[] = [];
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(); // 48h

    for (const profile of profiles) {
      const phone = formatBrazilPhone((profile as any).whatsapp);
      if (!phone) continue;

      try {
        const res = await fetch(`${apiUrl}/message/sendText/${instance}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: apiKey },
          body: JSON.stringify({
            number: phone,
            options: { delay: 1200, presence: "composing" },
            text: msg,
          }),
        });

        if (res.ok) {
          sent++;
          pendingToInsert.push({
            type:            "swap_accept",
            member_id:       (profile as any).id,
            phone,
            organization_id: orgId,
            ministry_id:     ministryId,
            role:            swapReq.role,
            swap_request_id: swapRequestId,
            expires_at:      expiresAt,
          });
        } else {
          console.warn(`[whatsapp-swap-notify] Evolution retornou ${res.status} para ${phone}`);
        }
      } catch (e) {
        console.error(`[whatsapp-swap-notify] Erro ao enviar para ${phone}:`, e);
      }
    }

    // ── 7. Persiste as ações pendentes em batch ───────────────────────────
    if (pendingToInsert.length > 0) {
      const { error: insertErr } = await supabase
        .from("whatsapp_pending_actions")
        .insert(pendingToInsert);

      if (insertErr) {
        console.error("[whatsapp-swap-notify] Erro ao inserir pending_actions:", insertErr);
      }
    }

    console.log(`[whatsapp-swap-notify] Swap ${swapRequestId}: ${sent}/${profiles.length} mensagens enviadas.`);

    return new Response(
      JSON.stringify({ success: true, sent, total: profiles.length }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[whatsapp-swap-notify] Erro crítico:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
