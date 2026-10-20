import { getSupabase } from './client';
import { notifySuperAdmins, sendNotificationSQL } from './notifications';

export const replicateRepertoireToProjectionAndDance = async (
    item: any,
    sourceMinistryId: string,
    orgId: string,
    eventRuleId: string | null = null
) => {
    const sb = getSupabase();
    if (!sb || !orgId) return;

    try {
        // 1. Localizar ministérios de Comunicação / Projeção / Mídia e Dança / Coreografia na mesma organização
        const { data: orgMinistries } = await sb
            .from('organization_ministries')
            .select('id, label, code')
            .eq('organization_id', orgId);

        const isProjectionMinistry = (m: any) => {
            if (!m || m.id === sourceMinistryId) return false;
            const text = `${m.label || ''} ${m.code || ''}`.toLowerCase();
            return (
                text.includes('comunic') ||
                text.includes('projec') ||
                text.includes('projeç') ||
                text.includes('mídia') ||
                text.includes('midia') ||
                text.includes('transmiss') ||
                text.includes('multimidia') ||
                text.includes('multimídia') ||
                text.includes('som')
            );
        };

        const isDanceMinistry = (m: any) => {
            if (!m || m.id === sourceMinistryId) return false;
            const text = `${m.label || ''} ${m.code || ''}`.toLowerCase();
            return (
                text.includes('dança') ||
                text.includes('danca') ||
                text.includes('coreograf') ||
                text.includes('teatro') ||
                text.includes('artes') ||
                text.includes('dance')
            );
        };

        const projectionMinistries = (orgMinistries || []).filter(isProjectionMinistry);
        const danceMinistries = (orgMinistries || []).filter(isDanceMinistry);

        const dateFormatted = item.date ? item.date.split('-').reverse().join('/') : '';
        const itemTitle = item.title ? item.title.substring(0, 250) : 'Sem Título';
        const itemLink = item.link ? item.link.substring(0, 500) : '';

        // Sincronizar para Projeção / Comunicação
        for (const targetMin of projectionMinistries) {
            const { data: existing } = await sb
                .from('repertoire_items')
                .select('id')
                .eq('organization_id', orgId)
                .eq('ministry_id', targetMin.id)
                .eq('date', item.date)
                .eq('title', itemTitle)
                .maybeSingle();

            if (!existing) {
                await sb.from('repertoire_items').insert({
                    organization_id: orgId,
                    ministry_id: targetMin.id,
                    title: itemTitle,
                    link: itemLink,
                    date: item.date,
                    added_by: `${item.addedBy || 'Ministro de Louvor'} (Louvor)`,
                    content: item.content,
                    observation: 'Sincronizado automaticamente da equipe de Louvor para Projeção',
                    event_rule_id: eventRuleId
                });

                sendNotificationSQL(targetMin.id, orgId, {
                    title: '🎵 Playlist para Projeção Sincronizada!',
                    message: `O louvor postou "${item.title}" para o culto de ${dateFormatted}. Disponível no repertório para preparar a projeção!`,
                    type: 'info',
                    actionLink: 'repertoire'
                }).catch(() => {});
            }
        }

        // Sincronizar para Dança / Coreografia
        for (const targetDance of danceMinistries) {
            const { data: existing } = await sb
                .from('repertoire_items')
                .select('id')
                .eq('organization_id', orgId)
                .eq('ministry_id', targetDance.id)
                .eq('date', item.date)
                .eq('title', itemTitle)
                .maybeSingle();

            if (!existing) {
                await sb.from('repertoire_items').insert({
                    organization_id: orgId,
                    ministry_id: targetDance.id,
                    title: itemTitle,
                    link: itemLink,
                    date: item.date,
                    added_by: `${item.addedBy || 'Ministro de Louvor'} (Louvor)`,
                    content: item.content,
                    observation: 'Sincronizado automaticamente da equipe de Louvor para Dança',
                    event_rule_id: eventRuleId
                });

                sendNotificationSQL(targetDance.id, orgId, {
                    title: '💃 Repertório do Louvor para Dança!',
                    message: `O louvor postou "${item.title}" para o culto de ${dateFormatted}. Playlist e cifras disponíveis no repertório para ensaio de coreografia!`,
                    type: 'info',
                    actionLink: 'repertoire'
                }).catch(() => {});
            }
        }

        // 2. Notificar membros com funções específicas na organização
        const { data: profiles } = await sb
            .from('profiles')
            .select('id, name, ministry_functions')
            .eq('organization_id', orgId);

        // Notificar voluntários de Projeção
        const projectionProfiles = (profiles || []).filter((p: any) => {
            const funcs = (p.ministry_functions || []).map((f: string) => f.toLowerCase());
            return funcs.some((f: string) => 
                f.includes('projec') || 
                f.includes('projeç') || 
                f.includes('mídia') || 
                f.includes('midia') || 
                f.includes('comunic') ||
                f.includes('slide') ||
                f.includes('letra')
            );
        });

        for (const p of projectionProfiles) {
            sendNotificationSQL(sourceMinistryId, orgId, {
                title: '🎵 Playlist para Projeção Disponível!',
                message: `Olá ${p.name || ''}, o louvor postou a música "${item.title}" para o culto de ${dateFormatted}. Acesse o repertório para preparar a projeção!`,
                type: 'info',
                actionLink: 'repertoire',
                targetUserId: p.id
            }).catch(() => {});
        }

        // Notificar voluntárias de Dança
        const danceProfiles = (profiles || []).filter((p: any) => {
            const funcs = (p.ministry_functions || []).map((f: string) => f.toLowerCase());
            return funcs.some((f: string) => 
                f.includes('dança') || 
                f.includes('danca') || 
                f.includes('coreograf') ||
                f.includes('teatro') ||
                f.includes('artes') ||
                f.includes('dance')
            );
        });

        for (const p of danceProfiles) {
            sendNotificationSQL(sourceMinistryId, orgId, {
                title: '💃 Playlist de Louvor para Dança!',
                message: `Olá ${p.name || ''}, o louvor adicionou a música "${item.title}" para o culto de ${dateFormatted}. Acesse o repertório para saber os louvores e ensaiar a coreografia!`,
                type: 'info',
                actionLink: 'repertoire',
                targetUserId: p.id
            }).catch(() => {});
        }
    } catch (err) {
        console.warn("[replicateRepertoireToProjectionAndDance] Falha ao sincronizar com Projeção e Dança:", err);
    }
};

