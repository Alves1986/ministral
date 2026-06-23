import { getSupabase } from "./client";
import { notifySuperAdmins } from "./notifications";
import { log } from "../../utils/logger";

export const loginWithEmail = async (email: string, pass: string) => {
  const sb = getSupabase();
  if (!sb)
    return { success: false, message: "Erro: Supabase não inicializado." };
  const { data, error } = await (sb.auth as any).signInWithPassword({
    email,
    password: pass,
  });
  if (error) return { success: false, message: error.message };
  return { success: true, data };
};

export const loginWithGoogle = async () => {
  const sb = getSupabase();
  if (!sb)
    return { success: false, message: "Erro: Supabase não inicializado." };
  
  // Preserva o invite token na URL de redirect, se existir
  const currentUrl = new URL(window.location.href);
  const inviteToken = currentUrl.searchParams.get('invite');
  const redirectUrl = new URL(window.location.origin);
  if (inviteToken) {
    redirectUrl.searchParams.set('invite', inviteToken);
    // Salva no localStorage como fallback (Supabase pode strippar query params)
    localStorage.setItem('pending_invite_token', inviteToken);
  }

  const { data, error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl.toString()
    }
  });

  if (error) return { success: false, message: error.message };
  return { success: true, data };
};

/**
 * Inicia o fluxo de cadastro via Google para um membro convidado.
 * Salva o invite token e roles selecionados no localStorage antes de redirecionar.
 */
export const registerWithGoogleInvite = async (
  token: string,
  selectedRoles: string[],
) => {
  const sb = getSupabase();
  if (!sb)
    return { success: false, message: "Erro: Supabase não inicializado." };

  // Salva dados do convite no localStorage para recuperar após redirect
  localStorage.setItem('pending_invite_token', token);
  localStorage.setItem('pending_invite_roles', JSON.stringify(selectedRoles));

  const redirectUrl = new URL(window.location.origin);
  redirectUrl.searchParams.set('invite', token);

  const { data, error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl.toString()
    }
  });

  if (error) return { success: false, message: error.message };
  return { success: true, data };
};

/**
 * Processa o convite pendente após o redirect do Google OAuth.
 * Chamado pelo App.tsx quando detecta um pending_invite_token + usuário logado.
 */
