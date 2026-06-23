import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const ALLOWED_ORIGIN = Deno.env.get('APP_ORIGIN') || '*';

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { token, email, password, name, whatsapp, birthDate, functions = [] } = await req.json()

    if (!token || !email || !password || !name) {
      return new Response(
        JSON.stringify({ success: false, message: 'Dados incompletos' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Validar o token no banco
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('invite_tokens')
      .select('*')
      .eq('token', token)
      .maybeSingle()

    if (inviteError || !invite) {
      return new Response(
        JSON.stringify({ success: false, message: 'Convite inválido ou expirado.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const now = new Date()
    const expiresAt = new Date(invite.expires_at)

    if (invite.used || now > expiresAt) {
      return new Response(
        JSON.stringify({ success: false, message: 'Convite já utilizado ou expirado.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Criar o usuário usando o admin client
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: name,
        ministry_id: invite.ministry_id,
        organization_id: invite.organization_id,
      }
    })

    if (authError) {
      const isExisting =
        authError.message?.toLowerCase().includes("already registered") ||
        authError.message?.toLowerCase().includes("already exists");
      if (isExisting) {
        return new Response(
          JSON.stringify({
            success: false,
            isExistingUser: true,
            message: "Este e-mail já possui uma conta. Faça login para entrar no ministério."
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }
      throw authError;
    }

    const userId = authData.user?.id;

    if (!userId) {
      throw new Error("Usuário criado sem ID");
    }

    // Esperar pelo profile (criado pelo trigger)
    let profileExists = false;
    for (let i = 0; i < 5; i++) {
      const { data: profileCheck } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .maybeSingle();

      if (profileCheck) {
        profileExists = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (!profileExists) {
        // Se após 5s o trigger falhou ainda assim, tente inserir manualmente
        await supabaseAdmin.from("profiles").insert({
            id: userId,
            email: email,
            name: name,
            whatsapp: whatsapp,
            birth_date: birthDate,
            ministry_id: invite.ministry_id,
            organization_id: invite.organization_id,
        });
    }

    // Identificar se é o primeiro do ministério para setar admin
    const { count: membersCount } = await supabaseAdmin
      .from("ministry_members")
      .select("id", { count: "exact", head: true })
      .eq("ministry_id", invite.ministry_id);

    const isFirstMember = membersCount === 0;

    // Atualizar Profile
    await supabaseAdmin
      .from("profiles")
      .update({
        name: name,
        email: email,
        whatsapp: whatsapp,
        birth_date: birthDate,
        organization_id: invite.organization_id,
        ministry_id: invite.ministry_id,
        allowed_ministries: [invite.ministry_id],
        is_admin: isFirstMember,
        is_super_admin: false,
      })
      .eq("id", userId);

    // Inserir ou atualizar na ministry_members
    const { data: existingMember } = await supabaseAdmin
      .from("ministry_members")
      .select("id")
      .eq("profile_id", userId)
      .eq("ministry_id", invite.ministry_id)
      .maybeSingle();

    if (existingMember) {
      await supabaseAdmin
        .from("ministry_members")
        .update({ role: "member", functions: functions })
        .eq("id", existingMember.id);
    } else {
      await supabaseAdmin.from("ministry_members").insert({
        profile_id: userId,
        ministry_id: invite.ministry_id,
        role: "member",
        functions: functions,
      });
    }

    // Marcar convite como usado
    await supabaseAdmin
      .from("invite_tokens")
      .update({ used: true })
      .eq("token", token);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          user_id: authData.user?.id
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
