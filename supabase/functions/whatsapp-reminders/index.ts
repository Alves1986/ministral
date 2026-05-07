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
  proje: "🎬",
  ilumina: "💡",
  luz: "💡",
  transmiss: "🎥",
  camera: "🎥",
  câmera: "🎥",
  foto: "📸",
  vocal: "🎤",
  ministro: "🎤",
  viol: "🎸",
  guitar: "🎸",
  bater: "🥁",
  teclad: "🎹",
  som: "🎛️",
  áudio: "🎛️",
  audio: "🎛️"
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

✅ *Confirme sua presença respondendo esta mensagem:*
• Digite *1* para CONFIRMAR
• Digite *2* para RECUSAR

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

    // ── 4. Hora atual em horário de Brasília (ROBUSTEZ NO TIMEZONE) ─────────
    const nowUTC = new Date();
    
    // Obter as partes em Brasília de uma vez
    const tzParts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      year: "numeric", month: "numeric", day: "numeric",
      hour: "numeric", minute: "numeric", second: "numeric",
      hour12: false
    }).formatToParts(nowUTC);

    const parts = Object.fromEntries(tzParts.map(p => [p.type, p.value]));
    
    const yyNow = Number(parts.year);
    const mmNow = Number(parts.month);
    const ddNow = Number(parts.day);
    
    let hhNow = Number(parts.hour);
    if (hhNow === 24) hhNow = 0;
    const minNow = Number(parts.minute);

    const currentMinuteStr = `${String(hhNow).padStart(2, "0")}:${String(minNow).padStart(2, "0")}`;
    const currentTimeInMinutes = hhNow * 60 + minNow;

    // ── 5. Busca organizações com WhatsApp habilitado ─────────────────────
    const { data: orgSettings, error: orgErr } = await supabase
      .from("whatsapp_settings")
      .select("*")
      .eq("enabled", true);

    if (orgErr) throw orgErr;
    if (!orgSettings || orgSettings.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "Nenhuma org com WhatsApp habilitado." }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // ── 6. Mapa de instâncias por ministério ──────────────────────────────
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

    const results: any[] = [];

    for (const orgSetting of orgSettings) {
      // ── 7. Verificação do horário configurado (JANELA DE TOLERÂNCIA) ─────────
      const rawTime = orgSetting.send_time || "09:00:00";
      const [confHStr, confMStr] = rawTime.split(":");
      const configuredTimeInMinutes = Number(confHStr) * 60 + Number(confMStr);
      
      // Verifica se a hora atual está dentro da janela de 5 minutos após o horário configurado
      let diff = currentTimeInMinutes - configuredTimeInMinutes;
      // Ajuste para casos em que cruza a meia-noite (ex: configurado 23:58, mudou para 00:02)
      if (diff < -720) diff += 1440; 
      else if (diff > 720) diff -= 1440;
      
      if (diff < 0 || diff > 5) {
        results.push({ org_id: orgSetting.org_id, skipped: true, reason: `Fora da janela de 5m (configurado: ${rawTime}, atual: ${currentMinuteStr})` });
        continue;
      }

      // ── 8. Data-alvo no fuso de Brasília (CORREÇÃO DE TIMEZONE) ─────────
      const sendDaysBefore = orgSetting.send_days_before || 0;
      
      // Cria uma data representando o meio dia para evitar problemas de timezone/DST em contas
      const targetDateObj = new Date(Date.UTC(yyNow, mmNow - 1, ddNow + sendDaysBefore, 12, 0, 0));
      
      const yy  = targetDateObj.getUTCFullYear();
      const mmStr  = String(targetDateObj.getUTCMonth() + 1).padStart(2, "0");
      const ddStr  = String(targetDateObj.getUTCDate()).padStart(2, "0");
      const targetDate = `${yy}-${mmStr}-${ddStr}`;

      // ── 9. Busca assignments do dia alvo ──────────────────────────────────
      const { data: assignments, error: assigErr } = await supabase
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
        .eq("organization_id", orgSetting.org_id)
        .eq("event_date", targetDate);

      if (assigErr) {
        results.push({ org_id: orgSetting.org_id, error: assigErr.message });
        continue;
      }

      if (!assignments || assignments.length === 0) {
        results.push({ org_id: orgSetting.org_id, date: targetDate, sent: 0, reason: "Sem assignments para a data." });
        continue;
      }

      let sent = 0, skipped = 0, errors = 0;

      // ── 10. Agrupar assignments por evento e ministério ───────────────────
      const eventsMap = new Map<string, any[]>();
      for (const assignment of assignments) {
        const ruleId = assignment.event_rule_id || `fallback_${assignment.event_date}`;
        const key = `${assignment.ministry_id}_${ruleId}`;
        if (!eventsMap.has(key)) eventsMap.set(key, []);
        eventsMap.get(key)!.push(assignment);
      }

      // ── 11. Processar cada evento separadamente ───────────────────────────
      for (const [key, evAssignments] of eventsMap.entries()) {
        const firstAssig = evAssignments[0];
        if (!firstAssig) continue;
        const eventTitle = firstAssig.event_rules?.title || "Culto";
        const eventTimeStr = firstAssig.event_rules?.time ? firstAssig.event_rules.time.substring(0, 5) : "00:00";
        
        // Formatar data usando a targetDate corretamente
        const [tY, tM, tD] = targetDate.split('-');
        const dateStr = `${tD}/${tM}/${tY}`;

        // Monta a lista de membros e funções
        let membersList = "";
        for (const a of evAssignments) {
          const memberName = a.profiles?.name || "Desconhecido";
          const emoji = getEmojiForRole(a.role);
          membersList += `${emoji} ${memberName} - ${a.role}\\n`;
        }

        const msg = `📢 *Escala para o ${eventTitle}* 📢\\n\\n📅 *Data:* ${dateStr}\\n⏰ *Horário:* ${eventTimeStr}\\n\\n👤 *Membros e Funções:*\\n\\n${membersList}\\n${DEFAULT_ORIENTATIONS}`;

        const sentToPhones = new Set<string>();
        const processedMembers = new Set<string>();

        // Dedup em memória
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

          // Deduplicação no banco de dados
          const { data: alreadySent } = await supabase
            .from("whatsapp_sent_log")
            .select("id")
            .eq("org_id", orgSetting.org_id)
            .eq("member_id", a.member_id)
            .eq("event_date", targetDate)
            .maybeSingle();

          if (alreadySent) {
            skipped++;
            continue;
          }

          const formattedPhone = formatBrazilPhone(profile.whatsapp);
          if (!formattedPhone) {
            skipped++;
            console.warn(`[whatsapp-reminders] Número inválido: "${profile.whatsapp}"`);
            continue;
          }

          if (sentToPhones.has(formattedPhone)) {
             try {
               await supabase.from("whatsapp_sent_log").insert({
                 org_id: orgSetting.org_id,
                 member_id: a.member_id,
                 event_date: targetDate,
               });
             } catch(e) {}
             skipped++;
             continue;
          }

          sentToPhones.add(formattedPhone);
          const currentInstance = ministryMap.get(a.ministry_id) || instanceName;
          const endpoint = `${evolutionApiUrl}/message/sendText/${currentInstance}`;

          // Mitigar race condition no envio: Insere "placeholder" ou aguarda a resposta
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

              await supabase.from("whatsapp_sent_log").insert({
                org_id: orgSetting.org_id,
                member_id: a.member_id,
                event_date: targetDate,
              });

              // Cria ação pendente para o membro confirmar via WhatsApp
              const expiresAt = new Date(targetDate);
              expiresAt.setDate(expiresAt.getDate() + 1);
              await supabase.from("whatsapp_pending_actions").insert({
                type:            "confirmation",
                member_id:       a.member_id,
                phone:           formattedPhone,
                organization_id: orgSetting.org_id,
                ministry_id:     a.ministry_id,
                event_date:      targetDate,
                event_rule_id:   a.event_rule_id,
                expires_at:      expiresAt.toISOString(),
              });

              console.log(`[whatsapp-reminders] Mensagem unificada enviada para ${profile.name} (${formattedPhone})`);
              sent++;
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

      results.push({ org_id: orgSetting.org_id, date: targetDate, sent, skipped, errors });
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