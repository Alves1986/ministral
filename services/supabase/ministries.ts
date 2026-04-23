import { getSupabase } from './client';
import { Organization, MinistryDef, MinistrySettings } from '../../types';
import { notifySuperAdmins } from './notifications';

export const fetchOrganizationDetails = async (orgId: string): Promise<Organization | null> => {
    const sb = getSupabase();
    if (!sb || !orgId) return null;

    const { data, error } = await sb
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .single();

    if (error) {
        console.error("Error fetching organization details:", error);
        return null;
    }
    return data;
};

export const fetchOrganizationMinistries = async (orgId?: string): Promise<MinistryDef[]> => {
    const sb = getSupabase();
    if (!sb || !orgId) return [];

    const { data, error } = await sb
        .from('organization_ministries')
        .select('id, code, label, enabled_tabs') 
        .eq('organization_id', orgId);

    if (error) {
        throw error;
    }

    return (data || []).map((m: any) => ({
        id: m.id,
        code: m.code || m.id,
        label: m.label || 'Sem nome', 
        organizationId: orgId,
        enabledTabs: m.enabled_tabs
    }));
};

export const saveEnabledTabs = async (ministryId: string, orgId: string, tabs: string[]) => {
    const sb = getSupabase();
    if (!sb) return;
    // Sempre incluir abas de admin e essenciais na lista salva para nao perder acesso
    const ALWAYS_ENABLED = [
        'settings', 'profile', 'history',
        'schedule-editor','monthly-report','report','event-rules',
        'schedule-rules','send-announcements','members','repertoire-manager'
    ];
    const fullTabs = [...new Set([...tabs, ...ALWAYS_ENABLED])];
    await sb.from('organization_ministries')
        .update({ enabled_tabs: fullTabs })
        .eq('id', ministryId)
        .eq('organization_id', orgId);
};

export const fetchUserAllowedMinistries = async (userId: string, orgId?: string): Promise<string[]> => {
    const sb = getSupabase();
    if (!sb || !orgId) return [];
    
    const { data: members, error } = await sb.from('ministry_members')
        .select('ministry_id')
        .eq('profile_id', userId);
        
    if (error) throw error;
    if (!members || members.length === 0) return [];

    const ministryIds = members.map((m: any) => m.ministry_id);

    const { data: validMinistries } = await sb.from('organization_ministries')
        .select('id')
        .eq('organization_id', orgId)
        .in('id', ministryIds);

    return validMinistries?.map((m: any) => m.id) || [];
};

export const fetchMinistrySettings = async (ministryId: string, orgId?: string): Promise<MinistrySettings | null> => {
    const sb = getSupabase();
    if (!sb || !ministryId || !orgId) return null;

    const { data: ministryDef } = await sb.from('organization_ministries')
        .select('label, availability_start, availability_end, enabled_tabs') 
        .eq('id', ministryId)
        .eq('organization_id', orgId)
        .maybeSingle();

    const { data: settings } = await sb.from('ministry_settings')
        .select('*, spotify_client_id, spotify_client_secret, youtube_api_key, qr_code_url, social_link_url')
        .eq('ministry_id', ministryId)
        .eq('organization_id', orgId)
        .maybeSingle();
    
    // Extrair itens de acesso rápido das abas habilitadas (prefixo qa:)
    const quickAccessFromTabs = ministryDef?.enabled_tabs
        ?.filter((t: string) => t.startsWith('qa:'))
        ?.map((t: string) => t.replace('qa:', '')) || [];

    const result = {
        id: settings?.id,
        organizationMinistryId: ministryId, 
        displayName: ministryDef?.label || settings?.display_name || 'Ministério',
        roles: settings?.roles || [],
        availabilityStart: ministryDef?.availability_start,
        availabilityEnd: ministryDef?.availability_end,
        organizationId: orgId,
        spotifyClientId: settings?.spotify_client_id,
        spotifyClientSecret: settings?.spotify_client_secret,
        youtubeApiKey: settings?.youtube_api_key,
        qrCodeUrl:     settings?.qr_code_url,
        socialLinkUrl: settings?.social_link_url,
        quickAccessItems: quickAccessFromTabs.length > 0 ? quickAccessFromTabs : (settings as any)?.quick_access_items,
    };

    return result;
};

