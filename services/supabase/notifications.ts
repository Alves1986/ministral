import { getSupabase } from './client';

export const fetchNotificationsSQL = async (ministryIds: string[], userId: string, orgId: string, isAdmin: boolean = false) => {
    const sb = getSupabase();
    if (!sb) return [];
    
    let query = sb.from('notifications')
        .select('*, organization_ministries(label)')
        .eq('organization_id', orgId);
    
    // Se não for admin, filtramos apenas pelos ministérios aos quais o usuário tem acesso ou notificações direcionadas a ele
    if (!isAdmin) {
        const ids = ministryIds.length > 0 ? ministryIds.join(',') : 'null';
        query = query.or(`ministry_id.in.(${ids}),target_user_id.eq.${userId}`);
    }
    
    const { data: globalNotifs, error: fetchError } = await query
        .order('created_at', { ascending: false })
        .limit(30);
    
    // Fallback para erro de cache de schema
    if (fetchError && (fetchError.code === 'PGRST204' || fetchError.message?.includes('action_link'))) {
        console.warn("[Notifications] Schema cache error on global fetch, retrying basic.");
        const { data: retryNotifs } = await sb.from('notifications')
            .select('id, title, message, type, created_at, ministry_id, organization_id, action_link')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false })
            .limit(30);
        
        // Se falhar de novo, deixa o erro subir ou retorna vazio para não quebrar o app
        if (!retryNotifs) return [];
        
        // Mapeamento simplificado para o fallback
        return retryNotifs.map(n => ({
            id: n.id,
            ministryId: n.ministry_id,
            ministryName: 'Aviso',
            organizationId: n.organization_id,
            title: n.title,
            message: n.message,
            type: n.type,
            timestamp: n.created_at,
            read: false,
            actionLink: (n as any).action_link || 'announcements'
        }));
    }
        
    const { data: reads } = await sb.from('notification_reads')
        .select('notification_id')
        .eq('user_id', userId);
        
    // Tenta buscar do banco, mas falha silenciosamente se a tabela não existir
    let dbClears: any[] = [];
    try {
        const { data } = await sb.from('notification_clears')
            .select('notification_id')
            .eq('user_id', userId);
        dbClears = data || [];
    } catch (e) {
        console.warn("[Notifications] Tabela notification_clears não encontrada ou erro ao buscar.");
    }
        
    // Sincroniza com LocalStorage para garantir que notificações limpas não "voltem" por delay do banco
    let localClears: string[] = [];
    try {
        const key = `notif_clears_${userId}`;
        localClears = JSON.parse(localStorage.getItem(key) || '[]');
        if (!Array.isArray(localClears)) localClears = [];
    } catch (e) {
        localClears = [];
    }

    const readSet = new Set(reads?.map((r: any) => r.notification_id));
    const clearSet = new Set([...dbClears.map((c: any) => c.notification_id), ...localClears]);
    
    return (globalNotifs || [])
        .filter((n: any) => !clearSet.has(n.id))
        .map((n: any) => {
            const m = Array.isArray(n.organization_ministries) ? n.organization_ministries[0] : n.organization_ministries;
            return {
                id: n.id,
                ministryId: n.ministry_id,
                ministryName: m?.label,
                organizationId: n.organization_id,
                title: n.title,
                message: n.message,
                type: n.type,
                timestamp: n.created_at,
                read: readSet.has(n.id),
                actionLink: n.action_link
            };
        });
};

// Helper para limpar HTML de mensagens que devem ser apenas texto (notificações)
const stripHtml = (html: string) => {
    return (html || "")
        .replace(/<br\s*\/?>/gi, '\n') // Preserva quebras de linha básicas
        .replace(/<[^>]*>?/gm, ' ')   // Remove outras tags
        .replace(/[ ]+/g, ' ')         // Remove espaços duplos
        .trim();
};

export const sendNotificationSQL = async (ministryId: string, orgId: string, notification: any) => {
    const sb = getSupabase();
    if (!sb) return;
    
    // Limpa HTML para notificações (sempre texto simples)
    const cleanMessage = stripHtml(notification.message);

    const payload: any = {
        organization_id: orgId,
        ministry_id: ministryId,
        title: notification.title,
        message: cleanMessage,
        type: notification.type,
        action_link: notification.actionLink
    };

    const { error } = await sb.from('notifications').insert(payload);
    
    if (error) {
        console.error("[Notifications] Error sending notification:", error);
        
        // Fallback: Se a coluna action_link não existir ou erro de cache de schema
        const isMissingColumn = error.code === 'PGRST204' || 
                               error.message?.includes('action_link') || 
                               error.message?.includes('não existe');

        if (isMissingColumn) {
            console.warn("[Notifications] action_link column issue, retrying without it.");
            delete payload.action_link;
            const { error: retryError } = await sb.from('notifications').insert(payload);
            if (retryError) throw retryError;
        } else {
            throw error;
        }
    }
};

