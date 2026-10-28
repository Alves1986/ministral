import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const getAsaasBaseUrl = (env?: string) => {
  const isProd = (env || '').toLowerCase() === 'production';
  return isProd ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3';
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), { status: 401, headers: corsHeaders });
    }
    const token = authHeader.replace('Bearer ', '');

    const { orgId } = await req.json();
    if (!orgId) {
      return new Response(JSON.stringify({ error: 'Missing orgId' }), { status: 400, headers: corsHeaders });
    }

    const sbAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Valida token
    const { data: { user }, error: authError } = await sbAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: corsHeaders });
    }

    // Valida se o usuário tem privilégio administrativo na organização
    const { data: callerProfile, error: profileError } = await sbAdmin
      .from('profiles')
      .select('is_admin, is_super_admin, organization_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !callerProfile) {
      return new Response(JSON.stringify({ error: 'User profile not found' }), { status: 403, headers: corsHeaders });
    }

    const isSuperAdmin = callerProfile.is_super_admin === true;
    const isOrgAdmin = callerProfile.organization_id === orgId && callerProfile.is_admin === true;

    if (!isSuperAdmin && !isOrgAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
    }

    // Busca cliente Asaas da organização
    const { data: orgData } = await sbAdmin
      .from('organizations')
      .select('asaas_customer_id, asaas_subscription_id')
      .eq('id', orgId)
      .single();

    if (!orgData?.asaas_customer_id) {
      return new Response(JSON.stringify({ error: 'A organização não possui cliente ativo no Asaas' }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const apiKey = Deno.env.get('ASAAS_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'ASAAS_API_KEY não configurada' }), { status: 500, headers: corsHeaders });
    }

    const asaasEnv = Deno.env.get('ASAAS_ENVIRONMENT') || 'sandbox';
    const baseUrl = getAsaasBaseUrl(asaasEnv);
    const asaasHeaders = {
      'access_token': apiKey,
      'Content-Type': 'application/json',
      'User-Agent': 'Ministral-SaaS'
    };

    // 1. Tenta buscar cobranças pendentes ou mais recentes da assinatura ou do cliente
    let targetUrl: string | null = null;

    if (orgData.asaas_subscription_id) {
      const subPaymentsRes = await fetch(`${baseUrl}/subscriptions/${orgData.asaas_subscription_id}/payments`, {
        method: 'GET',
        headers: asaasHeaders
      });
      const subPayments = await subPaymentsRes.json();
      if (subPayments?.data && subPayments.data.length > 0) {
        // Prefere cobrança pendente
        const pending = subPayments.data.find((p: any) => p.status === 'PENDING');
        targetUrl = pending?.invoiceUrl || pending?.bankSlipUrl || subPayments.data[0].invoiceUrl || subPayments.data[0].bankSlipUrl;
      }
    }

    if (!targetUrl) {
      const custPaymentsRes = await fetch(`${baseUrl}/payments?customer=${orgData.asaas_customer_id}&sort=dueDate&order=desc&limit=1`, {
        method: 'GET',
        headers: asaasHeaders
      });
      const custPayments = await custPaymentsRes.json();
      if (custPayments?.data && custPayments.data.length > 0) {
        targetUrl = custPayments.data[0].invoiceUrl || custPayments.data[0].bankSlipUrl;
      }
    }

    if (!targetUrl) {
      return new Response(JSON.stringify({ error: 'Nenhuma fatura encontrada no Asaas para esta organização' }), {
        status: 404,
        headers: corsHeaders
      });
    }

    return new Response(JSON.stringify({ url: targetUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (error: any) {
    console.error('[asaas-customer-portal] Erro:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }
});

