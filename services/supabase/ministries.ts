import { getSupabase } from "./client";
import { Organization, MinistryDef, MinistrySettings } from "../../types";
import { notifySuperAdmins, sendNotificationSQL } from "./notifications";
import { logAuditAction } from "./audit";


export const fetchOrganizationDetails = async (
  orgId: string,
): Promise<Organization | null> => {
  const sb = getSupabase();
  if (!sb || !orgId) return null;

  const { data, error } = await sb
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .single();

  if (error) {
    console.error("Error fetching organization details:", error);
    return null;
  }
  return data;
};

export const fetchOrganizationMinistries = async (
  orgId?: string,
): Promise<MinistryDef[]> => {
  const sb = getSupabase();
  if (!sb || !orgId) return [];

  const { data, error } = await sb
    .from("organization_ministries")
    .select("id, code, label, enabled_tabs")
    .eq("organization_id", orgId);

  if (error) throw error;

  return (data || []).map((m: any) => ({
    id: m.id,
    code: m.code || m.id,
    label: m.label || "Sem nome",
    organizationId: orgId,
    enabledTabs: m.enabled_tabs,
  }));
};

export const saveEnabledTabs = async (
  ministryId: string,
  orgId: string,
  tabs: string[],
) => {
  const sb = getSupabase();
  if (!sb) return;

  // Buscar abas atuais para preservar itens com prefixo qa:
  const { data: min } = await sb
    .from("organization_ministries")
    .select("enabled_tabs")
    .eq("id", ministryId)
    .single();

  const currentTabs = min?.enabled_tabs || [];
  const qaTabs = currentTabs.filter((t: string) => t.startsWith("qa:"));

  // Sempre incluir abas de admin e essenciais na lista salva para nao perder acesso
  const ALWAYS_ENABLED = [
    "settings",
    "profile",
    "schedule-editor",
    "monthly-report",
    "report",
    "event-rules",
    "schedule-rules",
    "send-announcements",
    "members",
    "repertoire-manager",
  ];
  const fullTabs = [...new Set([...tabs, ...ALWAYS_ENABLED, ...qaTabs])];
  await sb
    .from("organization_ministries")
    .update({ enabled_tabs: fullTabs })
    .eq("id", ministryId)
    .eq("organization_id", orgId);
};

export const fetchUserAllowedMinistries = async (
  userId: string,
  orgId?: string,
): Promise<string[]> => {
  const sb = getSupabase();
  if (!sb || !orgId) return [];

  const { data: members, error } = await sb
    .from("ministry_members")
    .select("ministry_id")
    .eq("profile_id", userId);

  if (error) throw error;
  if (!members || members.length === 0) return [];

  const ministryIds = members.map((m: any) => m.ministry_id);

  const { data: validMinistries } = await sb
    .from("organization_ministries")
    .select("id")
    .eq("organization_id", orgId)
    .in("id", ministryIds);

  return validMinistries?.map((m: any) => m.id) || [];
};

export const fetchMinistrySettings = async (
  ministryId: string,
  orgId?: string,
): Promise<MinistrySettings | null> => {
  const sb = getSupabase();
  if (!sb || !ministryId || !orgId) return null;

  const { data: ministryDef } = await sb
    .from("organization_ministries")
    .select("label, availability_start, availability_end, enabled_tabs")
    .eq("id", ministryId)
    .eq("organization_id", orgId)
    .maybeSingle();

  const { data: settings } = await sb
    .from("ministry_settings")
    .select(
      "*, spotify_client_id, spotify_client_secret, youtube_api_key, qr_code_url, social_link_url, practical_guidelines",
    )
    .eq("ministry_id", ministryId)
    .eq("organization_id", orgId)
    .maybeSingle();

  // Extrair itens de acesso rápido das abas habilitadas (prefixo qa:)
  const quickAccessFromTabs =
    ministryDef?.enabled_tabs
      ?.filter((t: string) => t.startsWith("qa:"))
      ?.map((t: string) => t.replace("qa:", "")) || [];

  const validLabel =
    ministryDef?.label && ministryDef.label.trim() !== "Carregando..."
      ? ministryDef.label.trim()
      : null;
  const validDisplay =
    settings?.display_name && settings.display_name.trim() !== "Carregando..."
      ? settings.display_name.trim()
      : null;

  const result = {
    id: settings?.id,
    organizationMinistryId: ministryId,
    displayName: validLabel || validDisplay || "Ministério",
    roles: settings?.roles || [],
    availabilityStart: ministryDef?.availability_start,
    availabilityEnd: ministryDef?.availability_end,
    organizationId: orgId,
    spotifyClientId: settings?.spotify_client_id,
    spotifyClientSecret: settings?.spotify_client_secret,
    youtubeApiKey: settings?.youtube_api_key,
    practicalGuidelines: settings?.practical_guidelines,
    qrCodeUrl: settings?.qr_code_url,
    socialLinkUrl: settings?.social_link_url,
    quickAccessItems:
      quickAccessFromTabs.length > 0
        ? quickAccessFromTabs
        : (settings as any)?.quick_access_items,
  };

  return result;
};

