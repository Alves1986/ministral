import { getSupabase } from './client';
import { notifySuperAdmins, sendNotificationSQL } from './notifications';

export const replicateRepertoireToProjection = async (
    item: any,
    sourceMinistryId: string,
    orgId: string,
    eventRuleId: string | null = null
) => {
    const sb = getSupabase();
    if (!sb || !orgId) return;

    try {
        // 1. Localizar ministérios de Comunicação / Projeção / Mídia na mesma organização
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

        const targetMinistries = (orgMinistries || []).filter(isProjectionMinistry);

        for (const targetMin of targetMinistries) {
            // Evitar duplicidade de música na mesma data para o ministério alvo
            const { data: existing } = await sb
                .from('repertoire_items')
                .select('id')
                .eq('organization_id', orgId)
                .eq('ministry_id', targetMin.id)
                .eq('date', item.date)
                .eq('title', item.title ? item.title.substring(0, 250) : 'Sem Título')
                .maybeSingle();

            if (!existing) {
                await sb.from('repertoire_items').insert({
                    organization_id: orgId,
                    ministry_id: targetMin.id,
                    title: item.title ? item.title.substring(0, 250) : 'Sem Título',
                    link: item.link ? item.link.substring(0, 500) : '',
                    date: item.date,
                    added_by: `${item.addedBy || 'Ministro de Louvor'} (Louvor)`,
                    content: item.content,
                    observation: 'Sincronizado automaticamente da equipe de Louvor para Projeção',
                    event_rule_id: eventRuleId
                });

                const dateFormatted = item.date ? item.date.split('-').reverse().join('/') : '';
                sendNotificationSQL(targetMin.id, orgId, {
                    title: '🎵 Playlist para Projeção Sincronizada!',
                    message: `O louvor postou "${item.title}" para o culto de ${dateFormatted}. Disponível no repertório para preparar a projeção!`,
                    type: 'info',
                    actionLink: 'repertoire'
                }).catch(() => {});
            }
        }

        // 2. Notificar também membros que possuem a função de Projeção / Mídia na organização
        const { data: profiles } = await sb
            .from('profiles')
            .select('id, name, ministry_functions')
            .eq('organization_id', orgId);

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

        const dateFormatted = item.date ? item.date.split('-').reverse().join('/') : '';
        for (const p of projectionProfiles) {
            sendNotificationSQL(sourceMinistryId, orgId, {
                title: '🎵 Playlist para Projeção Disponível!',
                message: `Olá ${p.name || ''}, o louvor postou a música "${item.title}" para o culto de ${dateFormatted}. Acesse o repertório para preparar a projeção!`,
                type: 'info',
                actionLink: 'repertoire',
                targetUserId: p.id
            }).catch(() => {});
        }
    } catch (err) {
        console.warn("[replicateRepertoireToProjection] Falha ao sincronizar com Projeção:", err);
    }
};

export const fetchRepertoire = async (ministryId: string, orgId: string) => {
    const sb = getSupabase();
    if (!sb) return [];
    const { data } = await sb.from('repertoire_items')
        .select('*')
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId)
        .order('date', { ascending: false });
        
    return (data || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        link: r.link,
        date: r.date || r.event_date,
        observation: r.observation,
        addedBy: r.added_by,
        createdAt: r.created_at,
        content: r.content,
        key: r.key,
        organizationId: r.organization_id
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
        // Replicar automaticamente para equipe de Projeção / Comunicação
        replicateRepertoireToProjection(item, ministryId, orgId, eventRuleId).catch(() => {});

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
    await sb.from('repertoire_items').delete().eq('id', id).eq('organization_id', orgId);
};

export const updateRepertoireItem = async (id: string, orgId: string, updates: any) => {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from('repertoire_items').update(updates).eq('id', id).eq('organization_id', orgId);
};
