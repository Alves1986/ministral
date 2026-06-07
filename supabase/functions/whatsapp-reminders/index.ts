import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function formatBrazilPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('55')) digits = digits.slice(2);
  if (digits.length < 10 || digits.length > 11) return null;
  return '55' + digits;
}

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
        
        if (response.status === 428 || body.includes('Connection Closed') || body.includes('Not Connected')) {
          console.warn(`[whatsapp-reminders] Conexão fechada detectada (${instanceName}). Forçando RESTART (tentativa ${attempt + 1})...`);
          try {
            await fetchWithTimeout(`${apiUrl}/instance/restart/${instanceName}`, { 
                method: "PUT",
                headers: { apikey: apiKey }, 
                timeout: 15000 
            });
            await sleep(5000); 
          } catch(e) { /* ignore restart error */ }
        }
        await sleep(1000 * (attempt + 1));
        continue;
      }
      
      await response.json().catch(() => {});
      return { success: true };
    } catch (error: any) {
      lastError = error.message;
      if (lastError.includes("aborted")) {
        lastError = "Timeout exceeding " + timeout + "ms";
      }
      if (attempt < retries) {
        await sleep(1000 * (attempt + 1));
      }
    }
  }
  return { success: false, error: lastError };
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const evolutionApiUrl = Deno.env.get("EVOLUTION_API_URL")!;
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY")!;
    const openRouterApiKey = Deno.env.get("OPENROUTER_API_KEY") || "";
    const defaultInstance = Deno.env.get("EVOLUTION_INSTANCE_NAME") || "ministral-global-v2";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const nowIso = new Date().toISOString();

    const { data: pendingNotifs, error: notifErr } = await supabase
      .from("whatsapp_scheduled_notifications")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_at", nowIso);

    if (notifErr) throw notifErr;
    console.log(`[cron] Found ${pendingNotifs?.length || 0} pending notifications to process.`);

    let sentCount = 0;
    
    if (pendingNotifs && pendingNotifs.length > 0) {
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

      const notifMinistryIds = [...new Set(uniqueNotifs.map(n => n.ministry_id).filter(Boolean))];
      const { data: ministryWa } = await supabase.from("ministry_whatsapp").select("ministry_id, instance_name").eq("connected", true).in("ministry_id", notifMinistryIds);
      const minInstanceMap = new Map((ministryWa || []).map((w: any) => [w.ministry_id, w.instance_name]));

      for (const notif of uniqueNotifs) {
        try {
          const { data: planCheck } = await supabase.from("organizations").select("plan_type, whatsapp_enabled").eq("id", notif.organization_id).single();
          if (planCheck?.whatsapp_enabled === false || (planCheck?.plan_type !== "pro" && planCheck?.plan_type !== "enterprise")) {
            console.log(`[notif] Skipped because organization does not have pro/enterprise plan or whatsapp is disabled. (Type: ${planCheck?.plan_type}, Enabled: ${planCheck?.whatsapp_enabled})`);
            await supabase.from("whatsapp_scheduled_notifications").update({ status: "skipped" }).eq("id", notif.id);
            continue;
          }

          const { data: assignments, error: assignmentsError } = await supabase
            .from("schedule_assignments")
            .select(`
              id, member_id, role, event_date, event_rule_id, ministry_id, organization_id, confirmed,
              profiles:member_id ( whatsapp, name ),
              organization_ministries!ministry_id ( label, code ),
              event_rules!event_rule_id ( title, time )
            `)
            .eq("ministry_id", notif.ministry_id)
            .eq("event_rule_id", notif.event_rule_id)
            .eq("event_date", notif.event_date);
            
          const { data: Anyassignments } = await supabase
            .from("schedule_assignments")
            .select(`id, event_rule_id, event_date`)
            .eq("ministry_id", notif.ministry_id)
            .limit(10);
            
          console.log(`[notif] processing rule ${notif.event_rule_id} for date ${notif.event_date}: Found ${assignments?.length || 0} assignments. Error: ${assignmentsError?.message || 'none'}`);

          if (!assignments || assignments.length === 0) {
            console.log(`[notif] Skipped because there are 0 assignments.`);
            await supabase.from("whatsapp_scheduled_notifications").update({ status: "completed" }).eq("id", notif.id);
            continue;
          }

          const instanceName = minInstanceMap.get(notif.ministry_id) || defaultInstance;
          
          let customMessage = "";
          const { data: minSettings } = await supabase
            .from("ministry_settings")
            .select("*")
            .eq("ministry_id", notif.ministry_id)
            .maybeSingle();

          customMessage = minSettings?.whatsapp_custom_message || "";

          let teamList = "";
          const rolesMap = new Map<string, string[]>();
          assignments.forEach((t: any) => {
            if (!rolesMap.has(t.role)) rolesMap.set(t.role, []);
            rolesMap.get(t.role)!.push(t.profiles?.name || "Membro");
          });
          for (const [r, names] of rolesMap.entries()) {
            teamList += `${getEmojiForRole(r)} *${r}:* ${names.join(", ")}\n`;
          }

          for (const a of assignments) {
             if (!a.profiles?.whatsapp) continue;
             const phone = formatBrazilPhone(a.profiles.whatsapp);
             if (!phone) continue;

             const typeId = `scheduled_${notif.id}`;
             const { data: sentAlready } = await supabase.from("whatsapp_notifications").select("id").eq("schedule_member_id", a.id).eq("type", typeId).maybeSingle();
             if (sentAlready) continue;

             const dateDisplay = a.event_date.split("-").reverse().join("/");
             const memberFirstName = a.profiles?.name.split(" ")[0] || "Membro";
             const eventTimeStr = a.event_rules?.time?.substring(0,5) || "";
             const ministryLabel = a.organization_ministries?.label || "";
             const eventTitle = a.event_rules?.title || "Culto";

             let messageText = "";

             if (customMessage) {
                messageText = customMessage
                  .replace(/\{nome\}/g, memberFirstName)
                  .replace(/\{dia\}/g, dateDisplay)
                  .replace(/\{hora\}/g, eventTimeStr)
                  .replace(/\{culto\}/g, eventTitle)
                  .replace(/\{equipe\}/g, "\n*Equipe:*\n" + teamList);
             } else {
                messageText = `*Escala — ${eventTitle}*\n\nOlá, ${memberFirstName}! Você está escalado(a).\n\n🗓️ *Data:* ${dateDisplay}\n⏰ *Horário:* ${eventTimeStr}\n⛪ *Ministério:* ${ministryLabel}\n\n*Equipe Escalada:*\n${teamList}`;
                
                messageText += `\n\n_Se você não puder comparecer, por favor acesse o aplicativo e solicite substituição._\n\nMinistral • Gestão de Escalas`;
             }

             try {
                console.log(`[notif] Sending WA to ${phone} (name: ${memberFirstName})`);
                const sendRes = await sendWhatsAppMessage(evolutionApiUrl, evolutionApiKey, instanceName, phone, messageText);
                if (!sendRes.success) throw new Error(sendRes.error || "Unknown Error");
                
                await supabase.from("whatsapp_notifications").insert({
                  schedule_member_id: a.id, type: typeId, sent_at: new Date().toISOString(), phone, organization_id: a.organization_id
                });
                sentCount++;
             } catch (err) {
                 console.error("Failed sending to " + phone, err);
             }
          }

          await supabase.from("whatsapp_scheduled_notifications").update({ status: "completed" }).eq("id", notif.id);
        } catch (subErr) {
          console.error("Batch error", subErr);
          await supabase.from("whatsapp_scheduled_notifications").update({ status: "failed" }).eq("id", notif.id);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, processed: pendingNotifs?.length || 0, sentCount }), { status: 200, headers: { "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("[whatsapp-reminders] error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
