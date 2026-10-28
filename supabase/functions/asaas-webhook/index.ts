import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: any;

/**
 * Comparação de strings em tempo constante (proteção contra timing attacks).
 */
function safeCompare(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  if (bufA.length !== bufB.length) return false;
  let result = 0;
  for (let i = 0; i < bufA.length; i++) {
    result |= bufA[i] ^ bufB[i];
  }
  return result === 0;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, asaas-access-token',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const webhookSecret = Deno.env.get('ASAAS_WEBHOOK_SECRET');
    const receivedToken = req.headers.get('asaas-access-token');

    // 1. Validação de segurança do token do Asaas (se configurado no ambiente)
    if (webhookSecret) {
      if (!receivedToken || !safeCompare(receivedToken, webhookSecret)) {
        console.error('[asaas-webhook] Token de validação inválido ou ausente');
        return new Response(JSON.stringify({ error: 'Unauthorized: Invalid asaas-access-token' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    const payload = await req.json();
    const eventType = payload?.event;
    const payment = payload?.payment;
    const subscription = payload?.subscription;

    if (!eventType) {
      return new Response(JSON.stringify({ error: 'Missing event in payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 2. Chave de idempotência única
    const eventId = payload.id || `${eventType}_${payment?.id || subscription?.id || Date.now()}`;

    const { data: existingEvent } = await sb
      .from('asaas_event_log')
      .select('event_id')
      .eq('event_id', eventId)
      .maybeSingle();

    if (existingEvent) {
      console.log(`[asaas-webhook] Evento ${eventId} já processado anteriormente. Ignorando.`);
      return new Response(JSON.stringify({ received: true, already_processed: true }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Registra evento no log
    await sb.from('asaas_event_log').insert({
      event_id: eventId,
      event_type: eventType,
      payload,
      processed_at: new Date().toISOString()
    });

    console.log(`[asaas-webhook] Processando evento: ${eventType} (ID: ${eventId})`);

    // 3. Localiza a organização afetada
    const orgIdCandidate = payment?.externalReference || subscription?.externalReference;
    const customerId = payment?.customer || subscription?.customer;
    const subscriptionId = payment?.subscription || subscription?.id;

    let targetOrg: any = null;

    if (orgIdCandidate) {
      const { data: orgById } = await sb
        .from('organizations')
        .select('id, plan_type, billing_status')
        .eq('id', orgIdCandidate)
        .maybeSingle();
      if (orgById) targetOrg = orgById;
    }

    if (!targetOrg && subscriptionId) {
      const { data: orgBySub } = await sb
        .from('organizations')
        .select('id, plan_type, billing_status')
        .eq('asaas_subscription_id', subscriptionId)
        .maybeSingle();
      if (orgBySub) targetOrg = orgBySub;
    }

    if (!targetOrg && customerId) {
      const { data: orgByCust } = await sb
        .from('organizations')
        .select('id, plan_type, billing_status')
        .eq('asaas_customer_id', customerId)
        .maybeSingle();
      if (orgByCust) targetOrg = orgByCust;
    }

    if (!targetOrg) {
      console.warn(`[asaas-webhook] Aviso: Nenhuma organização correspondente encontrada para o evento ${eventId}`);
      return new Response(JSON.stringify({ received: true, warning: 'Organization not found' }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const orgId = targetOrg.id;

    // 4. Aplica atualizações de estado da organização conforme o tipo de evento
    if (eventType === 'PAYMENT_CONFIRMED' || eventType === 'PAYMENT_RECEIVED') {
      const value = Number(payment?.value || 0);
      const isEnterprise = value >= 80 || (payment?.description || '').toLowerCase().includes('enterprise');
      const planType = isEnterprise ? 'enterprise' : 'pro';

      await sb.from('organizations').update({
        plan_type: planType,
        billing_status: 'active',
        access_locked: false,
        payment_gateway: 'asaas',
        asaas_customer_id: customerId || undefined,
        asaas_subscription_id: subscriptionId || undefined
      }).eq('id', orgId);

      console.log(`[asaas-webhook] Organização ${orgId} ativada com sucesso no plano ${planType}.`);
    } else if (eventType === 'PAYMENT_OVERDUE') {
      await sb.from('organizations').update({
        billing_status: 'past_due',
        access_locked: true
      }).eq('id', orgId);

      console.log(`[asaas-webhook] Organização ${orgId} marcada como past_due por atraso de pagamento.`);
    } else if (eventType === 'PAYMENT_DELETED' || eventType === 'PAYMENT_REFUNDED') {
      await sb.from('organizations').update({
        billing_status: 'canceled',
        access_locked: true
      }).eq('id', orgId);

      console.log(`[asaas-webhook] Organização ${orgId} atualizada para canceled devido a estorno ou remoção.`);
    } else if (eventType === 'SUBSCRIPTION_DELETED') {
      await sb.from('organizations').update({
        plan_type: 'trial',
        billing_status: 'canceled',
        access_locked: true,
        asaas_subscription_id: null
      }).eq('id', orgId);

      console.log(`[asaas-webhook] Assinatura Asaas cancelada para organização ${orgId}.`);
    } else if (eventType === 'SUBSCRIPTION_UPDATED') {
      console.log(`[asaas-webhook] Assinatura Asaas atualizada para organização ${orgId}.`);
    }

    return new Response(JSON.stringify({ received: true, success: true }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (err: any) {
    console.error(`[asaas-webhook] Erro geral: ${err.message}`);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});