export const markNotificationsReadSQL = async (ids: string[], userId: string, orgId: string) => {
    const sb = getSupabase();
    if (!sb) return;
    
    const inserts = ids.map(id => ({
        user_id: userId,
        notification_id: id,
        organization_id: orgId
    }));
    
    await sb.from('notification_reads').upsert(inserts, { onConflict: 'user_id, notification_id' });
};

export const clearNotificationsSQL = async (ids: string[], userId: string, orgId: string) => {
    const sb = getSupabase();
    if (!sb) return;
    
    // Salva no LocalStorage imediatamente para persistência local instantânea
    try {
        const key = `notif_clears_${userId}`;
        const current = JSON.parse(localStorage.getItem(key) || '[]');
        const next = [...new Set([...(Array.isArray(current) ? current : []), ...ids])];
        localStorage.setItem(key, JSON.stringify(next));
    } catch (e) {
        console.error("[Notifications] Erro ao salvar no LocalStorage:", e);
    }

    const inserts = ids.map(id => ({
        user_id: userId,
        notification_id: id,
        organization_id: orgId
    }));
    
    // Fallback útil: marca como lida também. Se a tabela notification_clears 
    // falhar ou não existir no ambiente do usuário, pelo menos o outro dispositivo
    // não mostrará como "não lida" (pontinho vermelho).
    try {
        await sb.from('notification_reads').upsert(inserts, { onConflict: 'user_id, notification_id' });
    } catch (e) {
        // ignora silenciosamente
    }
    
    try {
        await sb.from('notification_clears').upsert(inserts, { onConflict: 'user_id, notification_id' });
    } catch (e) {
        console.error("[Notifications] Erro ao persistir limpeza no banco:", e);
    }
};

export const clearAllNotificationsSQL = async (
  ministryId: string, 
  orgId: string,
  userId: string
) => {
    const sb = getSupabase();
    if (!sb) return;

    const { data: notifs } = await sb.from('notifications')
        .select('id')
        .eq('ministry_id', ministryId)
        .eq('organization_id', orgId);
        
    if (!notifs || notifs.length === 0) return;
    
    const ids = notifs.map(n => n.id);
    
    // Salva no LocalStorage IMEDIATAMENTE (antes de qualquer await longo)
    try {
        const key = `notif_clears_${userId}`;
        const current = JSON.parse(localStorage.getItem(key) || '[]');
        const next = [...new Set([...(Array.isArray(current) ? current : []), ...ids])];
        localStorage.setItem(key, JSON.stringify(next));
    } catch (e) {
        console.error("[Notifications] Erro ao salvar no LocalStorage:", e);
    }

    const inserts = ids.map(id => ({
        user_id: userId,
        notification_id: id,
        organization_id: orgId
    }));
    
    try {
        await sb.from('notification_reads').upsert(inserts, { onConflict: 'user_id, notification_id' });
    } catch (e) {}

    try {
        await sb.from('notification_clears').upsert(inserts, { onConflict: 'user_id, notification_id' });
    } catch (e) {
        console.error("[Notifications] Erro ao persistir limpeza total no banco:", e);
    }
};

