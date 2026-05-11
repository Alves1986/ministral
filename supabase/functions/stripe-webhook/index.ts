import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'npm:stripe@13'

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const sig = req.headers.get('stripe-signature');
    if (!sig) {
      console.error("[stripe-webhook] Missing stripe-signature");
      return new Response('Missing signature', { status: 400, headers: corsHeaders });
    }

    const body = await req.text();
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' });

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
    } catch (err: any) {
      console.error(`[stripe-webhook] Webhook Error: ${err.message}`);
      return new Response(`Webhook Error: ${err.message}`, { status: 400, headers: corsHeaders });
    }

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: existingEvent, error: logError } = await sb
      .from('stripe_event_log')
      .select('event_id')
      .eq('event_id', event.id)
      .maybeSingle();

    if (existingEvent) {
      console.log(`[stripe-webhook] Evento ${event.id} já processado. Ignorando.`);
      return new Response(JSON.stringify({ received: true }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const { error: insertError } = await sb.from('stripe_event_log').insert({
      event_id: event.id,
      processed_at: new Date().toISOString()
    });

    if (insertError) {
        console.error("[stripe-webhook] Error logging event:", insertError);
    }

    console.log(`[stripe-webhook] Iniciando processamento do evento: ${event.type}`);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any;
      const orgId = session.client_reference_id;
      const planType = session.metadata?.plan_type || 'pro';
      
      if (!orgId) {
         console.log(`[stripe-webhook] Aviso: orgId (client_reference_id) não encontrado na sessão.`);
      } else {
        const { data: orgData } = await sb.from('organizations').select('id').eq('id', orgId).single();
        if (!orgData) {
          console.error(`[stripe-webhook] Erro: Organização ${orgId} não encontrada. Ignorando atualização.`);
        } else {
          await sb.from('organizations').update({
            plan_type: planType,
            billing_status: 'active',
            access_locked: false,
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
          }).eq('id', orgId);
          console.log(`[stripe-webhook] Organização ${orgId} atualizada com sucesso (checkout).`);
        }
      }
    }

    if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object as any;
      const customerId = subscription.customer;
      const planType = subscription.metadata?.plan_type || subscription.items?.data[0]?.price?.metadata?.plan_type || 'pro';
      
      await sb.from('organizations').update({
        plan_type: planType,
        billing_status: 'active',
        stripe_subscription_id: subscription.id,
        access_locked: false,
      }).eq('stripe_customer_id', customerId);
      console.log(`[stripe-webhook] Organização atualizada com sucesso (subscription.updated).`);
    }

    if (event.type === 'customer.subscription.deleted') {
      const customerId = (event.data.object as any).customer;
      await sb.from('organizations').update({
        plan_type: 'trial',
        billing_status: 'canceled',
        stripe_subscription_id: null,
        access_locked: true,
      }).eq('stripe_customer_id', customerId);
      console.log(`[stripe-webhook] Assinatura cancelada para customer ${customerId}.`);
    }

    if (event.type === 'invoice.payment_failed') {
      const customerId = (event.data.object as any).customer;
      await sb.from('organizations').update({
        billing_status: 'past_due',
        access_locked: true,
      }).eq('stripe_customer_id', customerId);
      console.log(`[stripe-webhook] Falha no pagamento para customer ${customerId}.`);
    }

    if (event.type === 'invoice.paid') {
      const customerId = (event.data.object as any).customer;
      await sb.from('organizations').update({
        billing_status: 'active',
        access_locked: false
      }).eq('stripe_customer_id', customerId);
      console.log(`[stripe-webhook] Pagamento de fatura efetuado para customer ${customerId}. Acesso liberado.`);
    }

    console.log(`[stripe-webhook] Evento ${event.type} processado com sucesso.`);

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (err: any) {
    console.error(`[stripe-webhook] Global Server Error: ${err.message}`);
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json', ...corsHeaders } 
    });
  }
});
