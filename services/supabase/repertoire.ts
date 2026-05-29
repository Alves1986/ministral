import { getSupabase } from './client';
import { notifySuperAdmins } from './notifications';

export const fetchRepertoire = async (ministryId: string, orgId: string) => {
    const sb = getSupabase();
    if (!sb) return [];
    const { data } = await sb.from('repertoire_items')
        .select('*')
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId)
        .order('event_date', { ascending: false });
        
    return (data || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        link: r.link,
        date: r.event_date,
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
        title: item.title,
        link: item.link,
        event_date: item.date,
        added_by: item.addedBy,
        content: item.content,
        event_rule_id: eventRuleId
    });

    if (!error) {
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
