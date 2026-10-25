import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
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

    const { orgId } = await req.json();

    if (!orgId) {
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

    // Verify user authorization: must be super admin or admin of this specific org
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

    // Get organization to check if stripe customer exists
    const { data: orgData } = await sbAdmin.from('organizations').select('stripe_customer_id').eq('id', orgId).single();
    
    if (!orgData?.stripe_customer_id) {
        return new Response(JSON.stringify({ error: 'Organization does not have an active Stripe customer' }), { status: 400, headers: corsHeaders });
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' });
    const origin = req.headers.get('origin') || Deno.env.get('APP_URL') || 'http://localhost:3000';

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: orgData.stripe_customer_id,
      return_url: `${origin}`,
    });

    return new Response(
      JSON.stringify({ url: portalSession.url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  } catch (error: any) {
    console.error('[stripe-customer-portal] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
