import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Formata número BR para a Evolution API. Retorna null se inválido. */
function formatBrazilPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('55')) digits = digits.slice(2);
  if (digits.length < 10 || digits.length > 11) return null;
  return '55' + digits;
}

const ROLE_EMOJIS: Record<string, string> = {
  proje: "💻", ilumina: "💡", luz: "💡", transmiss: "🖥️", camera: "🎥",
  câmera: "🎥", foto: "📸", stori: "📱", vocal: "🎤", ministro: "🎤",
  viol: "🎸", guitar: "🎸", baixo: "🎸", bater: "🥁", teclad: "🎹",
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

async function fetchWithTimeout(resource: string, options: RequestInit & { timeout?: number }) {
  const { timeout = 10000 } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(resource, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

serve(async (req: Request) => {
  console.log("[whatsapp-reminders] Execução iniciada.");
  try {
    // ── 1. Autenticação ──────────────────────────────────────────────────
    const cronSecret = Deno.env.get("WHATSAPP_CRON_SECRET");
    const incomingSecret = req.headers.get("x-cron-secret");
    if (incomingSecret !== cronSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    // ── 2. Configurações ──────────────────────────────────────────────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const evolutionApiUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");
    const globalInstanceName = Deno.env.get("EVOLUTION_INSTANCE_NAME");

    console.log(`[whatsapp-reminders] Config: URL=${evolutionApiUrl}, Instance=${globalInstanceName}`);

    if (!supabaseUrl || !supabaseServiceKey || !evolutionApiUrl || !evolutionApiKey || !globalInstanceName) {
      throw new Error("Variáveis de ambiente incompletas no Supabase.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── 3. Busca agendamentos ────────────────────────────────────────────
    const nowISO = new Date().toISOString();
    const { data: pendingNotifs, error: pendErr } = await supabase
      .from("whatsapp_scheduled_notifications")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_at", nowISO);

    if (pendErr) throw pendErr;
    if (!pendingNotifs || pendingNotifs.length === 0) {
      console.log("[whatsapp-reminders] Nenhum agendamento para processar.");
      return new Response(JSON.stringify({ success: true, message: "Vazio" }));
    }

    console.log(`[whatsapp-reminders] Processando ${pendingNotifs.length} agendamento(s)...`);

    for (const notif of pendingNotifs) {
      try {
        // ── 4. Busca assignments ──────────────────────────────────────────
        const { data: assignments, error: assigErr } = await supabase
          .from("schedule_assignments")
          .select(`
            id, member_id, role, event_date,
            profiles:member_id ( whatsapp, name ),
            organization_ministries:ministry_id ( label ),
            event_rules:event_rule_id ( title, time )
          `)
          .eq("organization_id", notif.org_id)
          .eq("event_date", notif.event_date)
          .filter(notif.event_rule_id ? "event_rule_id" : "id", "not.is", null); // Hack para filtro condicional

        // Refinando o filtro se necessário (Supabase JS não é tão flexível com filtros dinâmicos em strings)
        let filteredAssignments = assignments || [];
        if (notif.event_rule_id) filteredAssignments = filteredAssignments.filter(a => a.event_rule_id === notif.event_rule_id);
        if (notif.ministry_id) filteredAssignments = filteredAssignments.filter(a => a.ministry_id === notif.ministry_id);

        if (assigErr || filteredAssignments.length === 0) {
          console.log(`[whatsapp-reminders] Notif ${notif.id} sem assignments ou erro.`);
          await supabase.from("whatsapp_scheduled_notifications").update({ status: "sent" }).eq("id", notif.id);
          continue;
        }

        let sentCount = 0;
        let errorCount = 0;

        // ── 5. Monta Mensagem (Simplificado: uma mensagem por notif/evento) ──
        const first = filteredAssignments[0];
        const eventTitle = first.event_rules?.title || notif.event_title || "Evento";
        const eventTime = first.event_rules?.time?.substring(0, 5) || "00:00";
        const [y, m, d] = notif.event_date.split('-');
        
        const roleGroups = new Map<string, string[]>();
        filteredAssignments.forEach(a => {
          if (!roleGroups.has(a.role)) roleGroups.set(a.role, []);
          roleGroups.get(a.role)!.push(a.profiles?.name || "Membro");
        });

        let team = "";
        for (const [role, members] of roleGroups.entries()) {
          team += `${getEmojiForRole(role)} *${role}:* ${members.join(", ")}\n`;
        }

        const msg = `*Escala: ${eventTitle}*\n🗓️ *Data:* ${d}/${m}/${y}\n⏰ *Hora:* ${eventTime}\n\n*Equipe:*\n${team}\n${DEFAULT_ORIENTATIONS}`;

        // ── 6. Envio via Evolution (APENAS GLOBAL) ────────────────────────
        const processedPhones = new Set<string>();
        for (const a of filteredAssignments) {
          const phone = formatBrazilPhone(a.profiles?.whatsapp);
          if (!phone || processedPhones.has(phone)) continue;
          processedPhones.add(phone);

          console.log(`[whatsapp-reminders] Tentando enviar para ${phone} via Global: ${globalInstanceName}`);
          
          try {
            const endpoint = `${evolutionApiUrl}/message/sendText/${globalInstanceName}`;
            const response = await fetchWithTimeout(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json", "apikey": evolutionApiKey },
              body: JSON.stringify({ number: phone, options: { delay: 1200 }, text: msg })
            });

            const resData = await response.text();
            if (response.ok) {
              console.log(`[whatsapp-reminders] ✅ SUCESSO: ${phone}`);
              sentCount++;
            } else {
              console.error(`[whatsapp-reminders] ❌ ERRO Evolution (${response.status}): ${resData}`);
              errorCount++;
            }
          } catch (err: any) {
            console.error(`[whatsapp-reminders] ❌ ERRO FETCH para ${phone}:`, err.message);
            errorCount++;
          }
        }

        // ── 7. Atualiza Status ───────────────────────────────────────────
        const finalStatus = (errorCount > 0 && sentCount === 0) ? "failed" : "sent";
        await supabase.from("whatsapp_scheduled_notifications")
          .update({ status: finalStatus })
          .eq("id", notif.id);
        
        console.log(`[whatsapp-reminders] Notif ${notif.id} finalizada. Sent: ${sentCount}, Errors: ${errorCount}`);

      } catch (innerErr: any) {
        console.error(`[whatsapp-reminders] Erro processando notif ${notif.id}:`, innerErr.message);
      }
    }

    return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("[whatsapp-reminders] Erro fatal:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