export const joinMinistry = async (
  ministryId: string,
  orgId: string,
  roles: string[],
  isInvite: boolean = false,
) => {
  const sb = getSupabase();
  if (!sb) return;
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return;

  // Check if user is super admin or org admin
  const { data: profile } = await sb
    .from("profiles")
    .select(
      "id, is_super_admin, is_admin, name, email, allowed_ministries, organization_id",
    )
    .eq("id", user.id)
    .maybeSingle();

  const isSuperAdmin = profile?.is_super_admin || false;
  const isOrgAdmin = profile?.is_admin || false;
  const canJoinDirectly =
    isSuperAdmin ||
    (isOrgAdmin && profile?.organization_id === orgId) ||
    isInvite;

  // Fetch ministry label to avoid leaking ID in notification
  const { data: minData } = await sb
    .from("organization_ministries")
    .select("label")
    .eq("id", ministryId)
    .maybeSingle();
  const ministryName = minData?.label || "Ministério";

  if (canJoinDirectly) {
    // Check if it's the first member, so we make them admin
    const { count: membersCount } = await sb
      .from("ministry_members")
      .select("id", { count: "exact", head: true })
      .eq("ministry_id", ministryId);

    // Admin setup for first user joined via invite
    if (isInvite && membersCount === 0 && profile) {
      await sb.from("profiles").update({ is_admin: true }).eq("id", user.id);
    }

    // Direct Entry
    const { error: joinError } = await sb.from("ministry_members").upsert(
      {
        ministry_id: ministryId,
        profile_id: user.id,
        role: "member",
        functions: roles,
      },
      { onConflict: "ministry_id, profile_id" },
    );

    if (joinError) {
      console.error("[joinMinistry] Error joining directly:", joinError);
      throw joinError;
    }

    if (profile) {
      const allowed = new Set(profile.allowed_ministries || []);
      allowed.add(ministryId);
      await sb
        .from("profiles")
        .update({ allowed_ministries: Array.from(allowed) })
        .eq("id", user.id);
    }

    const directName =
      profile?.name?.trim() ||
      user.user_metadata?.full_name?.trim() ||
      user.user_metadata?.name?.trim() ||
      user.email?.split("@")[0] ||
      user.email ||
      "Novo Integrante";

    await notifySuperAdmins(
      "Novo Integrante (Entrada Direta)",
      `O usuário ${directName} entrou diretamente no ministério ${ministryName}.`,
      "members",
      ministryId,
      orgId,
      "info",
      user.id,
    );
  } else {
    // Regular user: Create a join request via weight notifications
    const cleanName =
      profile?.name?.trim() ||
      user.user_metadata?.full_name?.trim() ||
      user.user_metadata?.name?.trim() ||
      user.email?.split("@")[0] ||
      user.email ||
      "Novo Integrante";
    const userEmail = profile?.email || user.email || "";

    const actionData = JSON.stringify({
      userId: user.id,
      userName: cleanName,
      userEmail,
      roles: roles || [],
    });

    const response = await notifySuperAdmins(
      "Solicitação de Entrada",
      `O usuário ${cleanName} solicitou entrada no ministério ${ministryName}.\n[DADOS_SOLICITACAO:${actionData}]`,
      actionData,
      ministryId,
      orgId,
      "join_request",
      user.id,
    );

    if (response?.error) {
      console.error(
        "[joinMinistry] Error sending join request:",
        response.error,
      );
      throw new Error(
        "Não foi possível enviar a solicitação. Tente novamente.",
      );
    }
  }
};

export const approveJoinRequest = async (
  notificationId: string,
  userId: string,
  ministryId: string,
  orgId: string,
  roles: string[],
) => {
  const sb = getSupabase();
  if (!sb) return;

  // 1. Add to ministry_members (upsert to be safe)
  const { error: memberError } = await sb.from("ministry_members").upsert(
    {
      ministry_id: ministryId,
      profile_id: userId,
      role: "member",
      functions: roles,
    },
    { onConflict: "ministry_id, profile_id" },
  );

  if (memberError) throw memberError;

  // 2. Update allowed_ministries in profile
  const { data: profile } = await sb
    .from("profiles")
    .select("allowed_ministries")
    .eq("id", userId)
    .single();
  if (profile) {
    const allowed = new Set(profile.allowed_ministries || []);
    allowed.add(ministryId);
    await sb
      .from("profiles")
      .update({ allowed_ministries: Array.from(allowed) })
      .eq("id", userId);
  }

  // 3. Mark notification as read/cleared or delete it
  await sb.from("notifications").delete().eq("id", notificationId);

  // 4. Notify user (optional, but good practice via resilient sender)
  await sendNotificationSQL(ministryId, orgId, {
    title: "Solicitação Aprovada",
    message: "Sua solicitação para entrar no ministério foi aprovada!",
    type: "success",
    targetUserId: userId,
    actionLink: "dashboard",
  });

  // 5. Audit log
  void logAuditAction({
    ministryId,
    orgId,
    action: 'join_request_approved',
    targetType: 'member',
    targetId: userId,
  });
};

