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

serve(async (req: Request) => {
  try {
    // ── 1. Autenticação do cron via secret header ─────────────────────────
    // Configure WHATSAPP_CRON_SECRET nas Supabase Edge Function Secrets
    // e inclua o mesmo valor no header 'x-cron-secret' do cron job SQL.
    const cronSecret = Deno.env.get("WHATSAPP_CRON_SECRET");
    if (cronSecret) {
      const incomingSecret = req.headers.get("x-cron-secret");
      if (incomingSecret !== cronSecret) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
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

    // ── 4. Hora atual em horário de Brasília ──────────────────────────────
    // Converte UTC → America/Sao_Paulo para evitar o bug de meia-noite
    const nowUTC  = new Date();
    const nowBR   = new Date(nowUTC.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const hh = String(nowBR.getHours()).padStart(2, "0");
    const mm = String(nowBR.getMinutes()).padStart(2, "0");
    const currentMinuteStr = `${hh}:${mm}:00`;

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
      // Logar mas não abortar — fallback para instância global
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
      // ── 7. Verificação do horário configurado (CORREÇÃO CRÍTICA) ─────────
      const rawTime = orgSetting.send_time || "09:00:00";
      // Considera apenas hora e minuto para a comparação
      const configuredMinuteStr = rawTime.length >= 5 ? rawTime.substring(0, 5) + ":00" : "09:00:00";
      if (configuredMinuteStr !== currentMinuteStr) {
        results.push({ org_id: orgSetting.org_id, skipped: true, reason: `send_time ${configuredMinuteStr} ≠ hora atual ${currentMinuteStr}` });
        continue;
      }

      // ── 8. Data-alvo no fuso de Brasília (CORREÇÃO DE TIMEZONE) ─────────
      const sendDaysBefore = orgSetting.send_days_before || 0;
      const targetBR = new Date(nowBR);
      targetBR.setDate(targetBR.getDate() + sendDaysBefore);
      const yy  = targetBR.getFullYear();
      const mm  = String(targetBR.getMonth() + 1).padStart(2, "0");
      const dd  = String(targetBR.getDate()).padStart(2, "0");
      const targetDate = `${yy}-${mm}-${dd}`;

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
        console.error("[whatsapp-reminders] Erro ao buscar assignments:", assigErr);
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
        if (!assignment.event_rule_id) continue;
        const key = `${assignment.ministry_id}_${assignment.event_rule_id}`;
        if (!eventsMap.has(key)) eventsMap.set(key, []);
        eventsMap.get(key)!.push(assignment);
      }

      // ── 11. Processar cada evento separadamente ───────────────────────────
      for (const [key, evAssignments] of eventsMap.entries()) {
        const firstAssig = evAssignments[0];
        const eventTitle = firstAssig.event_rules?.title || "Culto";
        const eventTimeStr = firstAssig.event_rules?.time ? firstAssig.event_rules.time.substring(0, 5) : "00:00";
        
        const displayDate = new Date(`${firstAssig.event_date}T12:00:00`);
        const dateStr = displayDate.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

        // Monta a lista de membros e funções
        let membersList = "";
        for (const a of evAssignments) {
          const memberName = a.profiles?.name || "Desconhecido";
          const role = a.role;
          let emoji = "🔹";
          const rLow = role.toLowerCase();
          if (rLow.includes("proje")) emoji = "🎬";
          else if (rLow.includes("ilumina") || rLow.includes("luz")) emoji = "💡";
          else if (rLow.includes("transmiss") || rLow.includes("camera") || rLow.includes("câmera")) emoji = "🎥";
          else if (rLow.includes("foto")) emoji = "📸";
          else if (rLow.includes("vocal") || rLow.includes("ministro")) emoji = "🎤";
          else if (rLow.includes("viol") || rLow.includes("guitar")) emoji = "🎸";
          else if (rLow.includes("bater")) emoji = "🥁";
          else if (rLow.includes("teclad")) emoji = "🎹";
          else if (rLow.includes("som") || rLow.includes("áudio") || rLow.includes("audio")) emoji = "🎛️";

          membersList += `${emoji} ${memberName} - ${role}\n`;
        }

        const msg = `📢 *Escala para o ${eventTitle}* 📢\n\n📅 *Data:* ${dateStr}\n⏰ *Horário:* ${eventTimeStr}\n\n👤 *Membros e Funções:*\n\n${membersList}\n⚠️ *Orientações:*\n1. Cheguem com 30 minutos de antecedência para check-list dos equipamentos.\n2. Caso haja algum imprevisto, comuniquem a liderança imediatamente.\n3. Não esqueça de Confirmar a escala realizando o check-in no aplicativo.\n\nVamos juntos servir com excelência! 🚀`;

        const sentToPhones = new Set<string>();

        for (const a of evAssignments) {
          const profile = a.profiles;
          if (!profile || !profile.whatsapp) {
            skipped++;
            continue;
          }

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

          // Se a pessoa tem mais de uma função, não enviamos a mesma mensagem duas vezes
          if (sentToPhones.has(formattedPhone)) {
             await supabase.from("whatsapp_sent_log").insert({
               org_id: orgSetting.org_id,
               member_id: a.member_id,
               event_date: targetDate,
             });
             skipped++;
             continue;
          }

          sentToPhones.add(formattedPhone);
          const currentInstance = ministryMap.get(a.ministry_id) || instanceName;
          const endpoint = `${evolutionApiUrl}/message/sendText/${currentInstance}`;

          try {
            const reqEvolution = await fetch(endpoint, {
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
            });

            if (!reqEvolution.ok) {
              const errBody = await reqEvolution.text();
              throw new Error(`Evolution API ${reqEvolution.status}: ${errBody}`);
            }

            await supabase.from("whatsapp_sent_log").insert({
              org_id: orgSetting.org_id,
              member_id: a.member_id,
              event_date: targetDate,
            });

            console.log(`[whatsapp-reminders] Mensagem unificada enviada para ${profile.name} (${formattedPhone})`);
            sent++;
          } catch (postErr: any) {
            console.error(`[whatsapp-reminders] Erro ao enviar para ${formattedPhone}:`, postErr.message);
            errors++;
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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
