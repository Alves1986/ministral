/**
 * whatsapp-webhook — Recebe eventos da Evolution API e processa respostas dos membros.
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
export async function sendWhatsAppButtons(
  apiUrl: string, apiKey: string, instanceName: string, phone: string,
  content: { title: string, description: string, footer: string },
  buttons: Array<{ id: string, text: string }>
): Promise<{ success: boolean; error?: string }> {
  const endpoint = `${apiUrl}/message/sendButtons/${instanceName}`;
  const payload = {
    number: phone,
    options: { delay: 1200, presence: "composing" },
    buttonMessage: {
      title: content.title, description: content.description, footer: content.footer,
      buttons: buttons.map((b) => ({ buttonId: b.id, buttonText: { displayText: b.text }, type: 1 }))
    }
  };
  try {
    const response = await fetchWithTimeout(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`Status ${response.status}`);
    return { success: true };
  } catch (error) {
    console.warn(`[whatsapp] Falha ao enviar botões para ${phone}. Acionando Fallback Textual.`);
    let fallbackText = `*${content.title}*\n\n${content.description}\n\n_${content.footer}_`;
    return sendWhatsAppMessage(apiUrl, apiKey, instanceName, phone, fallbackText);
  }
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
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
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
    const apiKey = Deno.env.get("EVOLUTION_API_KEY")!;

    const body = await req.json();

    if (body.event !== "messages.upsert") {
      return ok({ ignored: "event_type" });
    }

    const data = body.data ?? {};
    const key = data.key ?? {};

    if (key.fromMe === true) return ok({ ignored: "fromMe" });

    const remoteJid: string = key.remoteJid ?? "";

    if (remoteJid.endsWith("@g.us") || remoteJid.endsWith("@broadcast")) {
      return ok({ ignored: "group/broadcast" });
    }

    const msgObj = data.message ?? {};
    const buttonId = msgObj.buttonsResponseMessage?.selectedButtonId;
    const rawText = (
      msgObj.conversation ??
      msgObj.extendedTextMessage?.text ??
      msgObj.buttonsResponseMessage?.selectedDisplayText ??
      ""
    ).trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    let actionId = buttonId;
    if (!actionId && rawText) {
      if (rawText === "1" || rawText === "CONFIRMAR") actionId = "CONFIRMAR";
      if (rawText === "2" || rawText === "RECUSAR" || rawText === "NAO") actionId = "RECUSAR";
      if (rawText === "3" || rawText === "TROCA" || rawText === "TROCAR") actionId = "TROCA";
      if (rawText === "SIM" || rawText === "ACEITAR") actionId = "SWAP_ACCEPT";
    }

    if (!actionId && !rawText) return ok({ ignored: "empty_message" });

    const phone = phoneFromJid(remoteJid);
    if (!phone) return ok({ ignored: "invalid_phone" });

    const instance = body.instance ?? body.instanceName ?? null;

    let filterOrgId: string | null = null;
    if (instance) {
      const { data: ministryWa } = await supabase
        .from("ministry_whatsapp")
        .select("organization_id")
        .eq("instance_name", instance)
        .maybeSingle();
      filterOrgId = ministryWa?.organization_id ?? null;
    }

    let actionsQuery = supabase
      .from("whatsapp_pending_actions")
      .select("*")
      .eq("phone", phone)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (filterOrgId) {
      actionsQuery = actionsQuery.eq("organization_id", filterOrgId);
    }

    const { data: pendingActions } = await actionsQuery;

    if (!pendingActions || pendingActions.length === 0) {
      return ok({ ignored: "no_pending_actions" });
    }

    if (actionId === "CONFIRMAR") {
      const action = pendingActions.find((a: any) => a.type === "confirmation");
      if (action) {
        await supabase
          .from("schedule_assignments")
          .update({ confirmed: true })
          .eq("organization_id", action.organization_id)
          .eq("ministry_id", action.ministry_id)
          .eq("event_rule_id", action.event_rule_id)
          .eq("event_date", action.event_date)
          .eq("member_id", action.member_id);

        await supabase
          .from("whatsapp_pending_actions")
          .update({ status: "resolved" })
          .eq("id", action.id);

        await sendWhatsAppMessage(apiUrl, apiKey, instance, phone, `✅ *Presença confirmada!*\n\nObrigado! Te esperamos lá. 🙏`);
        return ok({ action: "confirmed" });
      }
    }

    if (actionId === "RECUSAR") {
      const action = pendingActions.find((a: any) => a.type === "confirmation");
      if (action) {
        await supabase
          .from("whatsapp_pending_actions")
          .update({ status: "resolved" })
          .eq("id", action.id);

        await sendWhatsAppMessage(apiUrl, apiKey, instance, phone, `❌ *Recusa registrada.*\n\nEntendido! A liderança será avisada. Se precisar, entre em contato com seu líder. 🙏`);
        return ok({ action: "declined" });
      }
    }

    if (actionId === "TROCA") {
      const action = pendingActions.find((a: any) => a.type === "confirmation");
      if (action) {
        // Resolve a action original
        await supabase.from("whatsapp_pending_actions").update({ status: "resolved" }).eq("id", action.id);

        const { data: profileReq } = await supabase.from("profiles").select("name").eq("id", action.member_id).maybeSingle();
        const reqName = profileReq?.name || "Membro";
        const { data: ruleData } = await supabase.from("event_rules").select("title, time").eq("id", action.event_rule_id).maybeSingle();

        const { data: swapReq } = await supabase.from("swap_requests").insert({
          organization_id: action.organization_id,
          ministry_id: action.ministry_id,
          requester_id: action.member_id,
          requester_name: reqName,
          event_rule_id: action.event_rule_id,
          event_title: ruleData?.title || "Evento",
          event_date: action.event_date,
          event_datetime: `${action.event_date}T${ruleData?.time || "00:00"}`,
          role: action.role,
          status: "pending"
        }).select().single();

        if (swapReq) {
          const { data: ministryMembers } = await supabase
            .from("ministry_members")
            .select("member_id, profiles:member_id ( whatsapp, name )")
            .eq("ministry_id", action.ministry_id)
            .neq("member_id", action.member_id);

          const membersToNotify = (ministryMembers || []).filter(m => m.profiles?.whatsapp);

          for (const m of membersToNotify) {
            const mPhone = formatBrazilPhone(m.profiles.whatsapp);
            if (mPhone) {
              await supabase.from("whatsapp_pending_actions").insert({
                organization_id: action.organization_id,
                ministry_id: action.ministry_id,
                member_id: m.member_id,
                phone: mPhone,
                type: "swap_accept",
                swap_request_id: swapReq.id,
                event_rule_id: action.event_rule_id,
                event_date: action.event_date,
                role: action.role,
                status: "pending",
                expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
              });

              const [y, mm, d] = action.event_date.split("-");
              const dFormat = `${d}/${mm}/${y}`;
              const swapContent = {
                title: "⚠️ Solicitação de Troca",
                description: `*${reqName}* precisa de uma troca para a escala de *${action.role}*.\n\n🗓️ Data: ${dFormat}\n⏰ Hora: ${ruleData?.time?.substring(0,5) || ""}\n\nVocê pode assumir essa escala?`,
                footer: "Ministral • Troca de Escala"
              };
              await sendWhatsAppButtons(apiUrl, apiKey, instance, mPhone, swapContent, [
                { id: "SWAP_ACCEPT", text: "✅ Aceitar Escala" }
              ]);
            }
          }

          await sendWhatsAppMessage(apiUrl, apiKey, instance, phone, `🔄 *Solicitação enviada!*\n\nEnviamos o pedido para os outros membros da equipe. Você será avisado se alguém aceitar.`);
          return ok({ action: "swap_requested" });
        }
      }
    }

    if (actionId === "SWAP_ACCEPT") {
      const swapAction = pendingActions.find((a: any) => a.type === "swap_accept");
      if (!swapAction) return ok({ ignored: "no_swap_pending" });

      let acceptorId: string | null = null;
      let acceptorName: string | null = null;

      const { data: directProfile } = await supabase
        .from("profiles")
        .select("id, name")
        .eq("whatsapp", phone)
        .maybeSingle();

      if (directProfile) {
        acceptorId = directProfile.id;
        acceptorName = directProfile.name;
      } else {
        let profilesQuery = supabase
          .from("profiles")
          .select("id, name, whatsapp")
          .not("whatsapp", "is", null);

        if (filterOrgId) {
          profilesQuery = profilesQuery.eq("organization_id", filterOrgId);
        }

        const { data: allProfiles } = await profilesQuery;

        const found = (allProfiles ?? []).find(
          (p: any) => formatBrazilPhone(p.whatsapp) === phone
        );
        acceptorId = found?.id ?? null;
        acceptorName = found?.name ?? null;
      }

      if (!acceptorId) {
        console.error("[whatsapp-webhook] Aceitante não encontrado para phone:", phone);
        return ok({ error: "acceptor_not_found" });
      }

      // CORREÇÃO: Atualização ATÔMICA
      const { data: swapReq } = await supabase
        .from("swap_requests")
        .update({ status: "completed", taken_by_id: acceptorId, taken_by_name: acceptorName })
        .eq("id", swapAction.swap_request_id)
        .eq("status", "pending")
        .select("*, profiles:requester_id(name, whatsapp)")
        .maybeSingle();

      if (!swapReq) {
        await supabase
          .from("whatsapp_pending_actions")
          .update({ status: "expired" })
          .eq("id", swapAction.id);

        await sendWhatsAppMessage(apiUrl, apiKey, instance, phone, `ℹ️ Esta vaga já foi preenchida por outro membro. Obrigado pela disponibilidade! 🙌`);
        return ok({ action: "swap_already_taken" });
      }

      const datePart = swapReq.event_datetime.split("T")[0];

      const { data: assignment } = await supabase
        .from("schedule_assignments")
        .select("id")
        .eq("organization_id", swapReq.organization_id)
        .eq("ministry_id", swapReq.ministry_id)
        .eq("event_date", datePart)
        .eq("role", swapReq.role)
        .eq("member_id", swapReq.requester_id)
        .maybeSingle();

      if (assignment) {
        await supabase
          .from("schedule_assignments")
          .update({ member_id: acceptorId, confirmed: false })
          .eq("id", assignment.id);
      }

      await supabase
        .from("whatsapp_pending_actions")
        .update({ status: "resolved" })
        .eq("id", swapAction.id);

      await supabase
        .from("whatsapp_pending_actions")
        .update({ status: "expired" })
        .eq("swap_request_id", swapAction.swap_request_id)
        .eq("status", "pending");

      const [y, m, d] = datePart.split("-");
      const dateDisplay = `${d}/${m}/${y}`;

      await sendWhatsAppMessage(apiUrl, apiKey, instance, phone, `✅ *Troca confirmada!*\n\nVocê assumiu a escala de *${swapReq.requester_name}*.\n\n📋 Função: ${swapReq.role}\n🗓️ Data: ${dateDisplay}\n\nObrigado pela disponibilidade! 🙌`);

      const requesterPhone = formatBrazilPhone(swapReq.profiles?.whatsapp);
      if (requesterPhone) {
        await sendWhatsAppMessage(apiUrl, apiKey, instance, requesterPhone, `✅ *Sua troca foi aceita!*\n\n*${acceptorName}* vai assumir sua escala de *${swapReq.role}* no *${swapReq.event_title}* (${dateDisplay}).\n\nEscala atualizada automaticamente. 🎉`);
      }

      const { data: expiredActions } = await supabase
        .from("whatsapp_pending_actions")
        .select("phone")
        .eq("swap_request_id", swapAction.swap_request_id)
        .eq("status", "expired");

      const notified = new Set<string>([phone]);
      for (const other of (expiredActions ?? [])) {
        if (!notified.has(other.phone)) {
          notified.add(other.phone);
          await sendWhatsAppMessage(apiUrl, apiKey, instance, other.phone, `ℹ️ A vaga de *${swapReq.role}* já foi preenchida. Obrigado pela disponibilidade!`);
        }
      }

      return ok({ action: "swap_accepted", acceptorName });
    }

    return ok({ ignored: "unknown_message" });
  } catch (err: any) {
    console.error("[whatsapp-webhook] Erro crítico:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

function ok(body: object) {
  return new Response(JSON.stringify({ ok: true, ...body }), {
    headers: { "Content-Type": "application/json" },
  });
}
