
// Copie TODO este código e cole no Editor da Edge Function 'push-notification' no painel do Supabase.

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const ALLOWED_ORIGIN = Deno.env.get('APP_ORIGIN') || 'https://seu-dominio.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Fix for "Cannot find name 'Deno'"
declare const Deno: any;

Deno.serve(async (req: Request) => {
  // 1. Tratamento de CORS (Pre-flight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. Leitura Segura do Corpo da Requisição
    let requestData: any = {};
    try {
        const text = await req.text();
        if (text) requestData = JSON.parse(text);
    } catch (e) {
        console.warn("Corpo da requisição vazio ou inválido.");
    }

    const { ministryId, title, message, type, actionLink, action, name, memberId, targetEmail, status } = requestData;

    // 3. DETECÇÃO DE TESTE DO DASHBOARD (Supabase "Test Function" button)
    if (name === "Functions" || (!ministryId && !action)) {
         return new Response(JSON.stringify({ 
             success: true, 
             message: 'Edge Function está ONLINE! Configure os Segredos (Secrets) no Dashboard para envio real.' 
         }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
         })
    }

    // 4. Feature: Gerador de Chaves
    if (action === 'generate_keys') {
        const keys = webpush.generateVAPIDKeys();
        return new Response(JSON.stringify({ 
            success: true, 
            keys 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    // 5. Configuração do Supabase Client via Env Vars
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error("Variáveis de ambiente do Supabase (URL/KEY) não configuradas no Dashboard.");
    }

    // Inicializa cliente com Service Role para poder validar o usuário e ler perfis/inscrições
    // IMPORTANTE: Service Role bypassa RLS, permitindo ações de Admin.
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // --- SECURITY CHECK START ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
        return new Response(JSON.stringify({ success: false, message: 'Authorization header missing' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
        return new Response(JSON.stringify({ success: false, message: 'Invalid User Token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const cleanMid = ministryId ? ministryId.trim().toLowerCase().replace(/\s+/g, '-') : null;

    const { data: callerProfile } = await supabase
        .from('profiles')
        .select('ministry_id, allowed_ministries, is_admin')
        .eq('id', user.id)
        .single();

    if (!callerProfile) {
        return new Response(JSON.stringify({ success: false, message: 'Profile not found' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const hasAccess = 
        callerProfile.is_admin || 
        (cleanMid && callerProfile.ministry_id === cleanMid) || 
        (cleanMid && callerProfile.allowed_ministries && callerProfile.allowed_ministries.includes(cleanMid));

    if (!hasAccess) {
        return new Response(JSON.stringify({ success: false, message: 'Forbidden: You do not have permission.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    // --- SECURITY CHECK END ---

    // === ADMIN ACTIONS ===
    if (action === 'delete_member') {
        if (!memberId || !cleanMid) return new Response(JSON.stringify({ success: false }), { status: 400, headers: corsHeaders });
        const { data: profile } = await supabase.from('profiles').select('allowed_ministries, ministry_id').eq('id', memberId).single();
        if (profile) {
             const currentAllowed = Array.isArray(profile.allowed_ministries) ? profile.allowed_ministries : [];
             const newAllowed = currentAllowed.filter((m: string) => m !== cleanMid);
             const updates: any = { allowed_ministries: newAllowed };
             if (profile.ministry_id === cleanMid) updates.ministry_id = newAllowed.length > 0 ? newAllowed[0] : null;
             await supabase.from('profiles').update(updates).eq('id', memberId);
        }
        const todayIso = new Date().toISOString();
        const { data: events } = await supabase.from('events').select('id').eq('ministry_id', cleanMid).gte('date_time', todayIso);
        const eventIds = events?.map((e: any) => e.id) || [];
        if (eventIds.length > 0) await supabase.from('schedule_assignments').delete().eq('member_id', memberId).in('event_id', eventIds);
        return new Response(JSON.stringify({ success: true, message: 'Membro removido.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    if (action === 'toggle_admin') {
        if (!callerProfile.is_admin) return new Response(JSON.stringify({ success: false, message: 'Restrito a Admin.' }), { status: 403, headers: corsHeaders });
        await supabase.from('profiles').update({ is_admin: status }).eq('email', targetEmail);
        return new Response(JSON.stringify({ success: true, message: 'Permissão alterada.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    // === PUSH NOTIFICATIONS LOGIC ===
    const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    let privateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    if (!publicKey || !privateKey) {
        return new Response(JSON.stringify({ success: false, message: 'Chaves VAPID não configuradas.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    privateKey = privateKey.trim().replace(/[\r\n\s]/g, '').replace(/^['"]|['"]$/g, '');

    try {
        webpush.setVapidDetails('mailto:admin@example.com', publicKey, privateKey);
    } catch (err: any) {
        return new Response(JSON.stringify({ success: false, message: "Erro VAPID.", details: err.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    if (!cleanMid) return new Response(JSON.stringify({ success: false, message: 'Ministry ID missing' }), { headers: corsHeaders, status: 400 });

    // Busca usuários do ministério
    const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .or(`ministry_id.eq.${cleanMid},allowed_ministries.cs.{${cleanMid}}`)
        
    const userIds = profiles?.map((p: any) => p.id) || []
    
    if (userIds.length === 0) return new Response(JSON.stringify({ success: true, message: 'Nenhum usuário.' }), { headers: corsHeaders, status: 200 })

    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .in('user_id', userIds)

    if (!subscriptions || subscriptions.length === 0) return new Response(JSON.stringify({ success: true, message: 'Nenhuma inscrição.' }), { headers: corsHeaders, status: 200 })

    const results = []
    let successCount = 0;
    
    // Constrói o payload padronizado para o Service Worker
    const payload = JSON.stringify({
        title: title || 'Ministral',
        body: message || 'Você tem uma nova notificação.',
        icon: '/branding/icon-light.png',
        data: { 
            url: actionLink ? `/?tab=${actionLink}` : '/',
            type: type || 'info'
        }
    });

    for (const record of subscriptions) {
      if (!record.p256dh || !record.auth || !record.endpoint) continue;

      const pushSubscription = {
        endpoint: record.endpoint,
        keys: { p256dh: record.p256dh, auth: record.auth },
      }

      try {
        await webpush.sendNotification(pushSubscription, payload)
        results.push({ endpoint: record.endpoint, status: 'success' })
        successCount++;
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', record.endpoint);
        }
        results.push({ endpoint: record.endpoint, status: 'failed', error: err.message })
      }
    }

    return new Response(JSON.stringify({ 
        success: true, 
        message: successCount > 0 ? `Enviado para ${successCount} dispositivos.` : 'Nenhum envio com sucesso.',
        results 
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })

  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, message: 'Erro interno.', details: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  }
})
