import { getSupabase } from './client';
import { notifySuperAdmins } from './notifications';

export const createEventRule = async (orgId: string, ruleData: any) => {
    const sb = getSupabase();
    if (!sb) throw new Error("No client");
    const formattedTime = ruleData.time.length > 5 ? ruleData.time.substring(0, 5) : ruleData.time;
    const { data, error } = await sb.from('event_rules').insert({
        organization_id: orgId,
        ministry_id: ruleData.ministryId,
        title: ruleData.title,
        type: ruleData.type,
        weekday: ruleData.weekday,
        date: ruleData.date,
        time: formattedTime,
        active: true
    }).select();
    if (error) throw error;

    // Notify super admins
    await notifySuperAdmins(
        'Nova Regra de Agenda',
        `Uma nova regra "${ruleData.title}" foi criada no sistema.`,
        'event-rules',
        ruleData.ministryId
    );

    return data;
};

export const deleteEventRule = async (orgId: string, ruleId: string) => {
    const sb = getSupabase();
    if (!sb) return;

    // Obter dados da regra antes de deletar para o log
    const { data: rule } = await sb.from('event_rules').select('ministry_id, title').eq('id', ruleId).single();

    await sb.from('event_rules').update({ active: false }).eq('id', ruleId).eq('organization_id', orgId);
};

export const createMinistryEvent = async (ministryId: string, orgId: string, event: any) => {
    const formattedTime = event.time.length > 5 ? event.time.substring(0, 5) : event.time;
    return createEventRule(orgId, {
        ministryId,
        title: event.title,
        type: 'single',
        date: event.date,
        time: formattedTime
    });
};

export const deleteMinistryEvent = async (ministryId: string, orgId: string, eventIso: string) => {
    const sb = getSupabase();
    if (!sb) return;
    const date = eventIso.split('T')[0];
    const time = eventIso.split('T')[1];
    
    const { data: rules } = await sb.from('event_rules')
        .select('id')
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId)
        .eq('date', date)
        .eq('time', time)
        .eq('type', 'single');
        
    if (rules && rules.length > 0) {
        await deleteEventRule(orgId, rules[0].id);
    }
};

export const updateMinistryEvent = async (
 ministryId: string,
 orgId: string,
 oldIso: string,
 newTitle: string,
 newIso: string,
 applyToAll: boolean
) => {
 const sb = getSupabase();
 if (!sb) return;
 
 const oldDate = oldIso.split('T')[0];
 const oldTime = oldIso.split('T')[1]?.substring(0, 5);
 const newDate = newIso.split('T')[0];
 const newTime = newIso.split('T')[1]?.substring(0, 5);
 
 if (!oldDate || !oldTime) return;
 
 // Buscar a regra do evento pelo date + time + org
 const { data: rule, error: fetchError } = await sb
   .from('event_rules')
   .select('id, ministry_id')
   .eq('organization_id', orgId)
   .eq('ministry_id', ministryId)
   .eq('date', oldDate)
   .eq('time', oldTime)
   .maybeSingle();
 
 if (fetchError) throw fetchError;
 if (!rule) {
   console.warn('[updateMinistryEvent] Regra nao encontrada para', oldIso);
   return;
 }
 
 const { error: updateError } = await sb
   .from('event_rules')
   .update({
     title: newTitle,
     date: newDate,
     time: newTime
   })
   .eq('id', rule.id)
   .eq('organization_id', orgId);
 
 if (updateError) throw updateError;
};
