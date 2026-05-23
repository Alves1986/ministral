import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { formatBrazilPhone } from "./_shared/phoneFormatter.ts";
import { sendWhatsAppMessage } from "./_shared/evolutionClient.ts";

// ── Constantes ────────────────────────────────────────────────────────────────

const ROLE_EMOJIS: Record<string, string> = {
  proje: "💻", ilumina: "💡", luz: "💡", transmiss: "🖥️",
  camera: "🎥", câmera: "🎥", foto: "📸", stori: "📱",
  vocal: "🎤", ministro: "🎤", viol: "🎸", guitar: "🎸",
  baixo: "🎸", bater: "🥁", teclad: "🎹",
  som: "🎛️", áudio: "🎛️", audio: "🎛️", apresenta: "🎙️"
};

function getEmojiForRole(role: string): string {
  const rLow = role.toLowerCase();
  for (const [key, emoji] of Object.entries(ROLE_EMOJIS)) {
    if (rLow.includes(key)) return emoji;
  }
  return "🔹";
}

const DEFAULT_ORIENTATIONS = `⚠️ *Orientações:*
1. Cheguem com 30 minutos de antecedência para check-list dos equipamentos.
2. Caso haja algum imprevisto, comuniquem a liderança imediatamente.
3. Não esqueça de Confirmar a escala realizando o check-in no aplicativo.

Vamos juntos servir com excelência! 🚀`;

// ── Função de processamento por notificação ───────────────────────────────────

async function processNotification(
  notif: any,
  supabase: ReturnType<typeof createClient>,
  evolutionApiUrl: string,
  evolutionApiKey: string,
  defaultInstance: string,
  ministryMap: Map<string, string>
): Promise<object> {
  const targetDate = notif.event_date;
  // Suporte a ambas as colunas durante período de migração
  const orgId = notif.organization_id || notif.org_id;

  // ── Verificação do plano e flag global ───────────────────────────────────
  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .select("plan_type, whatsapp_enabled")
    .eq("id", orgId)
    .single();

  if (orgErr || !org) {
    await supabase.from("whatsapp_scheduled_notifications")
      .update({ status: "failed", error_message: "Organização não encontrada" })
      .eq("id", notif.id);
    return { notif_id: notif.id, error: "Organização não encontrada" };
  }

  if (org.plan_type !== "enterprise" || !org.whatsapp_enabled) {
    await supabase.from("whatsapp_scheduled_notifications")
      .update({
        status: "failed",
        error_message: `WhatsApp bloqueado. Plano: ${org.plan_type}, Ativo: ${org.whatsapp_enabled}`
      })
      .eq("id", notif.id);
    return { notif_id: notif.id, skipped: true, reason: "plan_or_flag" };
  }

  // ── Busca assignments do evento ──────────────────────────────────────────
  let query = supabase
    .from("schedule_assignments")
    .select(`
      id, member_id, role, event_date, event_rule_id, ministry_id,
      profiles:member_id ( whatsapp, name ),
      organization_ministries:ministry_id ( label ),
      event_rules:event_rule_id ( title, time )
    `)
    .eq("organization_id", orgId)
    .eq("event_date", targetDate);

  if (notif.event_rule_id) query = query.eq("event_rule_id", notif.event_rule_id);
  if (notif.ministry_id)   query = query.eq("ministry_id", notif.ministry_id);

  const { data: assignments, error: assigErr } = await query;

  if (assigErr) {
    await supabase.from("whatsapp_scheduled_notifications").update({ status: "failed" }).eq("id", notif.id);
    return { notif_id: notif.id, error: assigErr.message };
  }

  if (!assignments || assignments.length === 0) {
    await supabase.from("whatsapp_scheduled_notifications").update({ status: "sent" }).eq("id", notif.id);
    return { notif_id: notif.id, date: targetDate, sent: 0, reason: "Sem assignments." };
  }

  let sent = 0, skipped = 0, errors = 0;

  // ── Agrupa assignments por evento e ministério ───────────────────────────
  const eventsMap = new Map<string, any[]>();
  for (const a of assignments) {
    const key = `${a.ministry_id}_${a.event_rule_id || `fallback_${a.event_date}`}`;
    if (!eventsMap.has(key)) eventsMap.set(key, []);
    eventsMap.get(key)!.push(a);
  }

  // ── Processa cada grupo ──────────────────────────────────────────────────
  for (const evAssignments of eventsMap.values()) {
    const first = evAssignments[0];
    if (!first) continue;

    const eventTitle    = first.event_rules?.title || notif.event_title || "Culto";
    const eventTimeStr  = first.event_rules?.time?.substring(0, 5) ?? "00:00";
    const ministryLabel = first.organization_ministries?.label || "Ministério";
    const [tY, tM, tD]  = targetDate.split("-");
    const dateStr = `${tD}/${tM}/${tY}`;

    // Monta lista de membros por função
    const roleMembers = new Map<string, string[]>();
    for (const a of evAssignments) {
      const name = a.profiles?.name || "Desconhecido";
      if (!roleMembers.has(a.role)) roleMembers.set(a.role, []);
      roleMembers.get(a.role)!.push(name);
    }

    let teamList = "";
    for (const [role, members] of roleMembers.entries()) {
      teamList += `${getEmojiForRole(role)} *${role}:* ${members.join(", ")}\n`;
    }

    const msg =
      `*Escala para o ${eventTitle}*\n\n` +
      `🗓️ *Data:* ${dateStr}\n⏰ *Horário:* ${eventTimeStr}\n⛪ *Ministério:* ${ministryLabel}\n\n` +
      `*Equipe Escalada:*\n\n${teamList}\n${DEFAULT_ORIENTATIONS}`;

    const sentToPhones    = new Set<string>();
    const processedMembers = new Set<string>();

    for (const a of evAssignments) {
      const profile = a.profiles;
      if (!profile?.whatsapp) { skipped++; continue; }
      if (processedMembers.has(a.member_id)) { skipped++; continue; }
      processedMembers.add(a.member_id);

      const formattedPhone = formatBrazilPhone(profile.whatsapp);
      if (!formattedPhone) {
        skipped++;
        console.warn(`[whatsapp-reminders] Número inválido: "${profile.whatsapp}"`);
        continue;
      }
      if (sentToPhones.has(formattedPhone)) { skipped++; continue; }
      sentToPhones.add(formattedPhone);

      const currentInstance = ministryMap.get(a.ministry_id) || defaultInstance;
      const { success: msgOk, error: msgErr } = await sendWhatsAppMessage(
        evolutionApiUrl, evolutionApiKey, currentInstance, formattedPhone, msg,
        { timeout: 5000, retries: 2 }
      );

      if (msgOk) {
        console.log(`[whatsapp-reminders] ✅ ${profile.name} (${formattedPhone})`);
        sent++;
        // Registra log de forma não-bloqueante
        supabase.from("whatsapp_usage_logs").insert({
          organization_id: orgId,
          ministry_id: a.ministry_id,
          instance_name: currentInstance,
          recipient_phone: formattedPhone
        }).then(({ error: logErr }) => {
          if (logErr) console.warn("[whatsapp-reminders] Log error:", logErr.message);
        });
      } else {
        console.error(`[whatsapp-reminders] ❌ ${formattedPhone}:`, msgErr);
        errors++;
      }
    }
  }

  // ── Marca status final ───────────────────────────────────────────────────
  await supabase.from("whatsapp_scheduled_notifications")
    .update({ status: errors > 0 && sent === 0 ? "failed" : "sent" })
    .eq("id", notif.id);

  return { notif_id: notif.id, date: targetDate, title: notif.event_title, sent, skipped, errors };
}

