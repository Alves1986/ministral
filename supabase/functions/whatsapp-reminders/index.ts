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
  proje: "💻",
  ilumina: "💡",
  luz: "💡",
  transmiss: "🖥️",
  camera: "🎥",
  câmera: "🎥",
  foto: "📸",
  stori: "📱",
  vocal: "🎤",
  ministro: "🎤",
  viol: "🎸",
  guitar: "🎸",
  baixo: "🎸",
  bater: "🥁",
  teclad: "🎹",
  som: "🎛️",
  áudio: "🎛️",
  audio: "🎛️",
  apresenta: "🎙️"
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
  const { timeout = 8000 } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  const response = await fetch(resource, {
    ...options,
    signal: controller.signal
  });
  clearTimeout(id);
  return response;
}

serve(async (req: Request) => {
  try {
    // ── 1. Autenticação do cron via secret header ─────────────────────────
    const cronSecret = Deno.env.get("WHATSAPP_CRON_SECRET");
    if (!cronSecret) {
      return new Response(JSON.stringify({ error: "Missing cron secret configuration" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const incomingSecret = req.headers.get("x-cron-secret");
    if (incomingSecret !== cronSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ── 2. Inicialização do cliente Supabase ──────────────────────────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Variáveis de ambiente do Supabase não configuradas.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── 3. Credenciais da Evolution API ───────────────────────────────────
    const evolutionApiUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");
    const globalInstanceName = Deno.env.get("EVOLUTION_INSTANCE_NAME");

    if (!evolutionApiUrl || !evolutionApiKey || !globalInstanceName) {
      throw new Error("Credenciais da Evolution API não configuradas (URL, Key ou Instance Name).");
    }

    // ── 4. Mapa de instâncias por ministério (Legado) ─────────────────────
    // NOTA: Vamos buscar, mas o código agora prioriza a Global se houver erro.
    const { data: mnWhatsapps, error: mnErr } = await supabase
      .from("ministry_whatsapp")
      .select("ministry_id, instance_name")
      .eq("connected", true);

    const ministryMap = new Map<string, string>();
    if (mnWhatsapps) {
      mnWhatsapps.forEach((mw: any) => {
        ministryMap.set(mw.ministry_id, mw.instance_name);
      });
    }

    // ── 5. Busca agendamentos pendentes ──────────────────────────────────
    const nowISO = new Date().toISOString();
    const { data: pendingNotifs, error: pendErr } = await supabase
      .from("whatsapp_scheduled_notifications")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_at", nowISO);

    if (pendErr) throw pendErr;
    if (!pendingNotifs || pendingNotifs.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "Nenhum agendamento pendente." }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`[whatsapp-reminders] Processando ${pendingNotifs.length} agendamento(s)...`);
    const results: any[] = [];

    for (const notif of pendingNotifs) {
      try {
        const targetDate = notif.event_date;
        const orgId = notif.org_id;

        // ── 6. Busca assignments ──────────────────────────────────────────
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
        if (notif.ministry_id) query = query.eq("ministry_id", notif.ministry_id);

        const { data: assignments, error: assigErr } = await query;
        if (assigErr) {
          await supabase.from("whatsapp_scheduled_notifications").update({ status: "failed" }).eq("id", notif.id);
          continue;
        }

        if (!assignments || assignments.length === 0) {
          await supabase.from("whatsapp_scheduled_notifications").update({ status: "sent" }).eq("id", notif.id);
          continue;
        }

        let sent = 0, skipped = 0, errors = 0;

        // ── 7. Agrupar por evento ─────────────────────────────────────────
        const eventsMap = new Map<string, any[]>();
        for (const a of assignments) {
          const key = `${a.ministry_id}_${a.event_rule_id || 'fallback'}`;
          if (!eventsMap.has(key)) eventsMap.set(key, []);
          eventsMap.get(key)!.push(a);
        }

        // ── 8. Processar envios ───────────────────────────────────────────
        for (const [key, evAssignments] of eventsMap.entries()) {
          const firstAssig = evAssignments[0];
          const eventTitle = firstAssig.event_rules?.title || notif.event_title || "Culto";
          const eventTimeStr = firstAssig.event_rules?.time ? firstAssig.event_rules.time.substring(0, 5) : "00:00";
          const ministryLabel = firstAssig.organization_ministries?.label || "Ministério";
          const [tY, tM, tD] = targetDate.split('-');
          const dateStr = `${tD}/${tM}/${tY}`;

          const roleMembers = new Map<string, string[]>();
          for (const a of evAssignments) {
            const memberName = a.profiles?.name || "Desconhecido";
            if (!roleMembers.has(a.role)) roleMembers.set(a.role, []);
            roleMembers.get(a.role)!.push(memberName);
          }

          let teamList = "";
          for (const [role, members] of roleMembers.entries()) {
            teamList += `${getEmojiForRole(role)} *${role}:* ${members.join(", ")}\n`;
          }

          const msg = `*Escala para o ${eventTitle}*\n\n🗓️ *Data:* ${dateStr}\n⏰ *Horário:* ${eventTimeStr}\n⛪ *Ministério:* ${ministryLabel}\n\n*Equipe Escalada:*\n\n${teamList}\n${DEFAULT_ORIENTATIONS}`;

          const processedPhones = new Set<string>();
          for (const a of evAssignments) {
            const profile = a.profiles;
            if (!profile || !profile.whatsapp) { skipped++; continue; }
            const phone = formatBrazilPhone(profile.whatsapp);
            if (!phone || processedPhones.has(phone)) { skipped++; continue; }
            processedPhones.add(phone);

            // TENTA ENVIAR (Lógica Robusta de Instância)
            // 1. Tenta a instância do ministério se existir no mapa
            // 2. Se falhar com "Connection Closed" ou não existir, usa a GLOBAL
            let instanceToUse = ministryMap.get(a.ministry_id) || globalInstanceName;
            let success = false;
            let attempt = 0;

            while (attempt < 2 && !success) {
              attempt++;
              try {
                const endpoint = `${evolutionApiUrl}/message/sendText/${instanceToUse}`;
                const res = await fetchWithTimeout(endpoint, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "apikey": evolutionApiKey },
                  body: JSON.stringify({ number: phone, options: { delay: 1200 }, text: msg }),
                  timeout: 10000
                });

                const resText = await res.text();
                if (res.ok) {
                  success = true;
                  sent++;
                  console.log(`[whatsapp-reminders] Sucesso para ${phone} via ${instanceToUse}`);
                } else {
                  // Se o erro for de conexão fechada ou instância inválida, troca para a GLOBAL na próxima tentativa
                  if (resText.includes("Connection Closed") || res.status === 404 || res.status === 500) {
                    console.warn(`[whatsapp-reminders] Falha na instância ${instanceToUse}. Tentando Global...`);
                    instanceToUse = globalInstanceName; 
                  } else {
                    throw new Error(`Evolution Error ${res.status}: ${resText}`);
                  }
                }
              } catch (err: any) {
                if (attempt >= 2) {
                  console.error(`[whatsapp-reminders] Erro final para ${phone}:`, err.message);
                  errors++;
                } else {
                  instanceToUse = globalInstanceName; // Fallback forzado
                }
              }
            }
          }
        }

        await supabase.from("whatsapp_scheduled_notifications")
          .update({ status: errors > 0 && sent === 0 ? "failed" : "sent" })
          .eq("id", notif.id);

        results.push({ notif_id: notif.id, sent, errors });
      } catch (notifErr: any) {
        console.error(`[whatsapp-reminders] Erro notif ${notif.id}:`, notifErr);
        await supabase.from("whatsapp_scheduled_notifications").update({ status: "failed" }).eq("id", notif.id);
      }
    }

    return new Response(JSON.stringify({ success: true, results }), { headers: { "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("[whatsapp-reminders] Erro crítico:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
