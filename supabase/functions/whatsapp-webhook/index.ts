/**
 * whatsapp-webhook — Recebe eventos da Evolution API e processa respostas dos membros.
 *
 * ── CONFIGURAÇÃO NA EVOLUTION API ────────────────────────────────────────────
 * Configure este endpoint como webhook da instância:
 *   URL: https://<seu-projeto>.supabase.co/functions/v1/whatsapp-webhook
 *   Eventos: messages.upsert
 *
 * ── FLUXO DE CONFIRMAÇÃO ─────────────────────────────────────────────────────
 *   Membro responde "1" → confirma presença na escala
 *   Membro responde "2" → recusa presença
 *
 * ── FLUXO DE TROCA ───────────────────────────────────────────────────────────
 *   Membro responde "SIM" → assume a escala (primeiro a responder ganha)
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { formatBrazilPhone, phoneFromJid } from "./_shared/phoneFormatter.ts";
import { sendWhatsAppMessage } from "./_shared/evolutionClient.ts";

// ── Utilitários ───────────────────────────────────────────────────────────────

/** Wrapper de conveniência para manter a assinatura local compacta. */
async function sendWpp(
  apiUrl: string,
  apiKey: string,
  instance: string,
  phone: string,
  text: string
) {
  const { error } = await sendWhatsAppMessage(apiUrl, apiKey, instance, phone, text);
  if (error) {
    console.error("[whatsapp-webhook] Falha ao enviar mensagem:", error);
  }
}

