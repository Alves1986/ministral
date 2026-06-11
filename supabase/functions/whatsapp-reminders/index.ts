import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// ── Funções Inlined (Para suportar deploy via Dashboard em arquivo único) ──
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
  const { timeout = 20000, ...fetchOptions } = options;
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
  const { timeout = 20000, retries = 0, delayMs = 1200, presence = "composing" } = options;
  const endpoint = `${apiUrl}/message/sendText/${instanceName}`;
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
        
        // Se a instância pareceu 'open' na verificação mas o socket caiu na hora de enviar
        if (response.status === 428 || body.includes('Connection Closed') || body.includes('Not Connected')) {
          console.warn(`[whatsapp-reminders] Conexão fechada detectada no envio (${instanceName}). Forçando RESTART (tentativa ${attempt + 1})...`);
          try {
            await fetchWithTimeout(`${apiUrl}/instance/restart/${instanceName}`, { 
                method: "PUT",
                headers: { apikey: apiKey }, 
                timeout: 10000 
            });
            await sleep(5000); // Aguarda o socket do Baileys subir após restart
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
  const endpoint = `${apiUrl}/message/sendButtons/${instanceName}`;
  
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

  } catch (error: any) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn(`[whatsapp] Timeout ao enviar botões para ${phone}. Assumindo entregue para evitar duplicidade.`);
      return { success: true, error: "timeout_assumed_delivered" };
    }

    console.warn(`[whatsapp] Falha ao enviar botões para ${phone}. Acionando Fallback Textual.`);
    
    // --- FALLBACK PARA TEXTO ---
    let fallbackText = `*${content.title}*\n\n${content.description}\n\n`;
    
    fallbackText += `_${content.footer}_`;

    return sendWhatsAppMessage(apiUrl, apiKey, instanceName, phone, fallbackText);
  }
}

// ── Verifica e reconecta instância se necessário ───────────────────────────

async function checkInstanceStatus(
  apiUrl: string, apiKey: string, instanceName: string
): Promise<'open' | 'close' | 'connecting' | 'unknown'> {
  try {
    const resp = await fetchWithTimeout(
      `${apiUrl}/instance/connectionState/${instanceName}`,
      { headers: { apikey: apiKey }, timeout: 6000 }
    );
    if (!resp.ok) return 'unknown';
    const data = await resp.json().catch(() => ({}));
    // Evolution API v2: { instance: { state: 'open' | 'close' | 'connecting' } }
    const state = data?.instance?.state || data?.state || 'unknown';
    return state as 'open' | 'close' | 'connecting' | 'unknown';
  } catch {
    return 'unknown';
  }
}

async function ensureInstanceConnected(
  apiUrl: string, apiKey: string, instanceName: string
): Promise<boolean> {
  const status = await checkInstanceStatus(apiUrl, apiKey, instanceName);
  console.log(`[whatsapp-reminders] Instância "${instanceName}" status: ${status}`);

  if (status === 'open') return true;

  if (status === 'close' || status === 'unknown') {
    console.warn(`[whatsapp-reminders] Instância desconectada. Tentando reconectar "${instanceName}"...`);
    try {
      // Tenta reconectar via Evolution API (reusa as credenciais salvas)
      const reconnResp = await fetchWithTimeout(
        `${apiUrl}/instance/connect/${instanceName}`,
        { headers: { apikey: apiKey }, timeout: 10000 }
      );
      const reconnData = await reconnResp.json().catch(() => ({}));
      console.log(`[whatsapp-reminders] Resposta reconexão:`, JSON.stringify(reconnData).slice(0, 200));
    } catch (e) {
      console.error(`[whatsapp-reminders] Erro ao reconectar:`, e);
    }
    // Aguarda 8s para o socket restabelecer
    await sleep(8000);
    const newStatus = await checkInstanceStatus(apiUrl, apiKey, instanceName);
    console.log(`[whatsapp-reminders] Status pós-reconexão: ${newStatus}`);
    return newStatus === 'open';
  }

  // 'connecting' — aguarda e verifica de novo
  await sleep(5000);
  const finalStatus = await checkInstanceStatus(apiUrl, apiKey, instanceName);
  return finalStatus === 'open';
}

