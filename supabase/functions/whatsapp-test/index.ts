import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { mode, phone, message, org_id } = await req.json()

    const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL')
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY')
    const EVOLUTION_INSTANCE = Deno.env.get('EVOLUTION_INSTANCE_NAME') || Deno.env.get('EVOLUTION_INSTANCE')

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE) {
      throw new Error(`Evolution API is not completely configured.`);
    }

    if (mode === 'message') {
      if (!phone || !message) {
        throw new Error('Missing phone or message');
      }

      // Format phone number to 5511999999999
      let formattedPhone = phone.replace(/\D/g, '');
      if (formattedPhone.length === 10 || formattedPhone.length === 11) {
        formattedPhone = '55' + formattedPhone;
      }

      const res = await fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
        method: 'POST',
        headers: {
          'apikey': EVOLUTION_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          number: formattedPhone,
          options: { delay: 1200 },
          textMessage: { text: message }
        })
      });

      if (!res.ok) {
        throw new Error(`Failed to send message: ${await res.text()}`);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } 
    
    if (mode === 'simulate') {
      if (!org_id) {
        throw new Error('Missing org_id');
      }

      const targetDate = new Date().toISOString().split('T')[0];

      // Service role client needed to fetch all data safely here avoiding RLS if needed, 
      // but we are using anon client with user's token. The user is an admin.
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )

      const { data: assignments, error: assigErr } = await supabaseAdmin
        .from('schedule_assignments')
        .select(`
          member_id,
          ministry_id,
          organization_members!inner (
            id, name, phone, whatsapp
          ),
          ministries:ministry_id ( name )
        `)
        .eq('organization_id', org_id)
        .eq('event_date', targetDate);

      if (assigErr) throw assigErr;

      let sent = 0;
      let skipped = 0;
      let errors = 0;
      const details = [];

      if (!assignments || assignments.length === 0) {
         return new Response(JSON.stringify({ sent, skipped, errors, details, message: "No assignments found for today" }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      for (const assignment of assignments) {
        const member = (assignment as any).organization_members;
        const phoneRaw = member?.phone || member?.whatsapp;
        
        if (!phoneRaw) {
          skipped++;
          details.push({ member: member?.name, status: 'skipped', reason: 'No phone number' });
          continue;
        }

        let formattedPhone = phoneRaw.replace(/\D/g, '');
        if (formattedPhone.length === 10 || formattedPhone.length === 11) {
          formattedPhone = '55' + formattedPhone;
        }

        const msgText = `Olá *${member.name.split(' ')[0]}*! 🎶\n\nIsso é uma simulação do lembrete de escala para o dia de hoje.\nSua escala no ministério *${(assignment as any).ministries?.name || 'Desconhecido'}* está confirmada!`;

        try {
          const res = await fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
            method: 'POST',
            headers: {
              'apikey': EVOLUTION_API_KEY,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              number: formattedPhone,
              options: { delay: 1200 },
              textMessage: { text: msgText }
            })
          });

          if (!res.ok) {
             throw new Error(`API returned ${res.status}`);
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

    return new Response(JSON.stringify({ error: "Invalid mode" }), { status: 400, headers: corsHeaders });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