export const processGoogleInviteAfterRedirect = async (): Promise<{
  success: boolean;
  message?: string;
}> => {
  const sb = getSupabase();
  if (!sb) return { success: false, message: "Supabase não inicializado." };

  const pendingToken = localStorage.getItem('pending_invite_token');
  const pendingRoles = localStorage.getItem('pending_invite_roles');

  if (!pendingToken) return { success: false, message: "Nenhum convite pendente." };

  try {
    // 1. Validar o token de convite
    const { data: invite, error: inviteError } = await sb
      .from('invite_tokens')
      .select('*')
      .eq('token', pendingToken)
      .maybeSingle();

    if (
      inviteError ||
      !invite ||
      invite.used ||
      new Date() > new Date(invite.expires_at)
    ) {
      clearPendingInvite();
      return { success: false, message: "Convite inválido ou já usado." };
    }

    // 2. Obter usuário logado
    const { data: { user } } = await sb.auth.getUser();
    if (!user) {
      return { success: false, message: "Usuário não autenticado." };
    }

    // 3. Aguardar o trigger do Supabase criar o perfil (polling)
    let profile: Record<string, unknown> | null = null;
    for (let i = 0; i < 15; i++) {
      const { data } = await sb
        .from('profiles')
        .select('id, organization_id, allowed_ministries, is_admin')
        .eq('id', user.id)
        .maybeSingle();
      if (data) {
        profile = data;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    if (!profile) {
      clearPendingInvite();
      return { success: false, message: "Perfil não encontrado após registro." };
    }

    const roles: string[] = pendingRoles ? JSON.parse(pendingRoles) : [];

    // 4. Atualizar perfil com org e ministério do convite
    const { error: profileError } = await sb
      .from('profiles')
      .update({
        name: user.user_metadata?.full_name || user.user_metadata?.name || profile.name || 'Usuário',
        email: user.email,
        organization_id: invite.organization_id,
        ministry_id: invite.ministry_id,
        allowed_ministries: [invite.ministry_id],
        is_admin: false,
        is_super_admin: false,
      })
      .eq('id', user.id);

    if (profileError) {
      console.error('[processGoogleInviteAfterRedirect] Erro ao atualizar perfil:', profileError);
      clearPendingInvite();
      return { success: false, message: 'Erro ao configurar perfil: ' + profileError.message };
    }

    // 5. Vincular ao ministério (upsert para segurança)
    const { data: existingMember } = await sb
      .from('ministry_members')
      .select('id')
      .eq('profile_id', user.id)
      .eq('ministry_id', invite.ministry_id)
      .maybeSingle();

    if (existingMember) {
      await sb
        .from('ministry_members')
        .update({ role: 'member', functions: roles })
        .eq('id', existingMember.id);
    } else {
      const { error: memberError } = await sb.from('ministry_members').insert({
        profile_id: user.id,
        ministry_id: invite.ministry_id,
        role: 'member',
        functions: roles,
      });
      if (memberError) {
        console.error('[processGoogleInviteAfterRedirect] Erro ao vincular membro:', memberError);
        clearPendingInvite();
        return { success: false, message: 'Erro ao vincular ao ministério: ' + memberError.message };
      }
    }

    // 6. Marcar token como usado
    await sb
      .from('invite_tokens')
      .update({ used: true })
      .eq('token', pendingToken);

    // 7. Notificar super admins
    await notifySuperAdmins(
      'Novo Membro Registrado (Google)',
      `O usuário ${user.user_metadata?.full_name || user.email} se registrou via Google com convite.`,
      'members',
      invite.ministry_id,
      invite.organization_id,
    );

    // 8. Limpar localStorage
    clearPendingInvite();

    return { success: true };
  } catch (err: unknown) {
    console.error('[processGoogleInviteAfterRedirect] Erro crítico:', err);
    clearPendingInvite();
    return { success: false, message: err instanceof Error ? err.message : 'Erro desconhecido.' };
  }
};

/** Limpa dados de convite pendente do localStorage */
export const clearPendingInvite = () => {
  localStorage.removeItem('pending_invite_token');
  localStorage.removeItem('pending_invite_roles');
};

export const logout = async () => {
  const sb = getSupabase();
  if (!sb) return;
  try {
    await sb.auth.signOut();
  } catch (e) {
    // Mesmo com erro no signOut, limpar estado local
    console.warn("[logout] signOut error (safe to ignore):", e);
  }
};

export const updateUserProfile = async (
  name: string,
  whatsapp: string,
  avatar_url: string | undefined,
  ministry_functions: string[] | undefined,
  birthDate: string | undefined,
  ministryId: string,
  orgId: string,
) => {
  const sb = getSupabase();
  if (!sb) return;
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return;

  let finalAvatarUrl: string | undefined = undefined;

  if (avatar_url && avatar_url.startsWith("data:image")) {
    // Converter base64 para Blob e fazer upload no Storage
    const base64Data = avatar_url.split(",")[1];
    const mimeType = avatar_url.split(";")[0].split(":")[1];
    try {
      const byteCharacters = atob(base64Data);
      const byteArray = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteArray[i] = byteCharacters.charCodeAt(i);
      }
      const blob = new Blob([byteArray], { type: mimeType });
      // Using user.id as the folder name. This is the standard Supabase RLS pattern:
      // (storage.foldername(name))[1] == auth.uid()
      const fileName = `${user.id}/${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await sb.storage
        .from("avatars")
        .upload(fileName, blob, { upsert: true, contentType: "image/jpeg" });

      if (uploadError) {
        console.error("Avatar upload error:", uploadError);
        throw new Error(
          "Falha ao enviar arquivo para o Supabase: " + uploadError.message,
        );
      }

      if (uploadData) {
        const { data: urlData } = sb.storage
          .from("avatars")
          .getPublicUrl(fileName);
        finalAvatarUrl = urlData.publicUrl;
      }
    } catch (e) {
      console.error("Failed to decode avatar base64", e);
      throw new Error("Formato de imagem inválido.");
    }
  } else if (avatar_url && avatar_url.startsWith("http")) {
    finalAvatarUrl = avatar_url; // ja e uma URL publica, manter
  }

  const updates: any = { name, whatsapp, birth_date: birthDate };
  if (finalAvatarUrl) updates.avatar_url = finalAvatarUrl;
  await sb.from("profiles").update(updates).eq("id", user.id);

  if (ministry_functions && ministryId) {
    await sb
      .from("ministry_members")
      .update({ functions: ministry_functions })
      .eq("profile_id", user.id)
      .eq("ministry_id", ministryId);
  }
};

export const checkMemberLimit = async (
  ministryId: string,
  orgId: string,
  plan_type: string,
): Promise<{ allowed: boolean; reason?: string }> => {
  if (plan_type === "enterprise") return { allowed: true };
  const sb = getSupabase();
  if (!sb) return { allowed: false, reason: "Sem conexão" };
  const { count } = await sb
    .from("ministry_members")
    .select("id", { count: "exact", head: true })
    .eq("ministry_id", ministryId);

  if (plan_type === "trial" && (count || 0) >= 30) {
    return {
      allowed: false,
      reason:
        "O plano Trial permite no máximo 30 membros por ministério. Faça upgrade para Pro.",
    };
  }
  if (plan_type === "pro" && (count || 0) >= 50) {
    return {
      allowed: false,
      reason:
        "O plano Pro permite no máximo 50 membros por ministério. Faça upgrade para Enterprise.",
    };
  }
  return { allowed: true };
};

export const createInviteToken = async (
  ministryId: string,
  orgId: string,
  label?: string,
  userId?: string,
) => {
  const sb = getSupabase();
  if (!sb)
    return { success: false, message: "Erro: Supabase não inicializado." };

  try {
    let uId = userId;
    if (!uId) {
      const {
        data: { user },
      } = await sb.auth.getUser();
      uId = user?.id;
    }

    if (!uId) return { success: false, message: "Usuário não autenticado." };

    // Fallback robusto para randomUUID
    let token = "";
    try {
      if (typeof crypto !== "undefined" && crypto.randomUUID) {
        token = crypto.randomUUID();
      } else {
        token = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
          /[xy]/g,
          function (c) {
            const r = (Math.random() * 16) | 0,
              v = c === "x" ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          },
        );
      }
    } catch (e) {
      token =
        Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const payload = {
      token,
      organization_id: orgId,
      ministry_id: ministryId,
      created_by: uId,
      expires_at: expiresAt.toISOString(),
      used: false,
    };

    const { error } = await sb.from("invite_tokens").insert(payload);

    if (error) {
      console.error("[createInviteToken] Error inserting token:", error);
      return { success: false, message: error.message };
    }

    const url = `${window.location.origin}?invite=${token}`;
    return { success: true, url };
  } catch (err: any) {
    console.error("[createInviteToken] Critical error:", err);
    return {
      success: false,
      message: err.message || "Erro desconhecido ao gerar link.",
    };
  }
};

export const validateInviteToken = async (token: string) => {
  const sb = getSupabase();
  if (!sb) return { valid: false, message: "Erro de conexão com o servidor." };

  try {
    const { data: invite, error } = await sb.rpc("validate_invite", {
      p_token: token,
    });

    if (error) {
      const isNetworkError =
        error.message?.toLowerCase().includes("fetch") ||
        error.message?.toLowerCase().includes("network") ||
        !navigator.onLine;

      return {
        valid: false,
        message: isNetworkError
          ? "Erro de conexão. Verifique sua internet."
          : "Convite inválido ou expirado.",
        isNetworkError,
      };
    }

    if (!invite) {
      return { valid: false, message: "Convite inválido ou expirado." };
    }

    return {
      valid: true,
      data: {
        ministryId: invite.ministry_id,
        orgId: invite.organization_id,
        token: token,
        ministryName: invite.ministry_name,
        ministry_functions: invite.roles || invite.ministry_functions,
      },
    };
  } catch (e: any) {
    const isNetworkError =
      e.message?.toLowerCase().includes("fetch") ||
      e.message?.toLowerCase().includes("network") ||
      !navigator.onLine;

    return {
      valid: false,
      message: isNetworkError
        ? "Erro de conexão. Verifique sua internet."
        : "Erro ao validar convite.",
      isNetworkError,
    };
  }
};

export const registerWithInvite = async (token: string, userData: any) => {
  const sb = getSupabase();
  if (!sb) return { success: false };

  // Validar buscando o token diretamente
  const { data: invite, error: inviteError } = await sb
    .from("invite_tokens")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (
    inviteError ||
    !invite ||
    invite.used ||
    new Date() > new Date(invite.expires_at)
  ) {
    return { success: false, message: "Convite inválido ou já usado" };
  }

  const { data: authData, error: authError } = await (sb.auth as any).signUp({
    email: userData.email,
    password: userData.password,
    options: {
      data: {
        full_name: userData.name,
        ministry_id: invite.ministry_id,
        organization_id: invite.organization_id,
      },
    },
  });

  if (authError) {
    const isExisting =
      authError.message?.toLowerCase().includes("already registered") ||
      authError.message?.toLowerCase().includes("already exists");
    if (isExisting) {
      return {
        success: false,
        isExistingUser: true,
        message:
          "Este e-mail já possui uma conta. Faça login para entrar no ministério.",
        inviteData: {
          orgId: invite.organization_id,
          ministryId: invite.ministry_id,
          token,
        },
      };
    }
    return { success: false, message: authError.message };
  }
  const userId = authData.user?.id;
  if (!userId) return { success: false, message: "Erro ao criar usuário" };

  // Loga o usuário imediatamente para que as inserções subsequentes (RLS) funcionem
  const { error: signInError } = await sb.auth.signInWithPassword({
    email: userData.email,
    password: userData.password,
  });

  if (signInError) {
    console.warn("Erro ao fazer login após signUp:", signInError);
    // Não vamos falhar aqui, apenas alertar, pois se a confirmação de email
    // estiver habilitada e falhar o signIn, as rules vão falhar depois de qualquer jeito.
  }

  // Aguarda o trigger do Supabase Auth criar o perfil (polling)
  let profileExists = false;
  for (let i = 0; i < 10; i++) {
    const { data } = await sb
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    if (data) {
      profileExists = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  if (!profileExists) {
    console.warn(
      "[registerWithInvite] Perfil não encontrado após aguardar o trigger.",
    );
  }

  // Verifica se já existem membros no ministério para saber se este é o primeiro
  const { count: membersCount } = await sb
    .from("ministry_members")
    .select("id", { count: "exact", head: true })
    .eq("ministry_id", invite.ministry_id);

  const isFirstMember = membersCount === 0;

  // Usamos UPDATE (não upsert) para garantir que organization_id e demais campos
  // sejam gravados corretamente, sem o risco do onConflict ignorar a atualização.
  const { error: profileError } = await sb
    .from("profiles")
    .update({
      name: userData.name,
      email: userData.email,
      whatsapp: userData.whatsapp,
      birth_date: userData.birthDate,
      organization_id: invite.organization_id,
      ministry_id: invite.ministry_id,
      allowed_ministries: [invite.ministry_id],
      is_admin: isFirstMember,
      is_super_admin: false,
    })
    .eq("id", userId);

  if (profileError) {
    console.error(
      "[registerWithInvite] Erro ao atualizar perfil:",
      profileError,
    );
    return {
      success: false,
      message: "Erro ao configurar perfil: " + profileError.message,
    };
  }

  // Verifica se o vínculo já existe (caso algum trigger já tenha criado)
  const { data: existingMember } = await sb
    .from("ministry_members")
    .select("id")
    .eq("profile_id", userId)
    .eq("ministry_id", invite.ministry_id)
    .maybeSingle();

  let memberError = null;
  const functionsToSave = userData.roles || userData.ministry_functions || [];

  if (existingMember) {
    const { error } = await sb
      .from("ministry_members")
      .update({
        role: "member",
        functions: functionsToSave,
      })
      .eq("id", existingMember.id);
    memberError = error;
  } else {
    const { error } = await sb.from("ministry_members").insert({
      profile_id: userId,
      ministry_id: invite.ministry_id,
      role: "member",
      functions: functionsToSave,
    });
    memberError = error;
  }

  if (memberError) {
    console.error("[registerWithInvite] Erro ao vincular membro:", memberError);
    return {
      success: false,
      message: "Erro ao vincular ao ministério: " + memberError.message,
    };
  }

  // Marca o token como usado (used: true)
  const { error: tokenError } = await sb
    .from("invite_tokens")
    .update({ used: true })
    .eq("token", token);
  if (tokenError) {
    console.warn(
      "[registerWithInvite] Erro ao marcar token como usado:",
      tokenError,
    );
  }

  // Notify super admins about new member
  await notifySuperAdmins(
    "Novo Membro Registrado",
    `O usuário ${userData.name} acabou de se registrar via convite no sistema.`,
    "members",
    invite.ministry_id,
    invite.organization_id,
  );

  return { success: true };
};

export const registerNewOrganization = async (data: {
  name: string;
  email: string;
  password: string;
  whatsapp: string;
  churchName: string;
  slug: string;
  ministryName: string;
}) => {
  const sb = getSupabase();
  if (!sb)
    return { success: false, message: "Erro: Supabase não inicializado." };

  const { data: authData, error: authError } = await (sb.auth as any).signUp({
    email: data.email,
    password: data.password,
  });

  if (authError) return { success: false, message: authError.message };
  const userId = authData.user?.id;
  if (!userId) return { success: false, message: "Erro ao criar usuário" };

  const { error: rpcError } = await sb.rpc("setup_new_tenant", {
    p_user_id: userId,
    p_name: data.name,
    p_whatsapp: data.whatsapp,
    p_church_name: data.churchName,
    p_slug: data.slug,
  });

  if (rpcError) {
    await sb.auth.signOut();
    return { success: false, message: rpcError.message };
  }

  // Update ministry name
  try {
    const { data: profile } = await sb
      .from("profiles")
      .select("ministry_id, organization_id")
      .eq("id", userId)
      .single();
    if (profile?.ministry_id) {
      await sb
        .from("organization_ministries")
        .update({ label: data.ministryName })
        .eq("id", profile.ministry_id);
      await sb
        .from("ministry_settings")
        .update({ display_name: data.ministryName })
        .eq("ministry_id", profile.ministry_id);
    }
  } catch (nameUpdateError) {
    // Nao bloquear o cadastro por falha na atualizacao do nome
    console.warn(
      "[registerNewOrganization] Falha ao atualizar nome do ministerio:",
      nameUpdateError,
    );
  }

  // Notify super admins
  await notifySuperAdmins(
    "Nova Organização Criada",
    `A organização ${data.churchName} acabou de se cadastrar no sistema.`,
    "super-admin",
  );

  return { success: true, message: "Organização criada com sucesso!" };
};

export const uploadOrganizationLogo = async (
  orgId: string,
  file: File | null,
): Promise<string | null> => {
  const sb = getSupabase();
  if (!sb) {
    console.error("[uploadOrganizationLogo] No Supabase client");
    return null;
  }

  // Se o arquivo for nulo, remover a logo
  if (!file) {
    log("[uploadOrganizationLogo] Removing logo for org:", orgId);
    const { error: updateError } = await sb
      .from("organizations")
      .update({ logo_url: null })
      .eq("id", orgId);

    if (updateError) {
      console.error(
        "[uploadOrganizationLogo] Error removing logo from DB:",
        updateError,
      );
      return null;
    }
    return ""; // Retorna string vazia para indicar sucesso na remoção
  }

  const ext = file.name.split(".").pop() || "png";
  // Usando o prefixo 'avatars/' pois sabemos que o bucket 'avatars' tem políticas para esse prefixo
  const fileName = `avatars/logos/${orgId}_${Date.now()}.${ext}`;

  log("[uploadOrganizationLogo] Starting upload...", {
    fileName,
    type: file.type,
    size: file.size,
  });

  const { error: uploadError } = await sb.storage
    .from("avatars")
    .upload(fileName, file, {
      upsert: true,
      contentType: file.type || "image/png",
    });

  if (uploadError) {
    console.error("[uploadOrganizationLogo] Upload error:", uploadError);
    return null;
  }

  const { data } = sb.storage.from("avatars").getPublicUrl(fileName);
  const publicUrl = data.publicUrl + "?t=" + Date.now(); // cache bust

  log("[uploadOrganizationLogo] Upload successful, updating database...", {
    publicUrl,
  });

  const { error: updateError } = await sb
    .from("organizations")
    .update({ logo_url: publicUrl })
    .eq("id", orgId);

  if (updateError) {
    console.error(
      "[uploadOrganizationLogo] Database update error:",
      updateError,
    );
  }

  return publicUrl;
};
