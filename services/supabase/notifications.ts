import { getSupabase } from './client';

// Cache em memória e localStorage para evitar erros 400 se as migrações SQL ainda não foram executadas no Supabase
let targetUserIdSupported: boolean = (() => {
    try {
        const val = localStorage.getItem('supabase_has_target_user_id');
        return val === null ? true : val === 'true';
    } catch {
        return true;
    }
})();

let actionLinkSupported: boolean = (() => {
    try {
        const val = localStorage.getItem('supabase_has_action_link');
        return val === null ? true : val === 'true';
    } catch {
        return true;
    }
})();

export const fetchNotificationsSQL = async (ministryIds: string[], userId: string, orgId: string, isAdmin: boolean = false) => {
    const sb = getSupabase();
    if (!sb || !orgId) return [];
    
    // Constrói condições seguras para o filtro OR
    const validMinistryIds = (ministryIds || []).filter(Boolean);
    const orConditions: string[] = [];

    // Comunicados Globais / Avisos da Organização (ministry_id nulo)
    orConditions.push('ministry_id.is.null');

    if (validMinistryIds.length > 0) {
        const idsList = validMinistryIds.join(',');
        if (isAdmin) {
            orConditions.push(`ministry_id.in.(${idsList})`);
            orConditions.push(`type.eq.join_request`);
        } else if (targetUserIdSupported) {
            orConditions.push(`and(ministry_id.in.(${idsList}),target_user_id.is.null)`);
        } else {
            orConditions.push(`ministry_id.in.(${idsList})`);
        }
    } else if (!isAdmin && targetUserIdSupported) {
        orConditions.push(`target_user_id.is.null`);
    } else if (isAdmin) {
        orConditions.push(`type.eq.join_request`);
    }

    if (userId && targetUserIdSupported) {
        orConditions.push(`target_user_id.eq.${userId}`);
    }

    const applyFilters = (q: any) => {
        let res = q.eq('organization_id', orgId);
        if (orConditions.length > 0) {
            res = res.or(orConditions.join(','));
        }
        return res;
    };

    // 1. Tenta query completa com embed de organization_ministries
    let globalNotifs: any[] | null = null;
    let fetchError: any = null;

    try {
        const query = applyFilters(
            sb.from('notifications')
              .select('*, organization_ministries(label)')
        );
        const res = await query.order('created_at', { ascending: false }).limit(30);
        globalNotifs = res.data;
        fetchError = res.error;
    } catch (e) {
        fetchError = e;
    }

    // 2. Fallback robusto se houver erro (400 por falta de FK, coluna target_user_id inexistente, etc.)
    if (fetchError || !globalNotifs) {
        if (fetchError?.message?.includes('target_user_id') || fetchError?.details?.includes('target_user_id')) {
            targetUserIdSupported = false;
            try { localStorage.setItem('supabase_has_target_user_id', 'false'); } catch {}
        }

        try {
            // Busca direta compatível: filtra estritamente por organization_id e ministry_id
            // sem referenciar target_user_id ou embeds que possam não existir no banco
            let retryQuery = sb.from('notifications')
                .select('*')
                .eq('organization_id', orgId);

            const retryOr: string[] = ['ministry_id.is.null'];
            if (validMinistryIds.length > 0) {
                retryOr.push(`ministry_id.in.(${validMinistryIds.join(',')})`);
            }
            if (isAdmin) {
                retryOr.push(`type.eq.join_request`);
            }
            if (userId && targetUserIdSupported) {
                retryOr.push(`target_user_id.eq.${userId}`);
            }
            retryQuery = retryQuery.or(retryOr.join(','));

            const { data: retryData, error: retryErr } = await retryQuery
                .order('created_at', { ascending: false })
                .limit(30);

            if (!retryErr && retryData) {
                globalNotifs = retryData.map((n: any) => ({
                    ...n,
                    organization_ministries: { label: !n.ministry_id ? (n.action_link?.includes('admin') ? 'Aviso Admin' : 'Comunicado Geral') : 'Aviso' }
                }));
            } else {
                globalNotifs = [];
            }
        } catch (e) {
            globalNotifs = [];
        }
    }

    let finalNotifs = globalNotifs || [];

    // Se o usuário não for administrador, filtra notificações restritas aos administradores
    if (!isAdmin) {
        finalNotifs = finalNotifs.filter((n: any) => 
            n.action_link !== 'super-admin-message' && 
            n.action_link !== 'super-admin-broadcast-admins'
        );
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
    
    return (finalNotifs || [])
        .filter((n: any) => !clearSet.has(n.id))
        .map((n: any) => {
            const m = Array.isArray(n.organization_ministries) ? n.organization_ministries[0] : n.organization_ministries;
            const isGlobal = !n.ministry_id;
            const globalLabel = n.action_link === 'super-admin-message' || n.action_link === 'super-admin-broadcast-admins'
                ? 'Aviso Admin'
                : 'Comunicado Geral';

            return {
                id: n.id,
                ministryId: n.ministry_id,
                ministryName: m?.label || (isGlobal ? globalLabel : undefined),
                organizationId: n.organization_id,
                title: n.title,
                message: n.message,
                type: n.type,
                timestamp: n.created_at,
                read: readSet.has(n.id),
                actionLink: n.action_link,
                targetUserId: n.target_user_id || n.targetUserId || (n as any).user_id
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
    if (!sb) return { success: false, error: 'No client' };
    
    // Limpa HTML para notificações (sempre texto simples)
    const cleanMessage = stripHtml(notification.message);

    // -- 1. Disparo da Notificação Push (Web Push via Edge Function) --
    // Disparado imediatamente com tratamento de erros para garantir entrega mesmo se o banco local oscilar
    let pushDispatched = false;
    try {
        const pushBody: any = {
            ministryId: ministryId,
            orgId: orgId,
            title: notification.title,
            message: cleanMessage,
            type: notification.type || 'info',
            actionLink: notification.actionLink || 'dashboard'
        };
        if (notification.targetUserId) {
            pushBody.userIds = [notification.targetUserId];
        }

        sb.functions.invoke('push-notification', { body: pushBody })
            .then(({ data, error }) => {
                if (error) {
                    console.warn("[Push Notification] Edge function aviso/erro:", error);
                } else {
                    pushDispatched = true;
                    console.log("[Push Notification] Disparo concluído:", data?.message || data);
                }
            })
            .catch(err => {
                console.warn("[Push Notification] Falha de rede ao disparar push:", err);
            });
    } catch (pushErr) {
        console.warn("[Push Notification] Erro ao invocar push:", pushErr);
    }

    // -- 2. Persistência In-App (Tabela notifications no Supabase) --
    // Constrói payload seguro: só inclui colunas opcionais se fornecidas
    const payload: any = {
        organization_id: orgId,
        ministry_id: ministryId,
        title: notification.title,
        message: cleanMessage,
        type: notification.type || 'info'
    };

    if (notification.actionLink) {
        payload.action_link = notification.actionLink;
    }
    if (notification.targetUserId) {
        payload.target_user_id = notification.targetUserId;
    }

    let insertError: any = null;
    try {
        const res = await sb.from('notifications').insert(payload);
        insertError = res.error;
    } catch (e) {
        insertError = e;
    }

    if (insertError) {
        console.warn("[Notifications] Falha no insert inicial, tentando fallback com schema base:", insertError);
        
        // Fallback: remove colunas adicionais que possam não existir no schema do Postgres
        // (ex: target_user_id ou action_link) e tenta inserir com colunas estritamente essenciais
        const minimalPayload: any = {
            organization_id: orgId,
            ministry_id: ministryId,
            title: notification.title,
            message: cleanMessage,
            type: notification.type || 'info'
        };

        try {
            const { error: retryError } = await sb.from('notifications').insert(minimalPayload);
            if (!retryError) {
                console.log("[Notifications] Inserção in-app recuperada com schema básico.");
                insertError = null;
            } else {
                insertError = retryError;
                console.warn("[Notifications] Fallback de inserção in-app também falhou:", retryError);
            }
        } catch (retryEx) {
            insertError = retryEx;
            console.warn("[Notifications] Erro crítico no retry:", retryEx);
        }
    }

    return { 
        success: !insertError || pushDispatched, 
        inAppSaved: !insertError, 
        pushDispatched 
    };
};

export const markNotificationsReadSQL = async (ids: string[], userId: string, orgId: string) => {
    const sb = getSupabase();
    if (!sb) return;
    
    const inserts = ids.map(id => ({
        user_id: userId,
        notification_id: id,
        organization_id: orgId
    }));
    
    try {
        await sb.from('notification_reads').upsert(inserts, { onConflict: 'user_id, notification_id' });
    } catch (e) {
        // Defensivo: se a tabela/constraint não existir, a UI já aplicou o
        // optimistic update — apenas registra para diagnóstico.
        console.warn("[Notifications] Falha ao persistir leitura no banco:", e);
    }
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

export const notifySuperAdmins = async (
    title: string, 
    message: string, 
    actionLink?: string, 
    targetMinistryId?: string, 
    orgId?: string, 
    type: string = 'info',
    targetUserId?: string
) => {
    const sb = getSupabase();
    if (!sb) return;

    // ── 1. Busca admins em uma única query ────────────────────────────────
    let query = sb
      .from('profiles')
      .select('id, organization_id')
      .or(`is_super_admin.eq.true${orgId ? `,and(is_admin.eq.true,organization_id.eq.${orgId})` : ''}`);
      // REMOVIDO: .not('organization_id', 'is', null)

    const { data: admins } = await query;

    // ── 2. Busca admins do ministério alvo (batch) ────────────────────────
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
    const uniqueAdmins = Array.from(new Map(allAdmins.map(a => [a.id, a])).values());

    // Se não temos admins e também não temos um alvo explícito, não há para quem enviar
    if (!uniqueAdmins.length && !(orgId && targetMinistryId)) return;

    // ── 3. Resolve ministérios de cada admin em BATCH ─────────────────────
    // Admins que já têm targetMinistryId definido → usam diretamente
    // Admins sem ministério alvo → buscamos seus ministérios em uma única query

    // Agrupa org_ids que precisam de lookup de ministério padrão
    const orgsNeedingMinistry = uniqueAdmins
        .filter(a => !targetMinistryId && a.organization_id)
        .map(a => a.organization_id as string);

    // Busca o PRIMEIRO ministério de cada org em batch
    const ministryByOrg = new Map<string, string>();
    if (orgsNeedingMinistry.length > 0) {
        const uniqueOrgIds = [...new Set(orgsNeedingMinistry)];
        const { data: orgMinistries } = await sb
            .from('organization_ministries')
            .select('id, organization_id')
            .in('organization_id', uniqueOrgIds);

        if (orgMinistries) {
            for (const om of orgMinistries) {
                // Mantém apenas o primeiro encontrado por org (equivale ao .limit(1) anterior)
                if (!ministryByOrg.has(om.organization_id)) {
                    ministryByOrg.set(om.organization_id, om.id);
                }
            }
        }
    }

    // ── 4. Monta o mapa de targets (orgId|minId) único ────────────────────
    const targetMap = new Map<string, { orgId: string, minId: string }>();

    // Garante que o alvo explícito sempre receba a notificação (ignora RLS se houver alvo)
    if (orgId && targetMinistryId) {
        targetMap.set(`${orgId}|${targetMinistryId}`, { orgId, minId: targetMinistryId });
    }

    for (const admin of uniqueAdmins) {
        if (!admin.organization_id) continue; // SA sem org: skip (sem ministério para notificar)
        const minId = targetMinistryId || ministryByOrg.get(admin.organization_id);
        const oId   = orgId || admin.organization_id;
        if (minId && oId) {
            targetMap.set(`${oId}|${minId}`, { orgId: oId, minId });
        }
    }

    if (targetMap.size === 0) return;

    // ── 5. Busca labels de todos os ministérios em uma única query ─────────
    const allMinIds = [...targetMap.values()].map(t => t.minId);
    const { data: labelsData } = await sb
        .from('organization_ministries')
        .select('id, label')
        .in('id', allMinIds);

    const labelById = new Map<string, string>(
        (labelsData || []).map(m => [m.id, m.label])
    );

    // ── 6. Monta notificações em memória e insere em lote ─────────────────
    const cleanRawMessage = stripHtml(message);
    const notificationsToInsert: any[] = [];

    // Tenta resolver o target_user_id a partir do actionLink (se for JSON ou UUID) caso não tenha sido passado
    let resolvedTargetUserId = targetUserId || null;
    if (!resolvedTargetUserId && typeof actionLink === 'string') {
        const trimmed = actionLink.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (parsed.userId) resolvedTargetUserId = String(parsed.userId);
            } catch (e) {}
        } else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
            resolvedTargetUserId = trimmed;
        }
    }

    for (const [, target] of targetMap.entries()) {
        const { orgId: tOrgId, minId: tMinId } = target;
        const displayLabel = labelById.get(tMinId) || 'Ministério';
        const finalMessage = `${cleanRawMessage} (Ministério: ${displayLabel})`;

        notificationsToInsert.push({
            organization_id: tOrgId,
            ministry_id: tMinId,
            title,
            message: finalMessage,
            type,
            ...(actionLinkSupported && actionLink ? { action_link: actionLink } : {}),
            ...(targetUserIdSupported && resolvedTargetUserId ? { target_user_id: resolvedTargetUserId } : {})
        });
    }

    if (notificationsToInsert.length > 0) {
        let insertResult = await sb.from('notifications').insert(notificationsToInsert);
        if (insertResult.error) {
            if (insertResult.error.message?.includes('target_user_id')) {
                targetUserIdSupported = false;
                try { localStorage.setItem('supabase_has_target_user_id', 'false'); } catch {}
            }
            if (insertResult.error.message?.includes('action_link')) {
                actionLinkSupported = false;
                try { localStorage.setItem('supabase_has_action_link', 'false'); } catch {}
            }

            console.warn('[notifySuperAdmins] Inserção falhou, tentando fallback com schema base:', insertResult.error);
            const fallbackInserts = notificationsToInsert.map(n => {
                const copy = { ...n };
                delete copy.action_link;
                delete copy.target_user_id;
                return copy;
            });
            insertResult = await sb.from('notifications').insert(fallbackInserts);
        }

        // ── PUSH REAL para os admins alvo (supervisão: notificar "quem, o quê" mesmo fora do app) ──
        if (orgId && targetMinistryId) {
            const adminIds = uniqueAdmins.map((a: any) => a.id);
            sb.functions.invoke('push-notification', {
                body: {
                    userIds: adminIds,
                    ministryId: targetMinistryId,
                    orgId,
                    title,
                    message: cleanRawMessage,
                    type,
                    actionLink: actionLink || 'super-admin'
                }
            }).then(({ error }) => {
                if (error) console.warn('[notifySuperAdmins] push falhou:', error);
            }).catch((err: any) => console.warn('[notifySuperAdmins] push erro:', err));
        }
        return insertResult;
    }
    return { data: null, error: null };
};

export const fetchGlobalBroadcasts = async () => {
    const sb = getSupabase();
    if (!sb) return [];
    
    try {
        const { data, error } = await sb.from('notifications')
            .select('title, message, type, created_at, action_link')
            .or('action_link.eq.super-admin-message,action_link.eq.super-admin-broadcast-admins,action_link.eq.super-admin-broadcast-all,action_link.eq.super-admin-broadcast')
            .order('created_at', { ascending: false })
            .limit(300);
            
        if (!error && data && data.length > 0) {
            const unique: any[] = [];
            const seen = new Set();
            for (const item of data) {
                const key = `${item.title}-${item.message}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    unique.push(item);
                }
            }
            return unique;
        }
    } catch {}

    // Fallback: se action_link não filtrar, busca registros sem ministry_id
    const { data: fallbackData } = await sb.from('notifications')
        .select('title, message, type, created_at, action_link')
        .is('ministry_id', null)
        .order('created_at', { ascending: false })
        .limit(300);
        
    const unique: any[] = [];
    const seen = new Set();
    for (const item of fallbackData || []) {
        const key = `${item.title}-${item.message}`;
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(item);
        }
    }
    return unique;
};

export const deleteGlobalBroadcast = async (title: string, message: string) => {
    const sb = getSupabase();
    if (!sb) return { error: new Error('Sem conexão') };
    
    const { error } = await sb.from('notifications')
        .delete()
        .eq('title', title)
        .eq('message', message);
        
    return { error };
};

export type BroadcastTargetAudience = 'all' | 'admins';

export const sendGlobalBroadcast = async (
    title: string, 
    message: string, 
    type: string = 'info',
    targetAudience: BroadcastTargetAudience = 'all'
) => {
    const sb = getSupabase();
    if (!sb) return { error: new Error('Sem conexão com o banco.') };

    const cleanRawMessage = stripHtml(message);
    const isAdminsOnly = targetAudience === 'admins';
    const actionLink = isAdminsOnly ? 'super-admin-broadcast-admins' : 'super-admin-broadcast-all';

    let targetProfiles: { id: string; organization_id?: string }[] = [];

    if (isAdminsOnly) {
        // Busca todos os administradores com organização vinculada
        const { data: admins, error: fetchError } = await sb
            .from('profiles')
            .select('id, organization_id')
            .eq('is_admin', true)
            .not('organization_id', 'is', null);

        if (fetchError) {
            console.error("[Notifications] Erro ao buscar admins:", fetchError);
            return { error: fetchError };
        }
        targetProfiles = admins || [];
    } else {
        // Busca todos os usuários com organização vinculada
        const { data: allProfiles, error: fetchError } = await sb
            .from('profiles')
            .select('id, organization_id')
            .not('organization_id', 'is', null);

        if (fetchError) {
            console.error("[Notifications] Erro ao buscar perfis:", fetchError);
            return { error: fetchError };
        }
        targetProfiles = allProfiles || [];
    }

    if (!targetProfiles || targetProfiles.length === 0) {
        if (isAdminsOnly) {
            return { data: null, error: null };
        }
    }

    // Agrupa org_ids únicos
    const profileOrgIds = targetProfiles
        .map(p => p.organization_id)
        .filter(Boolean) as string[];

    let orgIds = [...new Set(profileOrgIds)];

    // Se for para Geral, também garante que todas as organizações cadastradas no banco recebam
    if (!isAdminsOnly) {
        try {
            const { data: orgs } = await sb.from('organizations').select('id');
            if (orgs && orgs.length > 0) {
                orgIds = [...new Set([...orgIds, ...orgs.map((o: any) => o.id)])];
            }
        } catch (e) {
            console.warn('[Notifications] Erro ao buscar organizations:', e);
        }
    }

    if (orgIds.length === 0) {
        return { data: null, error: null };
    }

    // Monta notificações no painel (uma por organização, ministry_id = null para nível global/organização)
    const notificationsToInsert: any[] = orgIds.map(orgId => ({
        organization_id: orgId,
        ministry_id: null,
        title,
        message: cleanRawMessage,
        type,
        action_link: actionLink
    }));

    // Dispara Web Push Notifications não-bloqueante para os usuários alvos em lotes
    const recipientUserIds = targetProfiles.map(p => p.id).filter(Boolean);
    if (recipientUserIds.length > 0) {
        setTimeout(() => {
            const batchSize = 50;
            for (let i = 0; i < recipientUserIds.length; i += batchSize) {
                const batch = recipientUserIds.slice(i, i + batchSize);
                sb.functions.invoke('push-notification', {
                    body: {
                        ministryId: 'global',
                        userIds: batch,
                        title,
                        message: cleanRawMessage,
                        type,
                        actionLink: 'dashboard'
                    }
                }).catch((err) => { 
                    console.warn("[notifications] push-notification (super admin broadcast) falhou:", err); 
                });
            }
        }, 50);
    }

    // Insere notificações in-app
    const { data, error } = await sb.from('notifications').insert(notificationsToInsert);
    if (error) {
        // Fallback se action_link der erro
        if (error.code === 'PGRST204' || error.message?.includes('action_link')) {
            const fallbackInserts = notificationsToInsert.map(n => {
                const copy = { ...n };
                delete copy.action_link;
                return copy;
            });
            return await sb.from('notifications').insert(fallbackInserts);
        }
        return { error };
    }
    return { data, error: null };
};

export const notifyAllOrganizationAdmins = async (title: string, message: string, type: string = 'info') => {
    return sendGlobalBroadcast(title, message, type, 'admins');
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