// ── Handler principal ─────────────────────────────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
    const defaultInst = Deno.env.get("EVOLUTION_INSTANCE_NAME")!;

    // Validação do x-webhook-secret (SEC-01)
    const webhookSecret = Deno.env.get("EVOLUTION_WEBHOOK_SECRET");
    const receivedSecret = req.headers.get("x-webhook-secret");
    if (webhookSecret && receivedSecret !== webhookSecret) {
      console.warn("[whatsapp-webhook] Acesso não autorizado. Secret incorreto.");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const body = await req.json();

    // ── 1. Filtrar apenas messages.upsert ─────────────────────────────────
    if (body.event !== "messages.upsert") {
      return ok({ ignored: "event_type" });
    }

    const data = body.data ?? {};
    const key  = data.key ?? {};

    // Ignorar mensagens enviadas por nós mesmos
    if (key.fromMe === true) return ok({ ignored: "fromMe" });

    const remoteJid: string = key.remoteJid ?? "";

    // Ignorar grupos e broadcasts
    if (remoteJid.endsWith("@g.us") || remoteJid.endsWith("@broadcast")) {
      return ok({ ignored: "group/broadcast" });
    }

    // ── 2. Extrair texto da mensagem ──────────────────────────────────────
    const msgObj = data.message ?? {};
    const rawText = (
      msgObj.conversation ??
      msgObj.extendedTextMessage?.text ??
      msgObj.buttonsResponseMessage?.selectedDisplayText ??
      ""
    ).trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    if (!rawText) return ok({ ignored: "empty_message" });

    // ── 3. Normalizar número e buscar ações pendentes ─────────────────────
    const phone = phoneFromJid(remoteJid);
    if (!phone) return ok({ ignored: "invalid_phone" });

    const instance = body.instance ?? defaultInst;

    const { data: pendingActions } = await supabase
      .from("whatsapp_pending_actions")
      .select("*")
      .eq("phone", phone)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (!pendingActions || pendingActions.length === 0) {
      return ok({ ignored: "no_pending_actions" });
    }

    // ── 4. CONFIRMAÇÃO DE PRESENÇA ────────────────────────────────────────
    //    "1" → confirma | "2" → recusa
    if (rawText === "1" || rawText === "CONFIRMAR") {
      const action = pendingActions.find((a: any) => a.type === "confirmation");
      if (action) {
        // Confirma TODAS as funções do membro neste evento
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

        await sendWpp(apiUrl, apiKey, instance, phone,
          `✅ *Presença confirmada!*\n\nObrigado! Te esperamos lá. 🙏`
        );

        return ok({ action: "confirmed" });
      }
    }

    if (rawText === "2" || rawText === "NAO" || rawText === "RECUSAR") {
      const action = pendingActions.find((a: any) => a.type === "confirmation");
      if (action) {
        await supabase
          .from("whatsapp_pending_actions")
          .update({ status: "resolved" })
          .eq("id", action.id);

        await sendWpp(apiUrl, apiKey, instance, phone,
          `❌ *Recusa registrada.*\n\nEntendido! A liderança será avisada. Se precisar, entre em contato com seu líder. 🙏`
        );

        return ok({ action: "declined" });
      }
    }

    // ── 5. ACEITE DE TROCA ────────────────────────────────────────────────
    //    "SIM" → membro quer assumir a escala
    if (rawText === "SIM") {
      const swapAction = pendingActions.find((a: any) => a.type === "swap_accept");
      if (!swapAction) return ok({ ignored: "no_swap_pending" });

      // Identifica quem está aceitando pelo número
      let acceptorId: string | null = null;
      let acceptorName: string | null = null;

      // Tenta busca direta (se whatsapp foi salvo formatado)
      const { data: directProfile } = await supabase
        .from("profiles")
        .select("id, name")
        .eq("whatsapp", phone)
        .maybeSingle();

      if (directProfile) {
        acceptorId   = directProfile.id;
        acceptorName = directProfile.name;
      } else {
        // Fallback: normaliza todos os números e compara
        const { data: allProfiles } = await supabase
          .from("profiles")
          .select("id, name, whatsapp")
          .not("whatsapp", "is", null);

        const found = (allProfiles ?? []).find(
          (p: any) => formatBrazilPhone(p.whatsapp) === phone
        );
        acceptorId   = found?.id ?? null;
        acceptorName = found?.name ?? null;
      }

      if (!acceptorId) {
        console.error("[whatsapp-webhook] Aceitante não encontrado para phone:", phone);
        return ok({ error: "acceptor_not_found" });
      }

      // ── UPDATE ATÔMICO: elimina race condition ────────────────────────
      // A cláusula .eq("status", "pending") garante que somente um membro
      // por vez conseguirá atualizar a linha. Se retornar null, a vaga já
      // foi fechada por uma requisição concorrente.
      const { data: atomicUpdate, error: atomicErr } = await supabase
        .from("swap_requests")
        .update({ status: "completed", taken_by_id: acceptorId, taken_by_name: acceptorName })
        .eq("id", swapAction.swap_request_id)
        .eq("status", "pending") // ← garante atomicidade
        .select("*, profiles:requester_id(name, whatsapp)")
        .maybeSingle();

      if (atomicErr) {
        console.error("[whatsapp-webhook] Erro ao executar update atômico:", atomicErr);
        return ok({ error: "atomic_update_failed" });
      }

      if (!atomicUpdate) {
        // Vaga fechada por requisição concorrente — expira esta ação
        await supabase
          .from("whatsapp_pending_actions")
          .update({ status: "expired" })
          .eq("id", swapAction.id);

        await sendWpp(apiUrl, apiKey, instance, phone,
          `ℹ️ Esta vaga já foi preenchida por outro membro. Obrigado pela disponibilidade! 🙌`
        );

        return ok({ action: "swap_already_taken" });
      }

      // ── Atualiza o assignment na escala ───────────────────────────────
      const datePart = atomicUpdate.event_datetime.split("T")[0];

      const { data: assignment } = await supabase
        .from("schedule_assignments")
        .select("id")
        .eq("organization_id", atomicUpdate.organization_id)
        .eq("ministry_id", atomicUpdate.ministry_id)
        .eq("event_date", datePart)
        .eq("role", atomicUpdate.role)
        .eq("member_id", atomicUpdate.requester_id)
        .maybeSingle();

      if (assignment) {
        await supabase
          .from("schedule_assignments")
          .update({ member_id: acceptorId, confirmed: false })
          .eq("id", assignment.id);
      }

      // Marca esta ação como resolvida
      await supabase
        .from("whatsapp_pending_actions")
        .update({ status: "resolved" })
        .eq("id", swapAction.id);

      // Expira todos os outros pendentes deste mesmo swap
      await supabase
        .from("whatsapp_pending_actions")
        .update({ status: "expired" })
        .eq("swap_request_id", swapAction.swap_request_id)
        .eq("status", "pending");

      // ── Notificações de resultado ─────────────────────────────────────
      const [y, m, d] = datePart.split("-");
      const dateDisplay = `${d}/${m}/${y}`;

      // Confirma para o aceitante
      await sendWpp(apiUrl, apiKey, instance, phone,
        `✅ *Troca confirmada!*\n\nVocê assumiu a escala de *${atomicUpdate.requester_name}*.\n\n📋 Função: ${atomicUpdate.role}\n🗓️ Data: ${dateDisplay}\n\nObrigado pela disponibilidade! 🙌`
      );

      // Avisa o solicitante original
      const requesterPhone = formatBrazilPhone(atomicUpdate.profiles?.whatsapp);
      if (requesterPhone) {
        await sendWpp(apiUrl, apiKey, instance, requesterPhone,
          `✅ *Sua troca foi aceita!*\n\n*${acceptorName}* vai assumir sua escala de *${atomicUpdate.role}* no *${atomicUpdate.event_title}* (${dateDisplay}).\n\nEscala atualizada automaticamente. 🎉`
        );
      }

      // Avisa os outros que a vaga foi preenchida
      const { data: expiredActions } = await supabase
        .from("whatsapp_pending_actions")
        .select("phone")
        .eq("swap_request_id", swapAction.swap_request_id)
        .eq("status", "expired");

      const notified = new Set<string>([phone]); // já notificamos o aceitante
      for (const other of (expiredActions ?? [])) {
        if (!notified.has(other.phone)) {
          notified.add(other.phone);
          await sendWpp(apiUrl, apiKey, instance, other.phone,
            `ℹ️ A vaga de *${atomicUpdate.role}* já foi preenchida. Obrigado pela disponibilidade!`
          );
        }
      }

      return ok({ action: "swap_accepted", acceptorName });
    }

    return ok({ ignored: "unknown_message" });
  } catch (err: any) {
    console.error("[whatsapp-webhook] Erro crítico:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});

function ok(body: object) {
  return new Response(JSON.stringify({ ok: true, ...body }), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