// ── Handler principal (chamado pelo cron) ─────────────────────────────────────

serve(async (req: Request) => {
  try {
    // ── 1. Autenticação via secret header ────────────────────────────────
    const cronSecret = Deno.env.get("WHATSAPP_CRON_SECRET");
    if (!cronSecret) {
      return new Response(JSON.stringify({ error: "Missing cron secret configuration" }), {
        status: 500, headers: { "Content-Type": "application/json" },
      });
    }
    if (req.headers.get("x-cron-secret") !== cronSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json" },
      });
    }

    // ── 2. Inicialização ─────────────────────────────────────────────────
    const supabaseUrl        = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const evolutionApiUrl    = Deno.env.get("EVOLUTION_API_URL");
    const evolutionApiKey    = Deno.env.get("EVOLUTION_API_KEY");
    const instanceName       = Deno.env.get("EVOLUTION_INSTANCE_NAME");

    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Variáveis Supabase não configuradas.");
    if (!evolutionApiUrl || !evolutionApiKey || !instanceName) throw new Error("Credenciais Evolution API não configuradas.");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── 3. Mapa de instâncias por ministério ─────────────────────────────
    const { data: mnWhatsapps, error: mnErr } = await supabase
      .from("ministry_whatsapp").select("ministry_id, instance_name").eq("connected", true);
    if (mnErr) console.error("[whatsapp-reminders] Erro ao buscar ministry_whatsapp:", mnErr);

    const ministryMap = new Map<string, string>(
      (mnWhatsapps || []).map((mw: any) => [mw.ministry_id, mw.instance_name])
    );

    // ── 4. Busca agendamentos pendentes cujo horário já chegou ───────────
    const nowISO = new Date().toISOString();
    const { data: pendingNotifs, error: pendErr } = await supabase
      .from("whatsapp_scheduled_notifications")
      .select("*").eq("status", "pending").lte("scheduled_at", nowISO);

    if (pendErr) { console.error("[whatsapp-reminders] Erro:", pendErr); throw pendErr; }
    if (!pendingNotifs || pendingNotifs.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "Nenhum agendamento pendente." }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`[whatsapp-reminders] Processando ${pendingNotifs.length} agendamento(s) em paralelo (batch=3)...`);

    // ── 5. Processamento paralelo com concorrência limitada (max 3) ──────
    const CONCURRENCY = 3;
    const results: any[] = [];

    for (let i = 0; i < pendingNotifs.length; i += CONCURRENCY) {
      const batch = pendingNotifs.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.allSettled(
        batch.map(notif =>
          processNotification(notif, supabase, evolutionApiUrl, evolutionApiKey, instanceName, ministryMap)
        )
      );
      batchResults.forEach(r => {
        if (r.status === "fulfilled") results.push(r.value);
        else results.push({ error: r.reason?.message || "Erro desconhecido" });
      });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[whatsapp-reminders] Erro crítico:", error);
    return new Response(JSON.stringify({ error: "Ocorreu um erro interno no processamento do cron." }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});