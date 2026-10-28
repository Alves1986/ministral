import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const getAsaasBaseUrl = (env?: string) => {
  const isProd = (env || '').toLowerCase() === 'production';
  return isProd ? 'https://api.asaas.com/v3' : 'https://sandbox.asaas.com/api/v3';
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

    const { orgId, planType, userEmail, customerName, cpfCnpj } = await req.json();

    if (!orgId || !planType || !userEmail) {
      return new Response(JSON.stringify({ error: 'Missing required parameters (orgId, planType, userEmail)' }), { status: 400, headers: corsHeaders });
    }

    const sbAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Valida token do usuário
    const { data: { user }, error: authError } = await sbAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: corsHeaders });
    }

    // 2. Valida permissões (Super Admin ou Admin da organização específica)
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
      return new Response(JSON.stringify({ error: 'Forbidden: Insufficient privileges for this organization' }), { status: 403, headers: corsHeaders });
    }

    // 3. Configurações da API Asaas
    const apiKey = Deno.env.get('ASAAS_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'ASAAS_API_KEY não configurada no ambiente' }), { status: 500, headers: corsHeaders });
    }

    const asaasEnv = Deno.env.get('ASAAS_ENVIRONMENT') || 'sandbox';
    const baseUrl = getAsaasBaseUrl(asaasEnv);

    const asaasHeaders = {
      'access_token': apiKey,
      'Content-Type': 'application/json',
      'User-Agent': 'Ministral-SaaS'
    };

    // 4. Mapeamento de preços do plano
    const planPrices: Record<string, { value: number; name: string }> = {
      pro: { value: 49.90, name: 'Pro' },
      enterprise: { value: 99.90, name: 'Enterprise' }
    };

    const targetPlan = planPrices[planType];
    if (!targetPlan) {
      return new Response(JSON.stringify({ error: `Plano inválido: ${planType}. Escolha 'pro' ou 'enterprise'` }), { status: 400, headers: corsHeaders });
    }

    // 5. Consulta organização no Supabase
    const { data: orgData, error: orgError } = await sbAdmin
      .from('organizations')
      .select('id, name, asaas_customer_id, asaas_subscription_id')
      .eq('id', orgId)
      .single();

    if (orgError || !orgData) {
      return new Response(JSON.stringify({ error: 'Organização não encontrada' }), { status: 404, headers: corsHeaders });
    }

    let customerId = orgData.asaas_customer_id;

    // 6. Localiza ou cria cliente no Asaas
    if (!customerId) {
      // Tenta buscar por externalReference
      const searchRes = await fetch(`${baseUrl}/customers?externalReference=${encodeURIComponent(orgId)}`, {
        method: 'GET',
        headers: asaasHeaders
      });
      const searchData = await searchRes.json();

      if (searchData?.data && searchData.data.length > 0) {
        customerId = searchData.data[0].id;
      } else {
        // Tenta buscar por email
        const emailSearchRes = await fetch(`${baseUrl}/customers?email=${encodeURIComponent(userEmail)}`, {
          method: 'GET',
          headers: asaasHeaders
        });
        const emailSearchData = await emailSearchRes.json();

        if (emailSearchData?.data && emailSearchData.data.length > 0) {
          customerId = emailSearchData.data[0].id;
        } else {
          // Cria novo cliente no Asaas
          const createCustomerPayload: any = {
            name: customerName || orgData.name || userEmail.split('@')[0],
            email: userEmail,
            externalReference: orgId,
            notificationDisabled: false
          };
          if (cpfCnpj) {
            createCustomerPayload.cpfCnpj = cpfCnpj;
          }

          const createRes = await fetch(`${baseUrl}/customers`, {
            method: 'POST',
            headers: asaasHeaders,
            body: JSON.stringify(createCustomerPayload)
          });
          const createData = await createRes.json();

          if (!createRes.ok || !createData.id) {
            console.error('[asaas-create-checkout] Erro ao criar cliente no Asaas:', createData);
            return new Response(JSON.stringify({ 
              error: createData.errors?.[0]?.description || 'Erro ao registrar cliente no Asaas' 
            }), { status: 400, headers: corsHeaders });
          }

          customerId = createData.id;
        }
      }

      // Persiste o asaas_customer_id na organização
      await sbAdmin.from('organizations').update({
        asaas_customer_id: customerId,
        payment_gateway: 'asaas'
      }).eq('id', orgId);
    }

    // 7. Data de vencimento inicial (hoje no fuso brasileiro YYYY-MM-DD)
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // 8. Cria a assinatura mensal no Asaas com billingType 'UNDEFINED' (PIX, Cartão e Boleto)
    const subscriptionPayload = {
      customer: customerId,
      billingType: 'UNDEFINED',
      value: targetPlan.value,
      nextDueDate: todayStr,
      cycle: 'MONTHLY',
      description: `Assinatura Plano ${targetPlan.name} - Ministral`,
      externalReference: orgId
    };

    const subRes = await fetch(`${baseUrl}/subscriptions`, {
      method: 'POST',
      headers: asaasHeaders,
      body: JSON.stringify(subscriptionPayload)
    });
    const subData = await subRes.json();

    if (!subRes.ok || !subData.id) {
      console.error('[asaas-create-checkout] Erro ao criar assinatura no Asaas:', subData);
      return new Response(JSON.stringify({ 
        error: subData.errors?.[0]?.description || 'Erro ao gerar assinatura no Asaas' 
      }), { status: 400, headers: corsHeaders });
    }

    const subscriptionId = subData.id;

    // Atualiza a subscription na organização
    await sbAdmin.from('organizations').update({
      asaas_subscription_id: subscriptionId,
      payment_gateway: 'asaas'
    }).eq('id', orgId);

    // 9. Busca a cobrança gerada para obter o invoiceUrl (URL do checkout seguro)
    const paymentsRes = await fetch(`${baseUrl}/subscriptions/${subscriptionId}/payments`, {
      method: 'GET',
      headers: asaasHeaders
    });
    const paymentsData = await paymentsRes.json();

    let checkoutUrl = subData.invoiceUrl;
    if (!checkoutUrl && paymentsData?.data && paymentsData.data.length > 0) {
      checkoutUrl = paymentsData.data[0].invoiceUrl || paymentsData.data[0].bankSlipUrl;
    }

    if (!checkoutUrl) {
      // Fallback: se invoiceUrl não veio na listagem, busca pagamento direto por ID
      if (paymentsData?.data?.[0]?.id) {
        const singlePayRes = await fetch(`${baseUrl}/payments/${paymentsData.data[0].id}`, {
          method: 'GET',
          headers: asaasHeaders
        });
        const singlePay = await singlePayRes.json();
        checkoutUrl = singlePay.invoiceUrl || singlePay.bankSlipUrl;
      }
    }

    return new Response(
      JSON.stringify({
        url: checkoutUrl,
        subscriptionId,
        customerId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: any) {
    console.error('[asaas-create-checkout] Erro inesperado:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});

