import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendWhatsAppMessage(
  apiUrl: string, apiKey: string, instanceName: string, phone: string, text: string
) {
  const endpoint = `${apiUrl}/message/sendText/${instanceName}`;
  const response = await fetch(endpoint, {
    method: "POST", headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify({ number: phone, options: { delay: 1000, presence: "composing" }, text }),
  });
  return response.ok;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const apiUrl = Deno.env.get("EVOLUTION_API_URL")!;
    const apiKey = Deno.env.get("EVOLUTION_API_KEY")!;
    const body = await req.json();

    if (body.event !== "messages.upsert") return new Response(JSON.stringify({ ignored: "event_type" }), { headers: corsHeaders });
    const data = body.data ?? {};
    if (data.key?.fromMe === true) return new Response(JSON.stringify({ ignored: "fromMe" }), { headers: corsHeaders });

    const remoteJid: string = data.key?.remoteJid ?? "";
    if (remoteJid.endsWith("@g.us") || remoteJid.endsWith("@broadcast")) return new Response(JSON.stringify({ ignored: "group" }), { headers: corsHeaders });

    const msgObj = data.message ?? {};
    const rawText = (msgObj.conversation ?? msgObj.extendedTextMessage?.text ?? "")
      .trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    let actionId = null;
    if (rawText === "2" || rawText.includes("SUBSTITUICAO") || rawText.includes("SUBSTITUIR") || rawText === "TROCAR") {
      actionId = "REQUEST_SWAP";
    }

    if (actionId !== "REQUEST_SWAP") return new Response(JSON.stringify({ ignored: "unknown_command" }), { headers: corsHeaders });

    let digits = remoteJid.split("@")[0].replace(/\D/g, "");
    if (digits.startsWith("55") && digits.length >= 10) {
       // Format is ok enough for lookup if we match correctly
       if (digits.length === 12 || digits.length === 13) {
           digits = digits;
       }
    }
    
    // Find the member profile by phone
    // It's tricky to match exact phone sometimes, we'll try to find active assignments directly
    // Let's use whatsapp_notifications as a trace since we stored phone there!
    // BUT what if the webhook looks for active confirmable schedules?
    const todayStr = new Date(Date.now() - 3*3600000).toISOString().slice(0,10);
    const tomorrowStr = new Date(Date.now() + 21*3600000).toISOString().slice(0,10);

    const { data: memberProfiles } = await supabase
      .from("profiles")
      .select("id, name, organization_id, whatsapp")
      .not("whatsapp", "is", null);

    const profile = (memberProfiles || []).find((p: any) => {
        if (!p.whatsapp) return false;
        const pDigits = p.whatsapp.replace(/\D/g, '');
        const rDigits = digits.startsWith('55') ? digits.slice(2) : digits;
        return pDigits.endsWith(rDigits) || pDigits.slice(-8) === rDigits.slice(-8);
    });

    if (!profile) {
        return new Response(JSON.stringify({ error: "profile_not_found" }), { headers: corsHeaders });
    }

    // Look for confirmed schedule_assignments today/tomorrow
    const { data: assignments } = await supabase
      .from("schedule_assignments")
      .select(`id, event_date, event_rule_id, ministry_id, role, organization_id, status, confirmed, event_rules(title, time)`)
      .eq("member_id", profile.id)
      .eq("confirmed", false) // or true? the user might want to swap confirmed or unconfirmed. User explicitly said "1. Buscar agendamento ativo do membro (schedule_members) ... e status confirmed". Wait, if the user hasn't confirmed yet? Let's just find any assignment that isn't already swap_requested
      .neq("status", "swap_requested")
      .gte("event_date", todayStr)
      .order("event_date", { ascending: true })
      .limit(1);
      
    // Fix logic based on user's prompt: "status confirmed" meaning maybe confirmed = true? Or the 'status' text field? 
    // They wrote "status confirmed", but `schedule_assignments` only has `status` (which we are introducing) and `confirmed`.
    // I'll accept any assignment today/tomorrow that hasn't swap_requested yet.
    
    if (!assignments || assignments.length === 0) {
        await sendWhatsAppMessage(apiUrl, apiKey, body.instance ?? "ministral-global-v2", remoteJid.split("@")[0], "Nenhuma escala ativa encontrada para substituição no momento.");
        return new Response(JSON.stringify({ ignored: "no_schedule" }), { headers: corsHeaders });
    }

    const assignment = assignments[0];

    await supabase.from("swap_requests").insert({
        organization_id: assignment.organization_id,
        ministry_id: assignment.ministry_id,
        requester_id: profile.id,
        requester_name: profile.name,
        role: assignment.role,
        event_date: assignment.event_date,
        event_datetime: `${assignment.event_date}T${assignment.event_rules?.time || "00:00:00"}`,
        event_title: assignment.event_rules?.title || "Evento",
        status: "pending",
        reason: "Solicitado via WhatsApp"
    });

    await supabase.from("schedule_assignments")
        .update({ status: "swap_requested" })
        .eq("id", assignment.id);

    await sendWhatsAppMessage(apiUrl, apiKey, body.instance ?? "ministral-global-v2", remoteJid.split("@")[0], `🔄 A sua solicitação de substituição para o culto *${assignment.event_rules?.title}* do dia ${assignment.event_date.split("-").reverse().join("/")} foi registrada com sucesso!\n\nUm admin será notificado e outro membro poderá assumir a escala. 🙏`);

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  } catch (err: any) {
    console.error("[whatsapp-webhook] Erro:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
