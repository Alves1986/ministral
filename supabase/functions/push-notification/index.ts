
// Copie TODO este código e cole no Editor da Edge Function 'push-notification' no painel do Supabase.

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
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

    const { ministryId, title, message, type, actionLink, action, name, memberId, targetEmail, status, userId, userIds = [] } = requestData;

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
        .select('ministry_id, allowed_ministries, is_admin, is_super_admin, organization_id')
        .eq('id', user.id)
        .single();

    if (!callerProfile) {
        return new Response(JSON.stringify({ success: false, message: 'Profile not found' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Multi-tenant boundary check: non-superadmins can only access ministries from their own organization
    if (!callerProfile.is_super_admin) {
        if (!callerProfile.organization_id) {
            return new Response(JSON.stringify({ success: false, message: 'Forbidden: caller has no organization' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        if (cleanMid) {
            const { data: minData } = await supabase
                .from('organization_ministries')
                .select('organization_id')
                .eq('id', cleanMid)
                .maybeSingle();

            if (minData && minData.organization_id !== callerProfile.organization_id) {
                return new Response(JSON.stringify({ success: false, message: 'Forbidden: ministry belongs to another organization' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
        }
    }

    const hasAccess = 
        callerProfile.is_super_admin === true ||
        (callerProfile.is_admin === true && callerProfile.organization_id) || 
        (cleanMid && callerProfile.ministry_id === cleanMid) || 
        (cleanMid && callerProfile.allowed_ministries && callerProfile.allowed_ministries.includes(cleanMid));

    let isMinistryAdmin = false;
    if (!hasAccess && cleanMid) {
        // Verifica se é admin ou líder na tabela canônica ministry_members
        const { data: memberRecord } = await supabase
            .from('ministry_members')
            .select('role')
            .eq('profile_id', user.id)
            .eq('ministry_id', cleanMid)
            .maybeSingle();
        if (memberRecord && (memberRecord.role === 'admin' || memberRecord.role === 'leader')) {
            isMinistryAdmin = true;
        }

        // Verifica se pertence à mesma organização do ministério
        if (!isMinistryAdmin && callerProfile.organization_id) {
            const { data: minData } = await supabase
                .from('organization_ministries')
                .select('organization_id')
                .eq('id', cleanMid)
                .maybeSingle();
            if (minData && minData.organization_id === callerProfile.organization_id) {
                isMinistryAdmin = true;
            }
        }
    }

    if (!hasAccess && !isMinistryAdmin) {
        return new Response(JSON.stringify({ success: false, message: 'Forbidden: You do not have permission.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    // --- SECURITY CHECK END ---

    // === PUSH NOTIFICATIONS LOGIC ===
    const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    let privateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    if (!publicKey || !privateKey) {
        return new Response(JSON.stringify({ success: false, message: 'Chaves VAPID não configuradas.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    privateKey = privateKey.trim().replace(/[\r\n\s]/g, '').replace(/^['"]|['"]$/g, '');

    try {
        webpush.setVapidDetails('mailto:contato@ministral.com.br', publicKey, privateKey);
    } catch (err: any) {
        return new Response(JSON.stringify({ success: false, message: "Erro na configuração de notificações." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    if (!cleanMid) return new Response(JSON.stringify({ success: false, message: 'Ministry ID missing' }), { headers: corsHeaders, status: 400 });

    // Determina os DESTINATÁRIOS:
    // - `userIds` (array) ou `userId` no body: envio DIRECIONADO (ex: avisar voluntário escalado ou solicitação).
    //   IMPORTANTE: Em requisições direcionadas, NUNCA fazer fallback para broadcast geral se a lista estiver vazia.
    // - caso contrário: todos os membros do ministério (comunicado geral).
    const isExplicitRequest = requestData.userId !== undefined || requestData.userIds !== undefined;
    let explicitTarget: string[] = [];
    if (Array.isArray(requestData.userIds)) {
      explicitTarget = requestData.userIds.map(String).map((s: string) => s.trim()).filter(Boolean);
    } else if (requestData.userId) {
      explicitTarget = [String(requestData.userId).trim()].filter(Boolean);
    }

    if (isExplicitRequest && explicitTarget.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Nenhum usuário alvo válido especificado para envio direcionado.' 
      }), { headers: corsHeaders, status: 200 });
    }

    // Busca os usuários vinculados ao ministério:
    // 1. Pela tabela canônica ministry_members
    const { data: mMembers } = await supabase
        .from('ministry_members')
        .select('profile_id')
        .eq('ministry_id', cleanMid);

    // 2. Por perfis legados com allowed_ministries ou ministry_id
    const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .or(`ministry_id.eq.${cleanMid},allowed_ministries.cs.{${cleanMid}}`);

    const ministryUserIds = new Set([
        ...(mMembers || []).map((m: any) => m.profile_id),
        ...(profiles || []).map((p: any) => p.id)
    ]);

    // Se vem alvo explícito, restringe aos usuários do ministério — a não ser que o
    // chamador seja admin/super admin (pode notificar admins de outras orgs/super admins).
    const isPrivileged = callerProfile?.is_super_admin === true || callerProfile?.is_admin === true || isMinistryAdmin;

    let targetUserIds: string[];
    if (isExplicitRequest) {
      targetUserIds = explicitTarget.filter(id => isPrivileged || ministryUserIds.has(id));
      if (targetUserIds.length === 0) {
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Usuários especificados não pertencem a este ministério.' 
        }), { headers: corsHeaders, status: 200 });
      }
    } else {
      targetUserIds = Array.from(ministryUserIds);
    }

    // Ensure non-superadmins cannot target users outside their organization
    if (!callerProfile.is_super_admin && targetUserIds.length > 0 && callerProfile.organization_id) {
      const { data: orgUsers } = await supabase
        .from('profiles')
        .select('id')
        .in('id', targetUserIds)
        .eq('organization_id', callerProfile.organization_id);
      const allowedIds = new Set((orgUsers || []).map((u: any) => u.id));
      targetUserIds = targetUserIds.filter(id => allowedIds.has(id));
    }

    if (targetUserIds.length === 0) return new Response(JSON.stringify({ success: true, message: 'Nenhum usuário.' }), { headers: corsHeaders, status: 200 })

    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .in('user_id', targetUserIds)

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
        results.push({ endpoint: record.endpoint, status: 'failed', error: 'Falha no envio' })
      }
    }

    return new Response(JSON.stringify({ 
        success: true, 
        message: successCount > 0 ? `Enviado para ${successCount} dispositivos.` : 'Nenhum envio com sucesso.',
        results 
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })

  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, message: 'Erro interno ao processar notificação.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  }
})
