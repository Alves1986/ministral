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
    const instanceName    = Deno.env.get("EVOLUTION_INSTANCE_NAME");

    if (!evolutionApiUrl || !evolutionApiKey || !instanceName) {
      throw new Error("Credenciais da Evolution API não configuradas.");
    }

    // ── 4. Mapa de instâncias por ministério ──────────────────────────────
    const { data: mnWhatsapps, error: mnErr } = await supabase
      .from("ministry_whatsapp")
      .select("ministry_id, instance_name")
      .eq("connected", true);

    if (mnErr) {
      console.error("[whatsapp-reminders] Erro ao buscar ministry_whatsapp:", mnErr);
    }

    const ministryMap = new Map<string, string>();
    if (mnWhatsapps) {
      mnWhatsapps.forEach((mw: any) => {
        ministryMap.set(mw.ministry_id, mw.instance_name);
      });
    }

    // ── 5. Busca agendamentos pendentes cujo horário já chegou ──────────
    const nowISO = new Date().toISOString();

    const { data: pendingNotifs, error: pendErr } = await supabase
      .from("whatsapp_scheduled_notifications")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_at", nowISO);

    if (pendErr) {
      console.error("[whatsapp-reminders] Erro ao buscar agendamentos:", pendErr);
      throw pendErr;
    }

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

        // --- VERIFICAÇÃO DO PLANO E DA FLAG GLOBAL ---
        const { data: org, error: orgErr } = await supabase
          .from("organizations")
          .select("plan_type, whatsapp_enabled")
          .eq("id", orgId)
          .single();

        if (orgErr || !org) {
          console.error(`[whatsapp-reminders] Org ${orgId} não encontrada ou erro:`, orgErr);
          await supabase
            .from("whatsapp_scheduled_notifications")
            .update({ status: "failed", error_message: "Organização não encontrada" })
            .eq("id", notif.id);
          continue;
        }

        if (org.plan_type !== "enterprise" || !org.whatsapp_enabled) {
          console.log(`[whatsapp-reminders] Envio ignorado para Org ${orgId}. Plano: ${org.plan_type}, Whatsapp Ativo: ${org.whatsapp_enabled}`);
          await supabase
            .from("whatsapp_scheduled_notifications")
            .update({ 
              status: "failed", 
              error_message: `WhatsApp bloqueado. Requer plano Enterprise e flag ativa (Plano atual: ${org.plan_type}, Status: ${org.whatsapp_enabled ? 'ativo' : 'inativo'})` 
            })
            .eq("id", notif.id);
          continue;
        }

        // ── 6. Busca assignments do evento ──────────────────────────────────
        let query = supabase
          .from("schedule_assignments")
          .select(`
            id,
            member_id,
            role,
            event_date,
            event_rule_id,
            ministry_id,
            profiles:member_id ( whatsapp, name ),
            organization_ministries:ministry_id ( label ),
            event_rules:event_rule_id ( title, time )
          `)
          .eq("organization_id", orgId)
          .eq("event_date", targetDate);

        // Se tiver event_rule_id, filtra por ele
        if (notif.event_rule_id) {
          query = query.eq("event_rule_id", notif.event_rule_id);
        }
        // Se tiver ministry_id, filtra por ele
        if (notif.ministry_id) {
          query = query.eq("ministry_id", notif.ministry_id);
        }

        const { data: assignments, error: assigErr } = await query;

        if (assigErr) {
          console.error(`[whatsapp-reminders] Erro ao buscar assignments para notif ${notif.id}:`, assigErr);
          await supabase.from("whatsapp_scheduled_notifications").update({ status: "failed" }).eq("id", notif.id);
          results.push({ notif_id: notif.id, error: assigErr.message });
          continue;
        }

        if (!assignments || assignments.length === 0) {
          console.log(`[whatsapp-reminders] Nenhum assignment para notif ${notif.id} (date: ${targetDate})`);
          await supabase.from("whatsapp_scheduled_notifications").update({ status: "sent" }).eq("id", notif.id);
          results.push({ notif_id: notif.id, date: targetDate, sent: 0, reason: "Sem assignments." });
          continue;
        }

        let sent = 0, skipped = 0, errors = 0;

        // ── 7. Agrupar assignments por evento e ministério ───────────────────
        const eventsMap = new Map<string, any[]>();
        for (const assignment of assignments) {
          const ruleId = assignment.event_rule_id || `fallback_${assignment.event_date}`;
          const key = `${assignment.ministry_id}_${ruleId}`;
          if (!eventsMap.has(key)) eventsMap.set(key, []);
          eventsMap.get(key)!.push(assignment);
        }

        // ── 8. Processar cada evento ──────────────────────────────────────────
        for (const [key, evAssignments] of eventsMap.entries()) {
          const firstAssig = evAssignments[0];
          if (!firstAssig) continue;
          const eventTitle = firstAssig.event_rules?.title || notif.event_title || "Culto";
          const eventTimeStr = firstAssig.event_rules?.time ? firstAssig.event_rules.time.substring(0, 5) : "00:00";
          const ministryLabel = firstAssig.organization_ministries?.label || "Ministério";
          
          const [tY, tM, tD] = targetDate.split('-');
          const dateStr = `${tD}/${tM}/${tY}`;

          // Agrupa membros por função (role)
          const roleMembers = new Map<string, string[]>();
          for (const a of evAssignments) {
            const memberName = a.profiles?.name || "Desconhecido";
            if (!roleMembers.has(a.role)) roleMembers.set(a.role, []);
            roleMembers.get(a.role)!.push(memberName);
          }

          let teamList = "";
          for (const [role, members] of roleMembers.entries()) {
            const emoji = getEmojiForRole(role);
            teamList += `${emoji} *${role}:* ${members.join(", ")}\n`;
          }

          const msg = `*Escala para o ${eventTitle}*\n\n🗓️ *Data:* ${dateStr}\n⏰ *Horário:* ${eventTimeStr}\n⛪ *Ministério:* ${ministryLabel}\n\n*Equipe Escalada:*\n\n${teamList}\n${DEFAULT_ORIENTATIONS}`;

          const sentToPhones = new Set<string>();
          const processedMembers = new Set<string>();

          for (const a of evAssignments) {
            const profile = a.profiles;
            if (!profile || !profile.whatsapp) {
              skipped++;
              continue;
            }

            if (processedMembers.has(a.member_id)) {
              skipped++;
              continue;
            }
            processedMembers.add(a.member_id);

            const formattedPhone = formatBrazilPhone(profile.whatsapp);
            if (!formattedPhone) {
              skipped++;
              console.warn(`[whatsapp-reminders] Número inválido: "${profile.whatsapp}"`);
              continue;
            }

            if (sentToPhones.has(formattedPhone)) {
              skipped++;
              continue;
            }

            sentToPhones.add(formattedPhone);
            const currentInstance = ministryMap.get(a.ministry_id) || instanceName;
            const endpoint = `${evolutionApiUrl}/message/sendText/${currentInstance}`;

            let success = false;
            let retries = 2;

            while (retries > 0 && !success) {
              try {
                const reqEvolution = await fetchWithTimeout(endpoint, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "apikey": evolutionApiKey,
                  },
                  body: JSON.stringify({
                    number: formattedPhone,
                    options: { delay: 1200, presence: "composing" },
                    text: msg,
                  }),
                  timeout: 5000
                });

                if (!reqEvolution.ok) {
                  const errBody = await reqEvolution.text();
                  throw new Error(`Evolution API ${reqEvolution.status}: ${errBody}`);
                }

                success = true;
                console.log(`[whatsapp-reminders] Mensagem enviada para ${profile.name} (${formattedPhone})`);
                sent++;
                
                // Gravar log de uso do WhatsApp
                await supabase.from("whatsapp_usage_logs").insert({
                  org_id: orgId,
                  ministry_id: a.ministry_id
                });
              } catch (postErr: any) {
                retries--;
                if (retries === 0) {
                  console.error(`[whatsapp-reminders] Erro ao enviar para ${formattedPhone}:`, postErr.message);
                  errors++;
                } else {
                  console.log(`[whatsapp-reminders] Retentando envio para ${formattedPhone}...`);
                  await new Promise(r => setTimeout(r, 1000));
                }
              }
            }
          }
        }

        // ── 9. Marca como enviado ──────────────────────────────────────────
        await supabase.from("whatsapp_scheduled_notifications")
          .update({ status: errors > 0 && sent === 0 ? "failed" : "sent" })
          .eq("id", notif.id);

        results.push({ notif_id: notif.id, date: targetDate, title: notif.event_title, sent, skipped, errors });
      } catch (notifErr: any) {
        console.error(`[whatsapp-reminders] Erro processando notif ${notif.id}:`, notifErr);
        await supabase.from("whatsapp_scheduled_notifications").update({ status: "failed" }).eq("id", notif.id);
        results.push({ notif_id: notif.id, error: notifErr.message });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[whatsapp-reminders] Erro crítico:", error);
    return new Response(JSON.stringify({ error: "Ocorreu um erro interno no processamento do cron." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});