export const rejectJoinRequest = async (
  notificationId: string,
  orgId: string,
  ministryId: string,
  userId: string,
) => {
  const sb = getSupabase();
  if (!sb) return;

  // 1. Delete the request notification
  await sb.from("notifications").delete().eq("id", notificationId);

  // 2. Notify user via resilient sender
  await sendNotificationSQL(ministryId, orgId, {
    title: "Solicitação Recusada",
    message:
      "Sua solicitação para entrar no ministério foi recusada pelos administradores.",
    type: "error",
    targetUserId: userId,
    actionLink: "dashboard",
  });

  // 3. Audit log
  void logAuditAction({
    ministryId,
    orgId,
    action: 'join_request_rejected',
    targetType: 'member',
    targetId: userId,
  });
};

export const saveMinistrySettings = async (
  ministryId: string,
  orgId: string,
  displayName?: string,
  roles?: string[],
  start?: string,
  end?: string,
  spotifyClientId?: string,
  spotifyClientSecret?: string,
  youtubeApiKey?: string,
  qrCodeUrl?: string,
  socialLinkUrl?: string,
  quickAccessItems?: string[],
  practicalGuidelines?: string,
) => {
  const sb = getSupabase();
  if (!sb) return;

  const updates: any = {};
  const cleanDisplayName = displayName?.trim();
  if (cleanDisplayName && cleanDisplayName !== "Carregando...") {
    updates.display_name = cleanDisplayName;
  }
  if (roles !== undefined) updates.roles = roles;
  if (spotifyClientId !== undefined)
    updates.spotify_client_id = spotifyClientId;
  if (spotifyClientSecret !== undefined)
    updates.spotify_client_secret = spotifyClientSecret;
  if (youtubeApiKey !== undefined) updates.youtube_api_key = youtubeApiKey;
  if (qrCodeUrl !== undefined) updates.qr_code_url = qrCodeUrl;
  if (socialLinkUrl !== undefined) updates.social_link_url = socialLinkUrl;
  if (practicalGuidelines !== undefined)
    updates.practical_guidelines = practicalGuidelines;
  if (Object.keys(updates).length > 0) {
    const { error } = await sb.from("ministry_settings").upsert(
      {
        organization_id: orgId,
        ministry_id: ministryId,
        ...updates,
      },
      { onConflict: "ministry_id,organization_id" },
    );
    if (error) {
      console.error("[saveMinistrySettings] Erro ao salvar settings:", error);
    }
  }

  // Atualizar também o label em organization_ministries para sincronização global
  if (cleanDisplayName && cleanDisplayName !== "Carregando...") {
    const { error: minErr } = await sb
      .from("organization_ministries")
      .update({ label: cleanDisplayName })
      .eq("id", ministryId)
      .eq("organization_id", orgId);
    if (minErr) {
      console.warn("[saveMinistrySettings] Erro ao atualizar organization_ministries label:", minErr);
    }
  }

  if (quickAccessItems !== undefined) {
    // Buscar abas atuais para não sobrescrever
    const { data: min } = await sb
      .from("organization_ministries")
      .select("enabled_tabs")
      .eq("id", ministryId)
      .single();

    const currentTabs = min?.enabled_tabs || [];
    const cleanTabs = currentTabs.filter((t: string) => !t.startsWith("qa:"));
    const newQaTabs = quickAccessItems.map((item) => `qa:${item}`);
    const finalTabs = [...cleanTabs, ...newQaTabs];

    await sb
      .from("organization_ministries")
      .update({ enabled_tabs: finalTabs })
      .eq("id", ministryId)
      .eq("organization_id", orgId);
  }

  if (start !== undefined || end !== undefined || displayName !== undefined) {
    const minUpdates: any = {};
    if (start !== undefined) minUpdates.availability_start = start;
    if (end !== undefined) minUpdates.availability_end = end;
    if (displayName !== undefined) minUpdates.label = displayName;

    await sb
      .from("organization_ministries")
      .update(minUpdates)
      .eq("id", ministryId)
      .eq("organization_id", orgId);
  }
};