export const replicateRepertoireToProjection = replicateRepertoireToProjectionAndDance;

export const fetchRepertoire = async (ministryId: string, orgId: string) => {
    const sb = getSupabase();
    if (!sb) return [];

    // 1. Buscar os itens do ministério atual
    const { data: ownItems } = await sb.from('repertoire_items')
        .select('*')
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId)
        .order('date', { ascending: false });

    let allRawItems = [...(ownItems || [])];

    // 2. Se o ministério atual for Dança ou Projeção, buscar também os louvores do Ministério de Louvor para visualização unificada
    try {
        const { data: orgMinistries } = await sb
            .from('organization_ministries')
            .select('id, label, code')
            .eq('organization_id', orgId);

        const currentMin = (orgMinistries || []).find((m: any) => m.id === ministryId || m.code === ministryId);
        const minText = `${currentMin?.label || ''} ${currentMin?.code || ''} ${ministryId || ''}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        const isDanceOrProjection = 
            minText.includes('danca') || minText.includes('coreograf') ||
            minText.includes('artes') || minText.includes('teatro') || minText.includes('dance') ||
            minText.includes('projec') || minText.includes('midia') || minText.includes('comunic');

        if (isDanceOrProjection) {
            // Localizar ministério(s) de Louvor
            const worshipMinistries = (orgMinistries || []).filter((m: any) => {
                if (m.id === ministryId || m.code === ministryId) return false;
                const txt = `${m.label || ''} ${m.code || ''}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                return txt.includes('louvor') || txt.includes('musica') || txt.includes('banda') || txt.includes('worship');
            });

            const worshipIds = worshipMinistries.map((m: any) => m.id);
            if (!worshipIds.includes('louvor')) {
                worshipIds.push('louvor');
            }

            if (worshipIds.length > 0) {
                const { data: worshipItems } = await sb
                    .from('repertoire_items')
                    .select('*')
                    .eq('organization_id', orgId)
                    .in('ministry_id', worshipIds)
                    .order('date', { ascending: false });

                if (worshipItems && worshipItems.length > 0) {
                    const existingKeys = new Set(
                        allRawItems.map((i: any) => `${(i.date || i.event_date || '').trim()}_${(i.title || '').trim().toLowerCase()}`)
                    );

                    for (const wItem of worshipItems) {
                        const key = `${(wItem.date || wItem.event_date || '').trim()}_${(wItem.title || '').trim().toLowerCase()}`;
                        if (!existingKeys.has(key)) {
                            existingKeys.add(key);
                            allRawItems.push({
                                ...wItem,
                                isFromWorship: true,
                                observation: wItem.observation || 'Sincronizado da equipe de Louvor'
                            });
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.warn("[fetchRepertoire] Falha ao verificar/unificar itens do Louvor:", e);
    }

    // Ordenar por data decrescente
    allRawItems.sort((a, b) => {
        const dateA = a.date || a.event_date || '';
        const dateB = b.date || b.event_date || '';
        return dateB.localeCompare(dateA);
    });
        
    return allRawItems.map((r: any) => ({
        id: r.id,
        title: r.title,
        link: r.link,
        date: r.date || r.event_date,
        observation: r.observation,
        addedBy: r.added_by,
        createdAt: r.created_at,
        content: r.content,
        key: r.key,
        organizationId: r.organization_id,
        isFromWorship: !!r.isFromWorship || (typeof r.observation === 'string' && r.observation.toLowerCase().includes('louvor'))
    }));
};

export const addToRepertoire = async (ministryId: string, orgId: string, item: any) => {
    const sb = getSupabase();
    if (!sb) return false;

    // Tenta resolver event_rule_id a partir de schedule_assignments na mesma data
    let eventRuleId: string | null = null;
    try {
        const { data: ass } = await sb
            .from('schedule_assignments')
            .select('event_rule_id')
            .eq('organization_id', orgId)
            .eq('ministry_id', ministryId)
            .eq('event_date', item.date)
            .limit(1)
            .maybeSingle();
        if (ass?.event_rule_id) {
            eventRuleId = ass.event_rule_id;
        }
    } catch (e) {
        console.error("Erro ao resolver event_rule_id:", e);
    }

    const { error } = await sb.from('repertoire_items').insert({
        organization_id: orgId,
        ministry_id: ministryId,
        title: item.title ? item.title.substring(0, 250) : 'Sem Título',
        link: item.link ? item.link.substring(0, 500) : '',
        date: item.date,
        added_by: item.addedBy ? item.addedBy.substring(0, 100) : 'Admin',
        content: item.content,
        event_rule_id: eventRuleId
    });

    if (error) {
        console.error("Erro ao inserir no repertoire_items:", error);
        throw error;
    }

    if (!error) {
        // Replicar automaticamente para equipes de Projeção / Comunicação e Dança
        replicateRepertoireToProjectionAndDance(item, ministryId, orgId, eventRuleId).catch(() => {});

        await notifySuperAdmins(
            'Nova Música no Repertório',
            `A música "${item.title}" foi adicionada ao repertório por ${item.addedBy}.`,
            'repertoire'
        );
    }

    return !error;
};

export const deleteFromRepertoire = async (id: string, orgId: string) => {
    const sb = getSupabase();
    if (!sb) return;

    try {
        const { data: item } = await sb
            .from('repertoire_items')
            .select('title, date, observation')
            .eq('id', id)
            .eq('organization_id', orgId)
            .maybeSingle();

        await sb.from('repertoire_items').delete().eq('id', id).eq('organization_id', orgId);

        // Se foi um item original (não sincronizado), limpar também réplicas automáticas
        if (item && (!item.observation || !item.observation.includes('Sincronizado automaticamente'))) {
            await sb.from('repertoire_items')
                .delete()
                .eq('organization_id', orgId)
                .eq('date', item.date)
                .eq('title', item.title)
                .ilike('observation', '%Sincronizado automaticamente%');
        }
    } catch (e) {
        await sb.from('repertoire_items').delete().eq('id', id).eq('organization_id', orgId);
    }
};

export const updateRepertoireItem = async (id: string, orgId: string, updates: any) => {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from('repertoire_items').update(updates).eq('id', id).eq('organization_id', orgId);
};