// ────────────────────────────────────────────────────────────────────────────

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

// ── Templates por Tipo de Ministério ─────────────────────────────────────────
// Cada código de ministério tem: header (emoji + título), greeting e orientações.

interface MinistryTemplate {
  header: string;     // Emoji + label da mensagem
  greeting: string;   // Abertura da mensagem
  orientations: string; // Orientações contextuais
  closing: string;    // Fechamento inspirador
}

const MINISTRY_TEMPLATES: Record<string, MinistryTemplate> = {
  louvor: {
    header: "🎵",
    greeting: "Você está confirmado(a) na escala de louvor! Que honra servir ao Senhor com você. 🙌",
    orientations: `⚠️ *Orientações do Louvor:*
1. Chegue *30 minutos antes* para aquecimento vocal e soundcheck.
2. Revise as músicas com antecedência — a excelência começa em casa.
3. Verifique os cifras e letras no app antes do culto.
4. Em caso de imprevisto, avise a *liderança imediatamente*.
5. Confirme sua presença fazendo *check-in no aplicativo*.`,
    closing: "🎶 Vamos adorar com tudo que somos. Ele é digno!"
  },

  infantil: {
    header: "🌈",
    greeting: "Você está confirmado(a) na equipe do Ministério Infantil! As crianças vão te esperar. 🥰",
    orientations: `⚠️ *Orientações do Infantil:*
1. Chegue *20 minutos antes* para preparar o ambiente e as atividades.
2. Confira os materiais pedagógicos e a lição do dia com antecedência.
3. A *segurança das crianças* é prioridade — siga todos os protocolos.
4. Nunca deixe uma criança sozinha sem supervisão.
5. Confirme sua presença fazendo *check-in no aplicativo*.`,
    closing: "🌟 \"Deixai os pequeninos virem a mim\" — Que privilégio servir a eles!"
  },

  midia: {
    header: "💻",
    greeting: "Você está confirmado(a) na equipe de Mídia! Sua habilidade faz o culto chegar mais longe. 🎬",
    orientations: `⚠️ *Orientações de Mídia:*
1. Chegue *40 minutos antes* para checklist completo dos equipamentos.
2. Verifique câmeras, cabos, streaming e projetores antes do início.
3. Teste o link de transmissão ao vivo com antecedência.
4. Tenha um plano B para falhas técnicas — esteja sempre preparado(a).
5. Confirme sua presença fazendo *check-in no aplicativo*.`,
    closing: "📡 Cada click seu leva o evangelho mais longe. Valeu!"
  },

  recepcao: {
    header: "🤝",
    greeting: "Você está confirmado(a) na equipe de Recepção! Você é o primeiro sorriso que alguém vê. 💛",
    orientations: `⚠️ *Orientações da Recepção:*
1. Chegue *30 minutos antes* — sua pontualidade é a nossa hospitalidade.
2. Esteja com o visual adequado (uniforme/crachá se aplicável).
3. Acolha *cada pessoa* como se fosse a primeira vez que ela entra numa igreja.
4. Fique atento a visitantes e pessoas com necessidades especiais.
5. Confirme sua presença fazendo *check-in no aplicativo*.`,
    closing: "🏠 Você não recebe pessoas — você recebe famílias. Obrigado!"
  },

  default: {
    header: "⛪",
    greeting: "Você está confirmado(a) na escala do ministério! Obrigado pelo seu serviço.",
    orientations: `⚠️ *Orientações:*
1. Cheguem com *30 minutos de antecedência* para check-list dos equipamentos.
2. Caso haja algum imprevisto, comuniquem a liderança imediatamente.
3. Não esqueça de confirmar a escala realizando o *check-in no aplicativo*.`,
    closing: "🚀 Vamos juntos servir com excelência!"
  }
};

