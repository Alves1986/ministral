import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/** Formata número BR para a Evolution API. Retorna null se inválido. */
function formatBrazilPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('55')) digits = digits.slice(2);
  if (digits.length < 10 || digits.length > 11) return null;
  return '55' + digits;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── Autenticação do usuário ─────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error("Unauthorized: Missing Authorization header");
    }
    const token = authHeader.replace('Bearer ', '');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      throw new Error("Unauthorized: " + (userError?.message || "User not found"));
    }

    const { mode, phone, message, org_id } = await req.json()

    const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL')
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY')
    const DEFAULT_INSTANCE = Deno.env.get('EVOLUTION_INSTANCE_NAME') || Deno.env.get('EVOLUTION_INSTANCE')

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      throw new Error(`Evolution API URL ou KEY não configurados.`);
    }

    // Busca instâncias da org
    const { data: mnWhatsapps } = await supabaseAdmin
      .from('ministry_whatsapp')
      .select('ministry_id, instance_name')
      .eq('org_id', org_id)
      .eq('connected', true);

    const ministryMap = new Map<string, string>();
    let firstInstanceForOrg: string | null = null;

    if (mnWhatsapps && mnWhatsapps.length > 0) {
      firstInstanceForOrg = mnWhatsapps[0].instance_name;
      mnWhatsapps.forEach((mw: any) => {
        ministryMap.set(mw.ministry_id, mw.instance_name);
      });
    }

    const getInstance = (ministryId?: string) => {
      if (ministryId && ministryMap.has(ministryId)) {
        return ministryMap.get(ministryId);
      }
      return firstInstanceForOrg || DEFAULT_INSTANCE;
    };

    if (!getInstance()) {
      throw new Error("Nenhuma instância WhatsApp conectada encontrada para esta organização.");
    }

    // ── Modo: envio de mensagem avulsa ─────────────────────────────────────
    if (mode === 'message') {
      if (!phone || !message) {
        throw new Error('phone e message são obrigatórios');
      }

      const formattedPhone = formatBrazilPhone(phone);
      if (!formattedPhone) {
        throw new Error(`Número de telefone inválido: "${phone}". Use o formato (11) 99999-9999.`);
      }

      const instanceToUse = getInstance();
      const endpoint = `${EVOLUTION_API_URL}/message/sendText/${instanceToUse}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'apikey': EVOLUTION_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          number: formattedPhone,
          options: { delay: 1200, presence: "composing" },
          text: message
        })
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Falha ao enviar mensagem (${res.status}): ${body}`);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── Modo: simulação de lembretes ───────────────────────────────────────
    if (mode === 'simulate') {
      if (!org_id) {
        throw new Error('org_id é obrigatório');
      }

      const targetDate = new Date().toISOString().split('T')[0];

      const { data: assignments, error: assigErr } = await supabaseAdmin
        .from('schedule_assignments')
        .select(`
          member_id,
          ministry_id,
          profiles:member_id ( id, name, whatsapp ),
          organization_ministries:ministry_id ( label )
        `)
        .eq('organization_id', org_id)
        .eq('event_date', targetDate);

      if (assigErr) throw assigErr;

      let sent = 0;
      let skipped = 0;
      let errors = 0;
      const details: any[] = [];

      if (!assignments || assignments.length === 0) {
        return new Response(JSON.stringify({ sent, skipped, errors, details, message: "Nenhum assignment encontrado para hoje." }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      for (const assignment of assignments) {
        const member = (assignment as any).profiles;
        const phoneRaw = member?.whatsapp;

        const formattedPhone = formatBrazilPhone(phoneRaw);
        if (!formattedPhone) {
          skipped++;
          details.push({ member: member?.name, status: 'skipped', reason: `Número inválido: "${phoneRaw}"` });
          continue;
        }

        const msgText = `Olá *${member.name.split(' ')[0]}*! 🎶\n\nIsso é uma simulação do lembrete de escala para o dia de hoje.\nSua escala no ministério *${(assignment as any).organization_ministries?.label || 'Desconhecido'}* está confirmada!`;
        const instanceToUse = getInstance(assignment.ministry_id);

        try {
          const res = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceToUse}`, {
            method: 'POST',
            headers: {
              'apikey': EVOLUTION_API_KEY,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              number: formattedPhone,
              options: { delay: 1200, presence: "composing" },
              text: msgText
            })
          });

          if (!res.ok) {
            throw new Error(`API retornou ${res.status}: ${await res.text()}`);
          }
          sent++;
          details.push({ member: member?.name, status: 'sent', phone: formattedPhone });
        } catch (e) {
          errors++;
          details.push({ member: member?.name, status: 'error', reason: (e as any).message });
        }
      }

      return new Response(JSON.stringify({ sent, skipped, errors, details }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ error: "Modo inválido. Use 'message' ou 'simulate'." }), {
      status: 400,
      headers: corsHeaders
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
