import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req: Request) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Variáveis de ambiente do Supabase não configuradas.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Evolution API credentials
    const evolutionApiUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");
    const instanceName = Deno.env.get("EVOLUTION_INSTANCE_NAME");

    if (!evolutionApiUrl || !evolutionApiKey || !instanceName) {
      throw new Error("Credenciais da Evolution API não configuradas.");
    }

    // Obter hora atual
    const now = new Date();
    // Hora atual no formato HH:00 (baseado na hora UTC, adaptar se necessário,
    // mas o Supabase suporta `now() AT TIME ZONE 'America/Sao_Paulo'` via DB, 
    // ou podemos checar do próprio Date:
    const currentHourString = now.toISOString().split("T")[1].substring(0, 2) + ":00:00"; 
    // Mudar fuso horário dependendo de como o send_time é armazenado

    // 1. Busca organizações com WhatsApp habilitado
    const { data: orgSettings, error: orgErr } = await supabase
      .from('whatsapp_settings')
      .select('*')
      .eq('enabled', true);

    if (orgErr) throw orgErr;

    // Busca quais os whatsapp individuais das igrejas
    const { data: mnWhatsapps, error: mnErr } = await supabase
      .from('ministry_whatsapp')
      .select('*')
      .eq('connected', true);

    const ministryMap = new Map();
    if (mnWhatsapps) {
      mnWhatsapps.forEach((mw: any) => {
        ministryMap.set(mw.ministry_id, mw.instance_name);
      });
    }

    for (const orgSetting of orgSettings) {
      // 2. Usar o send_time para ver se bate. Para precisão de fuso local,
      // considere usar a hora do banco de dados (que tem timezone) para garantir segurança.
      // Daremos um select na hora local do SQL:
      const { data: dbTime } = await supabase.rpc('get_current_brazil_time');
      // Pular caso não bata a hora se for enviar 
      // (aqui é um exemplo geral de verificação da hora configurada)
      
      const sendDaysBefore = orgSetting.send_days_before || 0;
      const targetDateObj = new Date();
      targetDateObj.setDate(targetDateObj.getDate() + sendDaysBefore);
      const targetDate = targetDateObj.toISOString().split('T')[0];

      const { data: assignments, error: assigErr } = await supabase
        .from('schedule_assignments')
        .select(`
          member_id,
          role,
          event_date,
          ministry_id,
          profiles:member_id ( whatsapp, name ),
          ministries:ministry_id ( name )
        `)
        .eq('organization_id', orgSetting.org_id)
        .eq('event_date', targetDate);

      if (assigErr) throw assigErr;
      if (!assignments || assignments.length === 0) continue;

      for (const assignment of assignments) {
        const profile = assignment.profiles as any;
        const ministry = assignment.ministries as any;
        if (!profile?.whatsapp) continue;

        let num = profile.whatsapp.replace(/\D/g, '');
        if (!num.startsWith('55')) num = '55' + num;

        // Monta Mensagem
        const minDate = new Date(assignment.event_date);
        minDate.setHours(minDate.getHours() + 12);
        const dayStr = minDate.toLocaleDateString('pt-BR');
        
        let msg = '';
        if (sendDaysBefore === 0) {
            msg = `*Lembrete de Escala!*\n\nOlá ${profile.name},\nVocê está escalado(a) HOJE em *${ministry.name}*.\nFunção: ${assignment.role}`;
        } else {
            msg = `*Lembrete de Escala!*\n\nOlá ${profile.name},\nVocê está escalado(a) para o dia ${dayStr} em *${ministry.name}*.\nFunção: ${assignment.role}`;
        }

        const currentInstance = ministryMap.get(assignment.ministry_id) || instanceName;
        const endpoint = `${evolutionApiUrl}/message/sendText/${currentInstance}`;
        try {
          const reqEvolution = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': evolutionApiKey
            },
            body: JSON.stringify({
              number: num,
              options: { delay: 1200, presence: "composing" },
              textMessage: { text: msg }
            })
          });
          const resText = await reqEvolution.text();
          console.log(`Enviado WhatsApp para ${profile.name} (${num}): `, resText);
        } catch (postErr) {
          console.error(`Erro ao enviar para ${num}:`, postErr);
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("Erro no Edge Function:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
