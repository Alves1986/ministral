import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const ALLOWED_ORIGIN = Deno.env.get('APP_ORIGIN') || 'https://seu-dominio.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { token } = await req.json()

    if (!token) {
      return new Response(
        JSON.stringify({ valid: false, message: 'Token is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Validar o token no banco
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('invite_tokens')
      .select(`
        token, organization_id, ministry_id,
        expires_at, used,
        organization_ministries!ministry_id (label)
      `)
      .eq('token', token)
      .maybeSingle()

    if (inviteError || !invite) {
      return new Response(
        JSON.stringify({ valid: false, message: 'Convite inválido ou expirado.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const now = new Date()
    const expiresAt = new Date(invite.expires_at)

    if (invite.used || now > expiresAt) {
      return new Response(
        JSON.stringify({ valid: false, message: 'Convite já utilizado ou expirado.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    return new Response(
      JSON.stringify({
        valid: true,
        data: {
          token: invite.token,
          organization_id: invite.organization_id,
          ministry_id: invite.ministry_id,
          ministry_name: invite.organization_ministries?.label
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ valid: false, message: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
