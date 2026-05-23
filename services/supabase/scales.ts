import { getSupabase } from './client';
import { ScheduleMap, AttendanceMap, GlobalConflictMap } from '../../types';

export const fetchScheduleAssignments = async (ministryId: string, month: string, orgId?: string): Promise<{ schedule: ScheduleMap, attendance: AttendanceMap }> => {
    const sb = getSupabase();
    if (!sb || !orgId) throw new Error("Missing dependencies");

    const [year, m] = month.split('-');
    const lastDay = new Date(parseInt(year), parseInt(m), 0).getDate();
    const startDate = `${month}-01`;
    const endDate = `${month}-${lastDay}`;

    const { data: assignments, error } = await sb.from('schedule_assignments')
        .select('*, profiles(name)')
        .eq('ministry_id', ministryId)
        .eq('organization_id', orgId)
        .gte('event_date', startDate)
        .lte('event_date', endDate);

    if (error) throw error;

    const schedule: ScheduleMap = {};
    const attendance: AttendanceMap = {};

    assignments?.forEach((a: { event_rule_id: string; event_date: string; role: string; confirmed: boolean; profiles: any }) => {
        const ruleId = a.event_rule_id;
        const dateStr = a.event_date?.slice(0, 10);
        
        if (ruleId && dateStr) {
            const key = `${ruleId}|${dateStr}|${a.role}`;
            const profile = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
            const name = profile?.name;

            if (a.role === '__EVENT_EXCLUDED__') {
                schedule[key] = '__EXCLUDED__';
            } else if (name) {
                schedule[key] = name;
            }
            if (a.confirmed) attendance[key] = true;
        }
    });

    return { schedule, attendance };
};

export const saveScheduleAssignment = async (ministryId: string, orgId: string, eventKey: string, role: string, memberId: string, _memberName: string) => {
    const sb = getSupabase();
    if (!sb) return;
    
    let ruleId = eventKey;
    let dateStr = "";
    
    if (eventKey.includes('|20')) {
        const parts = eventKey.split('|');
        ruleId = parts[0];
        dateStr = parts[1];
    }

    if (!dateStr) return;

    const { error } = await sb.from('schedule_assignments').upsert({
        organization_id: orgId,
        ministry_id: ministryId,
        event_rule_id: ruleId,
        event_date: dateStr,
        role: role,
        member_id: memberId,
        confirmed: false
    }, { onConflict: 'organization_id,ministry_id,event_rule_id,event_date,role' });
    
    if (error) throw error;
};

export const removeScheduleAssignment = async (ministryId: string, orgId: string, logicalKey: string) => {
    const sb = getSupabase();
    if (!sb) return;
    
    const parts = logicalKey.split('|');
    if (parts.length < 3) return;
    
    const ruleId = parts[0];
    const dateStr = parts[1];
    const role = parts.slice(2).join('|');
    
    await sb.from('schedule_assignments').delete()
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId)
        .eq('event_rule_id', ruleId)
        .eq('event_date', dateStr)
        .eq('role', role);
};

export const toggleAssignmentConfirmation = async (ministryId: string, orgId: string, key: string) => {
    const sb = getSupabase();
    if (!sb) return;
    
    const parts = key.split('|');
    const ruleId = parts[0];
    const dateStr = parts[1];
    const role = parts.slice(2).join('|');

    const { data } = await sb.from('schedule_assignments')
        .select('confirmed, member_id')
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId)
        .eq('event_rule_id', ruleId)
        .eq('event_date', dateStr)
        .eq('role', role)
        .maybeSingle();
        
    if (data) {
        const nextConfirmed = !data.confirmed;
        
        await sb.from('schedule_assignments')
            .update({ confirmed: nextConfirmed })
            .eq('organization_id', orgId)
            .eq('ministry_id', ministryId)
            .eq('event_rule_id', ruleId)
            .eq('event_date', dateStr)
            .eq('role', role);

        if (nextConfirmed && data.member_id) {
            await sb.from('event_checkins').upsert({
                organization_id: orgId,
                ministry_id: ministryId,
                member_id: data.member_id,
                event_rule_id: ruleId,
                date: dateStr
            }, { onConflict: 'organization_id,ministry_id,member_id,event_rule_id,date' });
        }
    }
};

export const clearScheduleForMonth = async (ministryId: string, orgId: string, month: string) => {
    const sb = getSupabase();
    if (!sb) return;

    const [year, m] = month.split('-');
    const lastDay = new Date(parseInt(year), parseInt(m), 0).getDate();
    const startDate = `${month}-01`;
    const endDate = `${month}-${lastDay}`;

    await sb.from('schedule_assignments')
        .delete()
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId)
        .gte('event_date', startDate)
        .lte('event_date', endDate);
};

export const fetchGlobalSchedules = async (month: string, ministryId: string, orgId: string): Promise<GlobalConflictMap> => {
    const sb = getSupabase();
    if (!sb) return {};
    
    const [year, m] = month.split('-');
    const lastDay = new Date(parseInt(year), parseInt(m), 0).getDate();
    const startDate = `${month}-01`;
    const endDate = `${month}-${lastDay}`;

    const { data } = await sb.from('schedule_assignments')
        .select('ministry_id, event_date, role, profiles(name)')
        .eq('organization_id', orgId)
        .neq('ministry_id', ministryId)
        .gte('event_date', startDate)
        .lte('event_date', endDate);
        
    const conflicts: GlobalConflictMap = {};
    data?.forEach((row: { ministry_id: string; event_date: string; role: string; profiles: any }) => {
        const name = row.profiles?.name?.trim().toLowerCase();
        if (name) {
            if (!conflicts[name]) conflicts[name] = [];
            conflicts[name].push({
                ministryId: row.ministry_id,
                eventIso: row.event_date,
                role: row.role
            });
        }
    });
    return conflicts;
};
