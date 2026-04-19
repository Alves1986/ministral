import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'npm:stripe@13'

declare const Deno: any;

serve(async (req: Request) => {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature')!;
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
  } catch (err: any) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const orgId = session.client_reference_id;
    // O plano é enviado como metadata no Payment Link
    // Configure no Stripe: metadata = { plan_type: 'pro' } ou { plan_type: 'enterprise' }
    const planType = session.metadata?.plan_type || 'pro';
    if (orgId) {
      await sb.from('organizations').update({
        plan_type:             planType,  // 'pro' ou 'enterprise'
        billing_status:        'active',
        access_locked:         false,
        stripe_customer_id:    session.customer,
        stripe_subscription_id: session.subscription,
      }).eq('id', orgId);
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const customerId = event.data.object.customer;
    await sb.from('organizations').update({
      plan_type:             'trial',
      billing_status:        'canceled',
      stripe_subscription_id: null,
    }).eq('stripe_customer_id', customerId);
  }

  if (event.type === 'invoice.payment_failed') {
    const customerId = event.data.object.customer;
    await sb.from('organizations').update({
      billing_status: 'past_due'
    }).eq('stripe_customer_id', customerId);
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
