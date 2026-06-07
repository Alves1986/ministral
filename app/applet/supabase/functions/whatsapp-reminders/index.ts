import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function formatBrazilPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('55')) digits = digits.slice(2);
  if (digits.length < 10 || digits.length > 11) return null;
  return '55' + digits;
}

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

async function sendWhatsAppMessage(
  apiUrl: string, apiKey: string, instanceName: string, phone: string, text: string,
  options: { timeout?: number; retries?: number; delayMs?: number; presence?: "composing" | "recording" | "paused"; } = {}
): Promise<{ success: boolean; error?: string }> {
  const { timeout = 8000, retries = 2, delayMs = 1200, presence = "composing" } = options;
  const apiFormatUrl = apiUrl.replace(/\/+$/, "");
  const endpoint = `${apiFormatUrl}/message/sendText/${instanceName}`;
  let lastError = "";

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json", apikey: apiKey },
        body: JSON.stringify({ number: phone, options: { delay: delayMs, presence }, text }),
        timeout,
      });
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        lastError = `Evolution API ${response.status}: ${body}`;
        
        if (response.status === 428 || body.includes('Connection Closed') || body.includes('Not Connected')) {
          console.warn(`[whatsapp-reminders] Conexão fechada detectada no envio (${instanceName}). Forçando RESTART (tentativa ${attempt + 1})...`);
          try {
            await fetchWithTimeout(`${apiFormatUrl}/instance/restart/${instanceName}`, { 
                method: "PUT",
                headers: { apikey: apiKey }, 
                timeout: 15000 
            });
            await sleep(10000);
          } catch (e) {
            console.error(`[whatsapp-reminders] Falha ao tentar forçar restart:`, e);
          }
        }
        
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
  const apiFormatUrl = apiUrl.replace(/\/+$/, "");
  const endpoint = `${apiFormatUrl}/message/sendButtons/${instanceName}`;
  
  const payload = {
    number: phone,
    options: { delay: 1200, presence: "composing" },
    buttonMessage: {
      title: content.title,
      description: content.description,
      footer: content.footer,
      buttons: buttons.map((b) => ({
        buttonId: b.id,
        buttonText: { displayText: b.text },
        type: 1
      }))
    }
  };

  try {
    const response = await fetchWithTimeout(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Status ${response.status} - Falha ao enviar botões`);
    }
    return { success: true };

  } catch (error) {
    console.warn(`[whatsapp] Falha ao enviar botões para ${phone}. Acionando Fallback Textual.`);
    
    // --- FALLBACK PARA TEXTO ---
    let fallbackText = `*${content.title}*\n\n${content.description}\n\n`;
    fallbackText += `*Responda com o NÚMERO da opção desejada:*\n`;
    
    buttons.forEach((b, index) => {
      fallbackText += `*[ ${index + 1} ]* - ${b.text}\n`;
    });
    
    fallbackText += `\n_${content.footer}_`;

    return sendWhatsAppMessage(apiUrl, apiKey, instanceName, phone, fallbackText);
  }
}

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

interface MinistryTemplate {
  header: string;
  greeting: string;
  orientations: string;
  closing: string;
}

const MINISTRY_TEMPLATES: Record<string, MinistryTemplate> = {
  louvor: {
    header: "🎵",
    greeting: "Você está confirmado(a) na escala de louvor! Que honra servir ao Senhor com você. 🙌",
    orientations: `⚠️ *Orientações do Louvor:*\n1. Chegue *30 minutos antes* para aquecimento vocal e soundcheck.\n2. Revise as músicas com antecedência — a excelência começa em casa.\n3. Verifique os cifras e letras no app antes do culto.\n4. Em caso de imprevisto, avise a *liderança imediatamente*.\n5. Confirme sua presença fazendo *check-in no aplicativo*.`,
    closing: "🎶 Vamos adorar com tudo que somos. Ele é digno!"
  },
  infantil: {
    header: "🌈",
    greeting: "Você está confirmado(a) na equipe do Ministério Infantil! As crianças vão te esperar. 🥰",
    orientations: `⚠️ *Orientações do Infantil:*\n1. Chegue *20 minutos antes* para preparar o ambiente e as atividades.\n2. Confira os materiais pedagógicos e a lição do dia com antecedência.\n3. A *segurança das crianças* é prioridade — siga todos os protocolos.\n4. Nunca deixe uma criança sozinha sem supervisão.\n5. Confirme sua presença fazendo *check-in no aplicativo*.`,
    closing: "🌟 \"Deixai os pequeninos virem a mim\" — Que privilégio servir a eles!"
  },
  midia: {
    header: "💻",
    greeting: "Você está confirmado(a) na equipe de Mídia! Sua habilidade faz o culto chegar mais longe. 🎬",
    orientations: `⚠️ *Orientações de Mídia:*\n1. Chegue *40 minutos antes* para checklist completo dos equipamentos.\n2. Verifique câmeras, cabos, streaming e projetores antes do início.\n3. Teste o link de transmissão ao vivo com antecedência.\n4. Tenha um plano B para falhas técnicas — esteja sempre preparado(a).\n5. Confirme sua presença fazendo *check-in no aplicativo*.`,
    closing: "📡 Cada click seu leva o evangelho mais longe. Valeu!"
  },
  recepcao: {
    header: "🤝",
    greeting: "Você está confirmado(a) na equipe de Recepção! Você é o primeiro sorriso que alguém vê. 💛",
    orientations: `⚠️ *Orientações da Recepção:*\n1. Chegue *30 minutos antes* — sua pontualidade é a nossa hospitalidade.\n2. Esteja com o visual adequado (uniforme/crachá se aplicável).\n3. Acolha *cada pessoa* como se fosse a primeira vez que ela entra numa igreja.\n4. Fique atento a visitantes e pessoas com necessidades especiais.\n5. Confirme sua presença fazendo *check-in no aplicativo*.`,
    closing: "🏠 Você não recebe pessoas — você recebe famílias. Obrigado!"
  },
  default: {
    header: "⛪",
    greeting: "Você está confirmado(a) na escala do ministério! Obrigado pelo seu serviço.",
    orientations: `⚠️ *Orientações:*\n1. Cheguem com *30 minutos de antecedência* para check-list dos equipamentos.\n2. Caso haja algum imprevisto, comuniquem a liderança imediatamente.\n3. Não esqueça de confirmar a escala realizando o *check-in no aplicativo*.`,
    closing: "🚀 Vamos juntos servir com excelência!"
  }
};

function getMinistryTemplate(code: string, label: string): MinistryTemplate {
  const c = (code || "").toLowerCase();
  const l = (label || "").toLowerCase();

  if (c.includes("louvor") || l.includes("louvor") || c.includes("musica") || l.includes("música") || l.includes("musica") || c.includes("worship")) {
    return MINISTRY_TEMPLATES.louvor;
  }
  if (c.includes("infantil") || l.includes("infantil") || l.includes("criança") || l.includes("kids") || c.includes("kids")) {
    return MINISTRY_TEMPLATES.infantil;
  }
  if (c.includes("midia") || l.includes("mídia") || l.includes("midia") || l.includes("media") || c.includes("media") || l.includes("tecnologia") || l.includes("transmiss")) {
    return MINISTRY_TEMPLATES.midia;
  }
  if (c.includes("recep") || l.includes("recep") || l.includes("hospit") || l.includes("portaria") || l.includes("boas-vindas")) {
    return MINISTRY_TEMPLATES.recepcao;
  }
  return MINISTRY_TEMPLATES.default;
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

      const ministryIdsArray = uniqueNotifs.map(n => n.ministry_id).filter(Boolean);
      const uniqueMinistryIds: string[] = [];
      for (const mId of ministryIdsArray) {
        if (!uniqueMinistryIds.includes(mId)) uniqueMinistryIds.push(mId);
      }
      
      const { data: ministryWa } = await supabase.from("ministry_whatsapp").select("ministry_id, instance_name").eq("connected", true).in("ministry_id", uniqueMinistryIds);
      const minInstanceMap = new Map((ministryWa || []).map((w: any) => [w.ministry_id, w.instance_name]));

      for (const notif of uniqueNotifs) {
        try {
          const { data: planCheck } = await supabase.from("organizations").select("plan_type, whatsapp_enabled").eq("id", notif.organization_id).single();
          if (planCheck?.whatsapp_enabled === false || (planCheck?.plan_type !== "pro" && planCheck?.plan_type !== "enterprise")) {
            console.log(`[notif] Skipped because organization does not have pro/enterprise plan or whatsapp is disabled.`);
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
            
          if (!assignments || assignments.length === 0) {
            await supabase.from("whatsapp_scheduled_notifications").update({ status: "completed" }).eq("id", notif.id);
            continue;
          }

          const instanceName = minInstanceMap.get(notif.ministry_id) || defaultInstance;
          
          let customMessage = "";
          const { data: minSettings } = await supabase
            .from("ministry_settings")
            .select("whatsapp_custom_message")
            .eq("ministry_id", notif.ministry_id)
            .maybeSingle();

          customMessage = minSettings?.whatsapp_custom_message || "";

          const first = assignments[0];
          const eventTitle    = first.event_rules?.title || notif.event_title || "Culto";
          const eventTimeStr  = first.event_rules?.time?.substring(0, 5) ?? "00:00";
          const ministryLabel = first.organization_ministries?.label || "Ministério";
          const ministryCode  = first.organization_ministries?.code || "";
          const [tY, tM, tD]  = notif.event_date.split("-");
          const dateStr = `${tD}/${tM}/${tY}`;

          const template = getMinistryTemplate(ministryCode, ministryLabel);
          const orientationsBlock = customMessage || template.orientations;
          const closingBlock      = customMessage ? "" : `\n${template.closing}`;

          const rolesMap: Record<string, string[]> = {};
          assignments.forEach((t: any) => {
            const r = t.role || "Membro";
            if (!rolesMap[r]) rolesMap[r] = [];
            rolesMap[r].push(t.profiles?.name || "Membro");
          });
          let teamList = "";
          for (const r of Object.keys(rolesMap)) {
            const names = rolesMap[r];
            teamList += `${getEmojiForRole(r)} *${r}:* ${names.join(", ")}\n`;
          }

          for (const a of assignments) {
             if (!a.profiles?.whatsapp) continue;
             const phone = formatBrazilPhone(a.profiles.whatsapp);
             if (!phone) continue;

             const typeId = `scheduled_${notif.id}`;
             const { data: sentAlready } = await supabase.from("whatsapp_notifications").select("id").eq("schedule_member_id", a.id).eq("type", typeId).maybeSingle();
             if (sentAlready) continue;

             const memberFirstName = a.profiles?.name.split(" ")[0] || "Membro";
             
             await supabase.from("whatsapp_pending_actions").insert({
               organization_id: a.organization_id,
               ministry_id: a.ministry_id,
               member_id: a.member_id,
               phone: phone,
               type: "confirmation",
               event_rule_id: a.event_rule_id,
               event_date: a.event_date,
               role: a.role,
               status: "pending",
               expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
             });

             const content = {
               title: `Escala — ${eventTitle}`,
               description: `Olá, ${memberFirstName}!\n${template.greeting}\n\n🗓️ *Data:* ${dateStr}\n⏰ *Horário:* ${eventTimeStr}\n⛪ *Ministério:* ${ministryLabel}\n\n*Equipe Escalada:*\n${teamList}\n${orientationsBlock}${closingBlock}`,
               footer: "Ministral • Gestão de Escalas"
             };

             const buttons = [
               { id: "CONFIRMAR", text: "✅ Confirmar presença" },
               { id: "RECUSAR", text: "❌ Não poderei comparecer" },
               { id: "TROCA", text: "🔄 Solicitar troca" }
             ];

             try {
                console.log(`[notif] Sending WA to ${phone} (name: ${memberFirstName})`);
                const sendRes = await sendWhatsAppButtons(evolutionApiUrl, evolutionApiKey, instanceName, phone, content, buttons);
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