export const notifySuperAdmins = async (title: string, message: string, actionLink?: string, targetMinistryId?: string, orgId?: string, type: string = 'info') => {
    const sb = getSupabase();
    if (!sb) return;

    // Buscamos administradores da organização alvo (ou super admins globais se orgId for nulo)
    let query = sb
      .from('profiles')
      .select('id, organization_id')
      .or(`is_super_admin.eq.true${orgId ? `,and(is_admin.eq.true,organization_id.eq.${orgId})` : ''}`)
      .not('organization_id', 'is', null);

    const { data: admins } = await query;
    
    // Também buscamos administradores específicos deste ministério se targetMinistryId for fornecido
    let ministryAdmins: any[] = [];
    if (targetMinistryId) {
        const { data: mAdmins } = await sb.from('ministry_members')
            .select('profile_id')
            .eq('ministry_id', targetMinistryId)
            .eq('role', 'admin');
        if (mAdmins) {
            ministryAdmins = mAdmins.map(ma => ({ id: ma.profile_id, organization_id: orgId }));
        }
    }

    const allAdmins = [...(admins || []), ...ministryAdmins];
    // Remover duplicatas por ID de administrador
    const uniqueAdmins = Array.from(new Map(allAdmins.map(a => [a.id, a])).values());

    if (!uniqueAdmins.length) return;

    // Mapa para rastrear combinações únicas de (orgId, minId)
    const targetMap = new Map<string, { orgId: string, minId: string }>();

    for (const admin of uniqueAdmins) {
        let minId = targetMinistryId;
        let oId = orgId || admin.organization_id;
        
        if (!minId) {
            // Se não houver ministério alvo, buscamos o primeiro ministério da conta do admin
            const { data: ministries } = await sb
              .from('organization_ministries')
              .select('id')
              .eq('organization_id', admin.organization_id)
              .limit(1);
            
            minId = ministries?.[0]?.id;
            oId = admin.organization_id;
        }

        if (minId && oId) {
            targetMap.set(`${oId}|${minId}`, { orgId: oId, minId });
        }
    }

    const notificationsToInsert: any[] = [];

    for (const [key, target] of targetMap.entries()) {
        const { orgId: tOrgId, minId: tMinId } = target;

        // Busca o label para a mensagem
        const { data: m } = await sb
          .from('organization_ministries')
          .select('label')
          .eq('id', tMinId)
          .maybeSingle();
        
        const displayLabel = m?.label || 'Ministério';
        const cleanRawMessage = stripHtml(message);
        const finalMessage = displayLabel ? `${cleanRawMessage} (Ministério: ${displayLabel})` : cleanRawMessage;

        notificationsToInsert.push({
            organization_id: tOrgId,
            ministry_id: tMinId,
            title,
            message: finalMessage,
            type,
            action_link: actionLink || 'super-admin'
        });
    }

    if (notificationsToInsert.length > 0) {
        // Inserção em lote
        return await sb.from('notifications').insert(notificationsToInsert);
    }
    return { data: null, error: null };
};

export const createAnnouncementSQL = async (ministryId: string, orgId: string, announcement: any, authorName: string) => {
    const sb = getSupabase();
    if (!sb) return;

    const payload: any = {
        organization_id: orgId,
        ministry_id: ministryId,
        title: announcement.title,
        message: announcement.message,
        type: announcement.type,
        expiration_date: announcement.expirationDate,
        author_name: authorName,
        external_link: announcement.externalLink,
        is_pinned: announcement.isPinned || false
    };

    const { error } = await sb.from('announcements').insert(payload);

    if (error) {
        console.error("[Notifications] Error creating announcement:", error);
        
        // Fallback: Se falhar por causa do external_link ou is_pinned (coluna inexistente ou cache de schema)
        const isMissingColumn = error.code === 'PGRST204' || 
                               error.message?.includes('external_link') || 
                               error.message?.includes('is_pinned') ||
                               error.message?.includes('não existe');

        if (isMissingColumn) {
             console.warn("[Notifications] Column 'external_link' or 'is_pinned' issue. Baking link into message.");
             
             let bakedMessage = announcement.message;
             if (announcement.externalLink) {
                 bakedMessage += `\n\n${announcement.externalLink}`;
             }

             const { error: retryError } = await sb.from('announcements').insert({
                organization_id: orgId,
                ministry_id: ministryId,
                title: announcement.title,
                message: bakedMessage,
                type: announcement.type,
                expiration_date: announcement.expirationDate,
                author_name: authorName
            });
            if (retryError) throw retryError;
        } else {
            throw error;
        }
    }
};