export const joinMinistry = async (ministryId: string, orgId: string, roles: string[]) => {
    const sb = getSupabase();
    if (!sb) return;
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;

    // Check if user is super admin or org admin
    const { data: profile } = await sb.from('profiles')
        .select('id, is_super_admin, is_admin, name, allowed_ministries, organization_id')
        .eq('id', user.id)
        .maybeSingle();
    
    const isSuperAdmin = profile?.is_super_admin || false;
    const isOrgAdmin = profile?.is_admin || false;
    const canJoinDirectly = isSuperAdmin || (isOrgAdmin && profile?.organization_id === orgId);

    // Fetch ministry label to avoid leaking ID in notification
    const { data: minData } = await sb.from('organization_ministries').select('label').eq('id', ministryId).maybeSingle();
    const ministryName = minData?.label || 'Ministério';

    if (canJoinDirectly) {
        // Direct Entry
        const { error: joinError } = await sb.from('ministry_members').upsert({
            ministry_id: ministryId,
            profile_id: user.id,
            role: 'member',
            functions: roles
        }, { onConflict: 'ministry_id, profile_id' });

        if (joinError) {
            console.error("[joinMinistry] Error joining directly:", joinError);
            throw joinError;
        }
        
        if (profile) {
            const allowed = new Set(profile.allowed_ministries || []);
            allowed.add(ministryId);
            await sb.from('profiles').update({ allowed_ministries: Array.from(allowed) })
                .eq('id', user.id);
        }

        await notifySuperAdmins(
            'Novo Integrante (Entrada Direta)',
            `O usuário ${profile?.name || user.email} entrou diretamente no ministério ${ministryName}.`,
            'members',
            ministryId,
            orgId
        );
    } else {
        // Regular user: Create a join request via weight notifications
        const userName = profile?.name || user.user_metadata?.full_name || user.email;
        const actionData = JSON.stringify({
            userId: user.id,
            userName,
            roles: roles || []
        });

        const response = await notifySuperAdmins(
            'Solicitação de Entrada',
            `O usuário ${userName} solicitou entrada no ministério ${ministryName}.`,
            actionData,
            ministryId,
            orgId,
            'join_request'
        );

        if (response?.error) {
            console.error("[joinMinistry] Error sending join request:", response.error);
            throw new Error("Não foi possível enviar a solicitação. Tente novamente.");
        }
    }
};

export const approveJoinRequest = async (notificationId: string, userId: string, ministryId: string, orgId: string, roles: string[]) => {
    const sb = getSupabase();
    if (!sb) return;

    // 1. Add to ministry_members (upsert to be safe)
    const { error: memberError } = await sb.from('ministry_members').upsert({
        ministry_id: ministryId,
        profile_id: userId,
        role: 'member',
        functions: roles
    }, { onConflict: 'ministry_id, profile_id' });

    if (memberError) throw memberError;

    // 2. Update allowed_ministries in profile
    const { data: profile } = await sb.from('profiles').select('allowed_ministries').eq('id', userId).single();
    if (profile) {
        const allowed = new Set(profile.allowed_ministries || []);
        allowed.add(ministryId);
        await sb.from('profiles').update({ allowed_ministries: Array.from(allowed) })
            .eq('id', userId);
    }

    // 3. Mark notification as read/cleared or delete it
    await sb.from('notifications').delete().eq('id', notificationId);

    // 4. Notify user (optional, but good practice)
    await sb.from('notifications').insert({
        organization_id: orgId,
        ministry_id: ministryId,
        title: 'Solicitação Aprovada',
        message: 'Sua solicitação para entrar no ministério foi aprovada!',
        type: 'success',
        target_user_id: userId,
        action_link: 'dashboard'
    });
};

export const rejectJoinRequest = async (notificationId: string, orgId: string, ministryId: string, userId: string) => {
    const sb = getSupabase();
    if (!sb) return;

    // 1. Delete the request notification
    await sb.from('notifications').delete().eq('id', notificationId);

    // 2. Notify user
    await sb.from('notifications').insert({
        organization_id: orgId,
        ministry_id: ministryId,
        title: 'Solicitação Recusada',
        message: 'Sua solicitação para entrar no ministério foi recusada pelos administradores.',
        type: 'error',
        target_user_id: userId,
        action_link: 'dashboard'
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
    quickAccessItems?: string[]
) => {
    const sb = getSupabase();
    if (!sb) return;
    
    const updates: any = {};
    if (displayName !== undefined) updates.display_name = displayName;
    if (roles !== undefined) updates.roles = roles;
    if (spotifyClientId !== undefined) updates.spotify_client_id = spotifyClientId;
    if (spotifyClientSecret !== undefined) updates.spotify_client_secret = spotifyClientSecret;
    if (youtubeApiKey !== undefined) updates.youtube_api_key = youtubeApiKey;
    if (qrCodeUrl     !== undefined) updates.qr_code_url     = qrCodeUrl;
    if (socialLinkUrl !== undefined) updates.social_link_url = socialLinkUrl;
    if (Object.keys(updates).length > 0) {
        const { error } = await sb.from('ministry_settings').upsert({
            organization_id: orgId,
            ministry_id: ministryId,
            ...updates
        }, { onConflict: 'ministry_id,organization_id' });
        if (error) {
            console.error('[saveMinistrySettings] Erro ao salvar settings:', error);
        }
    }

    if (quickAccessItems !== undefined) {
        // Buscar abas atuais para não sobrescrever
        const { data: min } = await sb.from('organization_ministries')
            .select('enabled_tabs')
            .eq('id', ministryId)
            .single();
        
        const currentTabs = min?.enabled_tabs || [];
        const cleanTabs = currentTabs.filter((t: string) => !t.startsWith('qa:'));
        const newQaTabs = quickAccessItems.map(item => `qa:${item}`);
        const finalTabs = [...cleanTabs, ...newQaTabs];

        await sb.from('organization_ministries')
            .update({ enabled_tabs: finalTabs })
            .eq('id', ministryId)
            .eq('organization_id', orgId);
    }
    
    if (start !== undefined || end !== undefined || displayName !== undefined) {
        const minUpdates: any = {};
        if (start !== undefined) minUpdates.availability_start = start;
        if (end !== undefined) minUpdates.availability_end = end;
        if (displayName !== undefined) minUpdates.label = displayName;
        
        await sb.from('organization_ministries')
            .update(minUpdates)
            .eq('id', ministryId)
            .eq('organization_id', orgId);
    }
};
