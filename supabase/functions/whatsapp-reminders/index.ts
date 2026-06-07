import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function generateOrientationsWithAI(
  ministryName: string,
  ministryType: string,
  openRouterApiKey: string
): Promise<string> {
  const models = ["deepseek/deepseek-r1", "google/gemini-2.0-flash-thinking-exp:free"];

  const prompt = `Você é um assistente de gestão para ministérios evangélicos.
Gere no máximo 4 orientações curtas (em bullet points usando números ou emojis adequados) para a equipe do ministério "${ministryName}" (Tipo: ${ministryType}).
Use um tom encorajador, cristão e focado no preparo espiritual e técnico para o culto. Não crie saudações ou rodapés, nem a palavra "Orientações", apenas os bullet points diretamente. Exemplo:
1. ...
2. ...`;

  for (const model of models) {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 15000);
      
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openRouterApiKey}`,
          "HTTP-Referer": "https://ministral.app",
          "X-Title": "Ministral",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: "user", content: prompt }]
        }),
        signal: controller.signal
      });
      clearTimeout(id);
      
      if (response.ok) {
        const data = await response.json();
        let text = data.choices[0]?.message?.content?.trim() || "";
        
        text = text.replace(/<think>[\s\S]*?<\/think>\s*/gi, "").trim();
        
        if (text) return text;
      } else {
           const errorText = await response.text();
           console.warn(`[AI] Error response from ${model}:`, errorText);
      }
    } catch (err) {
      console.warn(`[whatsapp] AI (model: ${model}) limit/error:`, err);
    }
  }
  
  return `1. Cheguem com 30 minutos de antecedência.\n2. Comuniquem a liderança sobre qualquer imprevisto.`;
}

function formatBrazilPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('55')) digits = digits.slice(2);
  if (digits.length < 10 || digits.length > 11) return null;
  return '55' + digits;
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

async function sendWhatsAppMessage(
  apiUrl: string, apiKey: string, instanceName: string, phone: string, text: string
) {
  const endpoint = `${apiUrl}/message/sendText/${instanceName}`;
  const response = await fetchWithTimeout(endpoint, {
    method: "POST", headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify({ number: phone, options: { delay: 1200, presence: "composing" }, text }),
    timeout: 8000,
  });
  if (!response.ok) throw new Error("Status " + response.status);
  return { success: true };
}

const ROLE_EMOJIS: Record<string, string> = {
  proje: "💻", ilumina: "💡", camera: "🎥", foto: "📸", 
  vocal: "🎤", ministro: "🎤", viol: "🎸", guitar: "🎸",
  baixo: "🎸", bater: "🥁", teclad: "🎹",
  som: "🎛️", apresenta: "🎙️"
};

function getEmojiForRole(role: string): string {
  const rLow = role.toLowerCase();
  for (const [key, emoji] of Object.entries(ROLE_EMOJIS)) {
    if (rLow.includes(key)) return emoji;
  }
  return "🔹";
}

serve(async (req: Request) => {
  try {
    const cronSecret = Deno.env.get("WHATSAPP_CRON_SECRET");
    const reqSecret = req.headers.get("x-cron-secret");
    if (cronSecret && reqSecret && reqSecret !== cronSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const evolutionApiUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");
    const openRouterApiKey = Deno.env.get("OPENROUTER_API_KEY") || "";
    const defaultInstance = Deno.env.get("EVOLUTION_INSTANCE_NAME") || "ministral-global-v2";

    if (!supabaseUrl || !supabaseServiceKey || !evolutionApiUrl || !evolutionApiKey) {
      throw new Error("Missing config variables.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const nowIso = new Date().toISOString();

    // 1. Busca mensagens/agendamentos agendados PELO ADMIN na tabela
    // Essas são a MENSAGEM 1 (Notificação Antecipada)
    const { data: pendingNotifs, error: notifErr } = await supabase
      .from("whatsapp_scheduled_notifications")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_at", nowIso);

    if (notifErr) throw notifErr;
    
    // Além disso, Lembretes automáticos 30 MIN ANTES (Mensagem 2).
    // O sistema pode checar "eventos" de hoje. O admin apenas define a Mensagem 1, mas como foi solicitado as "Duas mensagens", o sistema precisa emitir a de Checkin sozinha minutos antes do evento, caso a tabela whatsapp_scheduled_notifications apenas contemple a primeira.
    // Vamos processar a Mensagem 1 primeiro.

    const sentCount = { advance: 0, checkin: 0 };

    if (pendingNotifs && pendingNotifs.length > 0) {
      // Deduplica (se a mesma organização/ministry/data foi agendada várias vezes)
      const duplicateIds = [];
      const uniqueNotifs = [];
      const seenPayloads = new Set<string>();
      
      for (const n of pendingNotifs) {
         const key = `${n.organization_id}_${n.ministry_id}_${n.event_rule_id}_${n.event_date}`;
         if (seenPayloads.has(key)) duplicateIds.push(n.id);
         else {
             seenPayloads.add(key);
             uniqueNotifs.push(n);
         }
      }

      if (duplicateIds.length > 0) {
         await supabase.from("whatsapp_scheduled_notifications").update({ status: "skipped" }).in("id", duplicateIds);
      }

      const notifIds = uniqueNotifs.map(n => n.id);
      await supabase.from("whatsapp_scheduled_notifications").update({ status: "processing" }).in("id", notifIds);

      // Pega instâncias conectadas
      const notifMinistryIds = [...new Set(uniqueNotifs.map(n => n.ministry_id).filter(Boolean))];
      const { data: ministryWa } = await supabase.from("ministry_whatsapp").select("ministry_id, instance_name").eq("connected", true).in("ministry_id", notifMinistryIds);
      const minInstanceMap = new Map((ministryWa || []).map((w: any) => [w.ministry_id, w.instance_name]));

      for (const notif of uniqueNotifs) {
        try {
          const { data: planCheck } = await supabase.from("organizations").select("plan_type, whatsapp_enabled").eq("id", notif.organization_id).single();
          if (planCheck?.whatsapp_enabled === false || (planCheck?.plan_type !== "pro" && planCheck?.plan_type !== "enterprise")) {
            await supabase.from("whatsapp_scheduled_notifications").update({ status: "skipped" }).eq("id", notif.id);
            continue;
          }

          const { data: assignments } = await supabase
            .from("schedule_assignments")
            .select(`
              id, member_id, role, event_date, event_rule_id, ministry_id, organization_id, status, confirmed,
              profiles:member_id ( whatsapp, name ),
              organization_ministries!ministry_id ( label, code ),
              event_rules!event_rule_id ( title, time )
            `)
            .eq("ministry_id", notif.ministry_id)
            .eq("event_rule_id", notif.event_rule_id)
            .eq("event_date", notif.event_date);
            
          if (!assignments || assignments.length === 0) {
            await supabase.from("whatsapp_scheduled_notifications").update({ status: "completed" }).eq("id", notif.id);
            continue;
          }

          const instanceName = minInstanceMap.get(notif.ministry_id) || defaultInstance;
          
          let instructions = "";
          const { data: minSettings } = await supabase
            .from("ministry_settings")
            .select("whatsapp_custom_instructions")
            .eq("ministry_id", notif.ministry_id)
            .maybeSingle();
          instructions = minSettings?.whatsapp_custom_instructions || "";

          // Pega info da primeira assignment pra pegar o code (tipo do ministério)
          const firstAssign = assignments[0];
          if (!instructions) {
            instructions = await generateOrientationsWithAI(
              firstAssign.organization_ministries?.label || "Ministério",
              firstAssign.organization_ministries?.code || "Default",
              openRouterApiKey
            );
            if (instructions) {
               await supabase.from("ministry_settings").upsert({
                 ministry_id: notif.ministry_id,
                 organization_id: notif.organization_id,
                 whatsapp_custom_instructions: instructions,
                 whatsapp_instructions_updated_at: new Date().toISOString()
               }, { onConflict: "ministry_id" });
            }
          }

          // Monta equipe (uma vez)
          let teamList = "";
          const rolesMap = new Map<string, string[]>();
          assignments.forEach((t: any) => {
            if (!rolesMap.has(t.role)) rolesMap.set(t.role, []);
            rolesMap.get(t.role)!.push(t.profiles?.name || "Membro");
          });
          for (const [r, names] of rolesMap.entries()) {
            teamList += `${getEmojiForRole(r)} *${r}:* ${names.join(", ")}\n`;
          }

          const type = "advance_notice";
          for (const a of assignments) {
             if (a.status === 'swap_requested') continue;
             if (!a.profiles?.whatsapp) continue;
             const phone = formatBrazilPhone(a.profiles.whatsapp);
             if (!phone) continue;

             const { data: sentAlready } = await supabase.from("whatsapp_notifications").select("id").eq("schedule_member_id", a.id).eq("type", type).maybeSingle();
             if (sentAlready) continue;

             const dateDisplay = a.event_date.split("-").reverse().join("/");
             const messageText = `*Escala — ${a.event_rules?.title || "Culto"}*\n\nOlá, ${a.profiles?.name.split(" ")[0]}! Você está escalado(a).\n\n🗓️ *Data:* ${dateDisplay}\n⏰ *Horário:* ${a.event_rules?.time?.substring(0,5)}\n⛪ *Ministério:* ${a.organization_ministries?.label || ""}\n\n*Equipe Escalada:*\n${teamList}\n*Orientações:*\n${instructions}\n\n_Se você não puder comparecer, por favor acesse o aplicativo e solicite substituição._\n\nMinistral • Gestão de Escalas`;

             await sendWhatsAppMessage(evolutionApiUrl, evolutionApiKey, instanceName, phone, messageText);
             await supabase.from("whatsapp_notifications").insert({
               schedule_member_id: a.id, type, sent_at: new Date().toISOString(), phone, organization_id: a.organization_id
             });
             sentCount.advance++;
          }

          await supabase.from("whatsapp_scheduled_notifications").update({ status: "completed" }).eq("id", notif.id);
        } catch (subErr) {
          console.error("Batch error for notif id " + notif.id, subErr);
          await supabase.from("whatsapp_scheduled_notifications").update({ status: "failed" }).eq("id", notif.id);
        }
      }
    }

    // 2. Lógica para Mensagem 2 (Check-in Reminder 30 min antes)
    // "O sistema só deve disparar a mensagem conforme estipulado nas configurações pelo admin"
    // Pode se referir à regra de enviar a notificação automática de Check-in para o horário agendado de CHECKIN
    // Vou checar se o sistema deve pegar as assignments do próprio dia e mandar checkin para quem já passou da Notificação 1.
    // Lendo as assignments de hoje:
    const nowLocal = new Date();
    const todayStr = new Date(nowLocal.getTime() - 3*3600000).toISOString().slice(0, 10);
    const { data: todayAssignments } = await supabase
      .from("schedule_assignments")
      .select(`id, member_id, event_date, role, status, confirmed, event_rule_id, event_rules(title, time), profiles(whatsapp, name), organizations(plan_type, whatsapp_enabled), ministry_whatsapp(instance_name, connected)`)
      .eq("event_date", todayStr);

    if (todayAssignments) {
      const nowTime = nowLocal.getTime();
      for (const a of todayAssignments) {
        if (!a.profiles?.whatsapp || a.status === 'swap_requested') continue;
        if (a.organizations?.whatsapp_enabled === false) continue;
        const plan = a.organizations?.plan_type;
        if (plan !== "pro" && plan !== "enterprise") continue;

        const eventTimeStr = `${a.event_date}T${a.event_rules?.time || "00:00:00"}-03:00`;
        const evDate = new Date(eventTimeStr);
        const diffHours = (evDate.getTime() - nowTime) / (1000 * 60 * 60);

        // Se falta = 30min até 5min... (0.5h até 0.08h)
        if (diffHours >= 0.05 && diffHours <= 0.6) {
           const type2 = "checkin_reminder";
           const { data: sentAlready2 } = await supabase.from("whatsapp_notifications").select("id").eq("schedule_member_id", a.id).eq("type", type2).maybeSingle();
           if (!sentAlready2) {
               const phone2 = formatBrazilPhone(a.profiles.whatsapp);
               if (phone2) {  
                  const inst = (a.ministry_whatsapp?.connected ? a.ministry_whatsapp.instance_name : defaultInstance) || defaultInstance;
                  const txt = `Olá, ${a.profiles?.name.split(" ")[0]}! Seu culto *${a.event_rules?.title}* começa em breve (às ${a.event_rules?.time?.substring(0,5)}).\n\nConfirme seu check-in no aplicativo Ministral! Bom culto. 🙏\n\n🔗 ministral.app`;
                  try {
                    await sendWhatsAppMessage(evolutionApiUrl, evolutionApiKey, inst, phone2, txt);
                    await supabase.from("whatsapp_notifications").insert({ schedule_member_id: a.id, type: type2, sent_at: new Date().toISOString(), phone: phone2, organization_id: a.organization_id || null });
                    sentCount.checkin++;
                  } catch (e) { console.error("Checkin Send Err", e); }
               }
           }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, ...sentCount }), { status: 200, headers: { "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("[whatsapp-reminders] error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});

