import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'npm:stripe@13';

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const { orgId, planType, userEmail } = await req.json();

    if (!orgId || !planType || !userEmail) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), { status: 400, headers: corsHeaders });
    }

    const sbAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify token
    const { data: { user }, error: authError } = await sbAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: corsHeaders });
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' });

    // Ensure we have correct Price ID based on planType
    const priceIdMap: Record<string, string | undefined> = {
      pro: Deno.env.get('STRIPE_PRO_PRICE_ID'),
      enterprise: Deno.env.get('STRIPE_ENTERPRISE_PRICE_ID')
    };

    const priceId = priceIdMap[planType];
    if (!priceId) {
      return new Response(JSON.stringify({ error: 'Invalid plan type or missing Price ID in environment' }), { status: 400, headers: corsHeaders });
    }

    // Get organization to check if stripe customer exists
    const { data: orgData } = await sbAdmin.from('organizations').select('stripe_customer_id').eq('id', orgId).single();
    
    let customerId = orgData?.stripe_customer_id;

    if (!customerId) {
        const customer = await stripe.customers.create({
            email: userEmail,
            metadata: {
                orgId: orgId
            }
        });
        customerId = customer.id;
        await sbAdmin.from('organizations').update({ stripe_customer_id: customerId }).eq('id', orgId);
    }

    const origin = req.headers.get('origin') || Deno.env.get('APP_URL') || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      client_reference_id: orgId,
      metadata: {
        plan_type: planType,
        org_id: orgId
      },
      success_url: `${origin}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}?payment=canceled`,
      allow_promotion_codes: true,
    });

    return new Response(
      JSON.stringify({ url: session.url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  } catch (error: any) {
    console.error('[stripe-create-checkout] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