// Detecta o template correto pelo code ou label do ministério
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

  // ── Verificação do plano e flag global/ministério ───────────────────────────
  // Busca dados da organização e do ministério específico simultaneamente
  const [orgRes, minRes] = await Promise.all([
    supabase.from("organizations").select("plan_type, whatsapp_enabled").eq("id", orgId).single(),
    notif.ministry_id 
      ? supabase.from("organization_ministries").select("whatsapp_enabled").eq("id", notif.ministry_id).single()
      : Promise.resolve({ data: { whatsapp_enabled: true }, error: null })
  ]);

  const org = orgRes.data;
  const ministry = minRes.data;

  if (orgRes.error || !org) {
    await supabase.from("whatsapp_scheduled_notifications")
      .update({ status: "failed", error_message: "Organização não encontrada" })
      .eq("id", notif.id);
    return { notif_id: notif.id, error: "Organização não encontrada" };
  }

  // Permite 'pro' ou 'enterprise' (flexibilidade de plano)
  const isPlanValid = org.plan_type === "enterprise" || org.plan_type === "pro";
  const isOrgEnabled = org.whatsapp_enabled !== false; // Default true se null
  const isMinEnabled = ministry ? ministry.whatsapp_enabled !== false : true;

  if (!isPlanValid || !isOrgEnabled || !isMinEnabled) {
    const reason = !isPlanValid ? `Plano ${org.plan_type} insuficiente` : (!isOrgEnabled ? "Org desativada" : "Ministério desativado");
    await supabase.from("whatsapp_scheduled_notifications")
      .update({
        status: "failed",
        error_message: `WhatsApp bloqueado: ${reason}`
      })
      .eq("id", notif.id);
    return { notif_id: notif.id, skipped: true, reason: "plan_or_flag" };
  }

  // ── Busca assignments do evento + code do ministério ────────────────────
  let query = supabase
    .from("schedule_assignments")
    .select(`
      id, member_id, role, event_date, event_rule_id, ministry_id,
      profiles:member_id ( whatsapp, name ),
      organization_ministries!ministry_id ( label, code ),
      event_rules!event_rule_id ( title, time )
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
    // CORREÇÃO: usar 'skipped' em vez de 'sent' — permite reprocessamento se assignments forem adicionados
    await supabase.from("whatsapp_scheduled_notifications").update({ status: "skipped" }).eq("id", notif.id);
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

  // ── Cache de mensagens customizadas por ministry_id ─────────────────────
  // (busca uma vez por ministério para evitar queries repetidas no loop de membros)
  const customMsgCache = new Map<string, string | null>();
  async function getCustomMsg(ministryId: string): Promise<string | null> {
    if (customMsgCache.has(ministryId)) return customMsgCache.get(ministryId) ?? null;
    const { data } = await supabase
      .from("ministry_settings")
      .select("whatsapp_custom_message")
      .eq("ministry_id", ministryId)
      .eq("organization_id", orgId)
      .maybeSingle();
    const msg = data?.whatsapp_custom_message || null;
    customMsgCache.set(ministryId, msg);
    return msg;
  }

  // ── Processa cada grupo ──────────────────────────────────────────────────
  for (const evAssignments of eventsMap.values()) {
    const first = evAssignments[0];
    if (!first) continue;

    const eventTitle    = first.event_rules?.title || notif.event_title || "Culto";
    const eventTimeStr  = first.event_rules?.time?.substring(0, 5) ?? "00:00";
    const ministryLabel = first.organization_ministries?.label || "Ministério";
    const ministryCode  = first.organization_ministries?.code || "";
    const [tY, tM, tD]  = targetDate.split("-");
    const dateStr = `${tD}/${tM}/${tY}`;

    // ── Seleciona template correto ────────────────────────────────────────
    const template = getMinistryTemplate(ministryCode, ministryLabel);

    // Mensagem customizada pelo admin sobrescreve as orientações do template
    const customMsg = await getCustomMsg(first.ministry_id);
    const orientationsBlock = customMsg || template.orientations;
    const closingBlock      = customMsg ? "" : `\n${template.closing}`;

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
      `${template.header} *Escala — ${eventTitle}*\n\n` +
      `${template.greeting}\n\n` +
      `🗓️ *Data:* ${dateStr}\n⏰ *Horário:* ${eventTimeStr}\n⛪ *Ministério:* ${ministryLabel}\n\n` +
      `*Equipe Escalada:*\n${teamList}\n` +
      `${orientationsBlock}${closingBlock}`;

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
      if (!currentInstance) {
        console.warn(`[whatsapp-reminders] Ministério ${a.ministry_id} sem instância WhatsApp configurada. Pulando membro ${profile.name}.`);
        skipped++;
        continue;
      }

      // --- Insere ação pendente para o membro ---
      await supabase.from("whatsapp_pending_actions").insert({
        organization_id: orgId,
        ministry_id: a.ministry_id,
        member_id: a.member_id,
        phone: formattedPhone,
        type: "confirmation",
        event_rule_id: a.event_rule_id,
        event_date: targetDate,
        role: a.role,
        status: "pending",
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // Expira em 24h
      });

      // --- Envia com botões e fallback ---
      const content = {
        title: `Escala — ${eventTitle}`,
        description: `${template.greeting}\n\n🗓️ *Data:* ${dateStr}\n⏰ *Horário:* ${eventTimeStr}\n⛪ *Ministério:* ${ministryLabel}\n\n*Equipe Escalada:*\n${teamList}\n${orientationsBlock}${closingBlock}`,
        footer: "Ministral • Gestão de Escalas"
      };

      const buttons = [
        { id: "CONFIRMAR", text: "✅ Confirmar presença" },
        { id: "RECUSAR", text: "❌ Não poderei comparecer" },
        { id: "TROCA", text: "🔄 Solicitar troca" }
      ];

      const { success: msgOk, error: msgErr } = await sendWhatsAppButtons(
        evolutionApiUrl, evolutionApiKey, currentInstance, formattedPhone, content, buttons
      );

      if (msgOk) {
        console.log(`[whatsapp-reminders] ✅ ${profile.name} (${formattedPhone})`);
        sent++;
        // Registra log (deve usar await para não ser abortado no Deno)
        const { error: logErr } = await supabase.from("whatsapp_usage_logs").insert({
          organization_id: orgId,
          ministry_id: a.ministry_id,
          instance_name: currentInstance,
          recipient_phone: formattedPhone
        });
        if (logErr) console.warn("[whatsapp-reminders] Log error:", logErr.message);
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
    const defaultInstance    = Deno.env.get("EVOLUTION_INSTANCE_NAME") || "ministral-global-v2";

    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Variáveis Supabase não configuradas.");
    if (!evolutionApiUrl || !evolutionApiKey) throw new Error("Credenciais Evolution API não configuradas.");

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

    // ── 4.1. Marca como "processing" para evitar duplicidade em execuções longas ──
    const notifIds = pendingNotifs.map((n: any) => n.id);
    await supabase.from("whatsapp_scheduled_notifications")
      .update({ status: "processing" })
      .in("id", notifIds);

    // ── 4.5. Verifica/reconecta TODAS as instâncias únicas antes de enviar ──
    // Coleta as instâncias únicas que serão usadas neste ciclo
    const notifMinistryIds = [...new Set(pendingNotifs.map((n: any) => n.ministry_id).filter(Boolean))];
    const usedInstances = new Set<string>();
    usedInstances.add(defaultInstance); // instância global sempre verificada
    notifMinistryIds.forEach((mid: string) => {
      const instForMin = ministryMap.get(mid);
      if (instForMin) usedInstances.add(instForMin);
    });

    for (const inst of usedInstances) {
      const isReady = await ensureInstanceConnected(evolutionApiUrl, evolutionApiKey, inst);
      if (!isReady) {
        console.error(`[whatsapp-reminders] ⚠️ Instância "${inst}" não está pronta. Mensagens desta instância serão puladas.`);
      }
    }

    console.log(`[whatsapp-reminders] Processando ${pendingNotifs.length} agendamento(s) em paralelo (batch=3)...`);

    // ── 5. Processamento paralelo com concorrência limitada (max 3) ──────
    const CONCURRENCY = 3;
    const results: any[] = [];

    for (let i = 0; i < pendingNotifs.length; i += CONCURRENCY) {
      const batch = pendingNotifs.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.allSettled(
        batch.map(notif =>
          processNotification(notif, supabase, evolutionApiUrl, evolutionApiKey, defaultInstance, ministryMap)
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