export const fetchAnnouncementsSQL = async (ministryId: string, orgId?: string) => {
    const sb = getSupabase();
    if (!sb || !orgId) throw new Error("Missing dependencies");

    const now = new Date().toISOString();

    const { data: announcements, error } = await sb.from('announcements')
        .select('*')
        .eq('ministry_id', ministryId)
        .eq('organization_id', orgId)
        .or(`expiration_date.is.null,expiration_date.gte.${now}`)
        .order('created_at', { ascending: false });

    if (error) {
        // Se falhar por cache de schema (PGRST204) ou coluna faltando, tenta o básico
        const isSchemaError = error.code === 'PGRST204' || error.message?.includes('external_link') || error.message?.includes('is_pinned');
        if (isSchemaError) {
            console.warn("[Notifications] Schema cache error on fetch, retrying with basic columns.");
            const { data: retryData, error: retryError } = await sb.from('announcements')
                .select('id, title, message, type, created_at, expiration_date, author_name')
                .eq('ministry_id', ministryId)
                .eq('organization_id', orgId)
                .or(`expiration_date.is.null,expiration_date.gte.${now}`)
                .order('created_at', { ascending: false });
            
            if (retryError) throw retryError;
            return (retryData || []).map((a: any) => ({
                id: a.id,
                title: a.title,
                message: a.message,
                type: a.type,
                timestamp: a.created_at,
                expirationDate: a.expiration_date,
                author: a.author_name || 'Admin',
                isPinned: false,
                readBy: [],
                likedBy: []
            }));
        }
        throw error;
    }

    if (!announcements || announcements.length === 0) return [];

    const announcementIds = announcements.map((a: any) => a.id);
    
    const { data: interactions, error: intError } = await sb.from('announcement_interactions')
        .select('announcement_id, user_id, interaction_type, created_at, profiles(name)')
        .in('announcement_id', announcementIds)
        .eq('organization_id', orgId);

    if (intError) console.error("ANN INTERACTIONS FETCH ERROR", intError);

    return announcements.map((a: any) => {
        const myInteractions = interactions ? interactions.filter((i: any) => i.announcement_id === a.id) : [];
        
        return {
            id: a.id,
            title: a.title,
            message: a.message,
            type: a.type,
            timestamp: a.created_at,
            expirationDate: a.expiration_date,
            author: a.author_name || 'Admin',
            externalLink: a.external_link,
            isPinned: a.is_pinned || false,
            readBy: myInteractions
                .filter((i: any) => i.interaction_type === 'read')
                .map((i: any) => ({
                    userId: i.user_id,
                    name: i.profiles?.name || 'Usuário',
                    timestamp: i.created_at
                })),
            likedBy: myInteractions
                .filter((i: any) => i.interaction_type === 'like')
                .map((i: any) => ({
                    userId: i.user_id,
                    name: i.profiles?.name || 'Usuário',
                    timestamp: i.created_at
                }))
        };
    });
};

export const toggleAnnouncementPinSQL = async (id: string, orgId: string, isPinned: boolean) => {
    const sb = getSupabase();
    if (!sb) throw new Error("No Supabase client");

    const { error } = await sb.from('announcements')
        .update({ is_pinned: isPinned })
        .eq('id', id)
        .eq('organization_id', orgId);

    if (error) {
         if (error.code === 'PGRST204' || error.message?.includes('is_pinned') || error.message?.includes('não existe')) {
             console.warn("[Notifications] Column 'is_pinned' issue. Cannot pin announcement without schema update.");
             throw new Error("MISSING_COLUMN");
         }
         throw error;
    }
};

export const interactAnnouncementSQL = async (id: string, userId: string, userName: string, action: 'read'|'like', orgId: string) => {
    const sb = getSupabase();
    if (!sb) throw new Error("No Supabase client");

    // Validate Profile
    const { data: profile } = await sb.from('profiles').select('id').eq('id', userId).maybeSingle();
    if (!profile) {
        await sb.from('profiles').upsert({ 
            id: userId, 
            name: userName, 
            organization_id: orgId 
        }, { onConflict: 'id', ignoreDuplicates: true });
    }

    if (action === 'like') {
        const { data: existing, error: checkError } = await sb.from('announcement_interactions')
            .select('id')
            .eq('announcement_id', id)
            .eq('user_id', userId)
            .eq('organization_id', orgId)
            .eq('interaction_type', 'like')
            .maybeSingle();

        if (checkError) throw checkError;

        if (existing) {
            const { error: delError } = await sb.from('announcement_interactions')
                .delete()
                .eq('id', existing.id)
                .eq('organization_id', orgId);
            if (delError) throw delError;
        } else {
            const { error: insertError } = await sb.from('announcement_interactions').insert({
                announcement_id: id,
                user_id: userId,
                organization_id: orgId,
                interaction_type: 'like'
            });
            if (insertError) throw insertError;
        }
    } else {
        const { error: upsertError } = await sb.from('announcement_interactions').upsert({
            announcement_id: id,
            user_id: userId,
            organization_id: orgId,
            interaction_type: 'read'
        }, {
            onConflict: 'announcement_id,user_id,interaction_type'
        });
        if (upsertError) throw upsertError;
    }
};
