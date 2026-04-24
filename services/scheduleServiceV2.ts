import { getSupabase } from "./supabaseService";

export interface EventRuleV2 {
  id: string;
  title: string;
  type: "weekly" | "single";
  weekday?: number;
  date?: string;
  time: string;
}

export interface AssignmentV2 {
  id?: string;
  event_rule_id: string;
  event_date: string;
  role: string;
  member_id: string;
  confirmed: boolean;
  event_key: string; // Legacy compatibility
}

export interface OccurrenceV2 {
  ruleId: string;
  date: string;
  time: string;
  title: string;
  iso: string;
}

export interface MemberV2 {
  id: string;
  name: string;
  avatar_url?: string;
  ministry_functions?: string[];
}

export const fetchAvailabilityForEditor = async (ministryId: string, orgId: string) => {
  const sb = getSupabase();
  if (!sb || ministryId.length !== 36 || orgId.length !== 36) return {};
  const { data } = await sb.from('member_availability')
    .select('user_id, available_date, note')
    .eq('ministry_id', ministryId)
    .eq('organization_id', orgId);
  // Retorna: { userId: { 'YYYY-MM-DD': 'M'|'T'|'N'|'all' } }
  const map: Record<string, Record<string, string>> = {};
  data?.forEach((row: any) => {
    if (!map[row.user_id]) map[row.user_id] = {};
    map[row.user_id][row.available_date] = row.note || 'all';
  });
  return map;
};

export const fetchConflictRules = async (ministryId: string, orgId: string) => {
  const sb = getSupabase();
  if (!sb || ministryId.length !== 36) return { blockGroups: [], allowExceptions: [], memberBlocks: [], memberPrefers: [] };
  const { data } = await sb.from('schedule_conflict_rules')
    .select('rule_type, functions, label')
    .eq('ministry_id', ministryId)
    .eq('organization_id', orgId);

  const blockGroups = data?.filter((r:any) => r.rule_type === 'block_group' && !r.label?.startsWith('[MEMBER_BLOCK]')).map((r:any) => r.functions) || [];
  const allowExceptions = data?.filter((r:any) => r.rule_type === 'allow_exception' && !r.label?.startsWith('[MEMBER_PREFER]')).map((r:any) => r.functions) || [];
  
  const memberBlocks = data?.filter((r:any) => r.label?.startsWith('[MEMBER_BLOCK]')).map((r:any) => r.functions.map((f: string) => f.replace('member:', ''))) || [];
  const memberPrefers = data?.filter((r:any) => r.label?.startsWith('[MEMBER_PREFER]')).map((r:any) => r.functions.map((f: string) => f.replace('member:', ''))) || [];

  return {
    blockGroups,
    allowExceptions,
    memberBlocks,
    memberPrefers
  };
};

export const fetchRulesV2 = async (
  ministryId: string,
  orgId: string
): Promise<EventRuleV2[]> => {
  if (!ministryId || ministryId.length !== 36 || !orgId || orgId.length !== 36) {
    return []; // retorna array vazio sem lancar erro
  }
  const sb = getSupabase();
  if (!sb) throw new Error("NO_SUPABASE");

  const { data, error } = await sb
    .from("event_rules")
    .select("*")
    .eq("organization_id", orgId)
    .eq("ministry_id", ministryId)
    .eq("active", true);

  if (error) throw error;

  return (data || []).map((r: any) => ({
    id: r.id,
    title: r.title,
    type: r.type,
    weekday: r.weekday,
    date: r.date,
    time: r.time
  }));
};

export const fetchAssignmentsV2 = async (
  ministryId: string,
  orgId: string,
  monthStr: string
): Promise<AssignmentV2[]> => {
  if (!ministryId || ministryId.length !== 36 || !orgId || orgId.length !== 36) {
    return []; // retorna array vazio sem lancar erro
  }
  const sb = getSupabase();
  if (!sb) throw new Error("NO_SUPABASE");

  // Lógica para obter o primeiro e último dia do mês (assumindo formato YYYY-MM)
  const [year, month] = monthStr.split('-');
  const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
  const startDate = `${monthStr}-01`;
  const endDate = `${monthStr}-${lastDay}`;

  const { data, error } = await sb
    .from("schedule_assignments")
    .select('id,event_rule_id,event_date,role,member_id,confirmed,profiles(name)') // CORREÇÃO: Select atualizado
    .eq("ministry_id", ministryId)
    .eq("organization_id", orgId)
    .gte("event_date", startDate) // Substitui o .like()
    .lte("event_date", endDate);  // Substitui o .like()

  if (error) throw error;

  return (data || []).map((a: any) => ({
    id: a.id,
    event_rule_id: a.event_rule_id,
    event_date: a.event_date?.slice(0, 10),
    role: a.role,
    member_id: a.member_id,
    confirmed: a.confirmed,
    event_key: a.event_rule_id // Mapeamento para compatibilidade de UI
  }));
};

export const fetchMembersV2 = async (
  ministryId: string,
  orgId: string
): Promise<MemberV2[]> => {
  if (!ministryId || ministryId.length !== 36 || !orgId || orgId.length !== 36) {
    return []; // retorna array vazio sem lancar erro
  }
  const sb = getSupabase();
  if (!sb) throw new Error("NO_SUPABASE");

  const { data, error } = await sb
    .from("ministry_members")
    .select("id, profile_id, functions, profiles(id, name, avatar_url)")
    .eq("ministry_id", ministryId);

  if (error) throw error;

  return (data || []).map((m: any) => {
    const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    const cleanFunctions = (m.functions || []).filter((r: string) => !r.startsWith('__vocal_count:'));
    return {
      id: p?.id || m.profile_id, // MUST be profile_id for schedule_assignments
      profile_id: p?.id || m.profile_id,
      name: p?.name || "Desconhecido",
      avatar_url: p?.avatar_url,
      ministry_functions: cleanFunctions
    };
  }).filter((m: any) => m.id);
};

export const fetchMinistryRoles = async (
  ministryId: string,
  orgId: string
): Promise<string[]> => {
  if (!ministryId || ministryId.length !== 36 || !orgId || orgId.length !== 36) {
    return []; // retorna array vazio sem lancar erro
  }
  const sb = getSupabase();
  if (!sb) throw new Error("NO_SUPABASE");

  const { data, error } = await sb
    .from("ministry_settings")
    .select("roles")
    .eq("ministry_id", ministryId)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (error) throw error;

  if (data?.roles && data.roles.length > 0) {
      return data.roles;
  }

  // Fallback: buscar funções únicas dos membros
  const { data: members } = await sb
    .from('ministry_members')
    .select('functions')
    .eq('ministry_id', ministryId);

  const allRoles = members?.flatMap((m: any) => m.functions || []) || [];
  return [...new Set(allRoles)].filter(r => Boolean(r)) as string[];
};

export const saveAssignmentV2 = async (
  ministryId: string,
  orgId: string,
  payload: {
    event_rule_id: string;
    event_date: string;
    role: string;
    member_id: string | null;
  }
) => {
  const sb = getSupabase();
  if (!sb) throw new Error("NO_SUPABASE");

  const { data, error } = await sb
    .from("schedule_assignments")
    .upsert(
      {
        organization_id: orgId,
        ministry_id: ministryId,
        event_rule_id: payload.event_rule_id,
        event_date: payload.event_date,
        role: payload.role,
        member_id: payload.member_id,
        confirmed: false
      },
      {
        onConflict: "organization_id,ministry_id,event_rule_id,event_date,role"
      }
    )
    .select();

  if (error) throw error;
};

export const removeAssignmentV2 = async (
  ministryId: string,
  orgId: string,
  key: {
    event_rule_id: string;
    event_date: string;
    role: string;
  }
) => {
  const sb = getSupabase();
  if (!sb) throw new Error("NO_SUPABASE");

  const { error } = await sb
    .from("schedule_assignments")
    .delete()
    .eq("organization_id", orgId)
    .eq("ministry_id", ministryId)
    .eq("event_rule_id", key.event_rule_id)
    .eq("event_date", key.event_date)
    .eq("role", key.role);

  if (error) throw error;
};

// Helper Local Date (YYYY-MM-DD) sem UTC shift
const localDateString = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const generateOccurrencesV2 = (
  rules: EventRuleV2[],
  year: number,
  month: number
): OccurrenceV2[] => {
  const occurrences: OccurrenceV2[] = [];
  
  // Noon strategy to avoid DST issues
  const start = new Date(year, month - 1, 1, 12, 0, 0);
  const end = new Date(year, month, 0, 12, 0, 0);

  for (const rule of rules) {
    if (rule.type === "single" && rule.date) {
      const d = new Date(rule.date + "T12:00:00");
      if (d.getFullYear() === year && d.getMonth() + 1 === month) {
        occurrences.push({
          ruleId: rule.id,
          date: rule.date,
          time: rule.time,
          title: rule.title,
          iso: `${rule.date}T${rule.time}`
        });
      }
    }

    if (rule.type === "weekly") {
      const cur = new Date(start);
      // Loop
      while (cur <= end) {
        // getDay() is local
        if (cur.getDay() === rule.weekday) {
          const dateStr = localDateString(cur);
          
          occurrences.push({
            ruleId: rule.id,
            date: dateStr,
            time: rule.time,
            title: rule.title,
            iso: `${dateStr}T${rule.time}`
          });
        }
        cur.setDate(cur.getDate() + 1);
      }
    }
  }

  return occurrences.sort((a, b) => a.iso.localeCompare(b.iso));
};

export const fetchNextEventCardData = async (
    ministryId: string,
    orgId: string
): Promise<{ event: any; members: any[] } | null> => {
    const sb = getSupabase();
    if (!sb || !ministryId || !orgId) return null;

    // 1. Ampliar a janela de busca
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = localDateString(sevenDaysAgo);

    // Buscar assignments a partir de 7 dias atrás
    const { data: assignmentsData } = await sb
        .from("schedule_assignments")
        .select("id, event_rule_id, event_date, role, member_id, confirmed")
        .eq("ministry_id", ministryId)
        .eq("organization_id", orgId)
        .gte("event_date", sevenDaysAgoStr);

    const exclusions = new Set(
        assignmentsData
            ?.filter(a => a.role === '__EVENT_EXCLUDED__')
            .map(a => `${a.event_rule_id}|${a.event_date?.slice(0, 10)}`) || []
    );

    // Buscar regras para saber o horário e título
    const { data: rules } = await sb.from('event_rules')
        .select('id, title, type, weekday, date, time')
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId)
        .eq('active', true);

    if (!rules || rules.length === 0) return null;
    const rulesMap = new Map(rules.map(r => [r.id, r]));

    // Agrupar por evento
    const groups: Record<string, any> = {};
    assignmentsData?.forEach(a => {
        const dateStr = a.event_date?.slice(0, 10);
        const key = `${a.event_rule_id}|${dateStr}`;
        if (!groups[key]) {
            const rule = rulesMap.get(a.event_rule_id);
            if (rule) {
                const iso = `${dateStr}T${rule.time}`;
                groups[key] = {
                    rule,
                    date: dateStr,
                    iso,
                    dateObj: new Date(iso),
                    assignments: [],
                    excluded: false
                };
            }
        }
        if (groups[key]) {
            if (a.role === '__EVENT_EXCLUDED__') {
                groups[key].excluded = true;
            } else {
                groups[key].assignments.push(a);
            }
        }
    });

    const now = Date.now();
    const candidates = Object.values(groups)
        .filter((c: any) => !c.excluded && c.dateObj.getTime() >= now - 5 * 60 * 60 * 1000)
        .sort((a: any, b: any) => a.dateObj.getTime() - b.dateObj.getTime());

    let nextEvent = candidates[0];

    // 4. Se ainda retornar null (nenhum assignment futuro), buscar o próximo evento pelas event_rules
    if (!nextEvent) {
        const year = new Date().getFullYear();
        const month = new Date().getMonth() + 1;
        const occurrences = generateOccurrencesV2(rules as any, year, month);
        
        const nextMonth = month === 12 ? 1 : month + 1;
        const nextYear = month === 12 ? year + 1 : year;
        const occurrencesNext = generateOccurrencesV2(rules as any, nextYear, nextMonth);
        
        const allOccurrences = [...occurrences, ...occurrencesNext];
        const sortedOccurrences = allOccurrences.sort((a, b) => a.iso.localeCompare(b.iso));
        
        const nextOcc = sortedOccurrences.find(occ => {
            const eventTime = new Date(occ.iso).getTime();
            const key = `${occ.ruleId}|${occ.date}`;
            return !exclusions.has(key) && eventTime >= now - 5 * 60 * 60 * 1000;
        });

        if (!nextOcc) return null;

        nextEvent = {
            rule: rulesMap.get(nextOcc.ruleId),
            date: nextOcc.date,
            iso: nextOcc.iso,
            assignments: []
        };
    }

    // 3. Corrigir o join de profiles
    const membersData = nextEvent.assignments;
    const memberIds = membersData?.map((m: any) => m.member_id).filter(Boolean) || [];
    const { data: profilesData } = await sb
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', memberIds);
    const profilesMap = new Map(profilesData?.map((p: any) => [p.id, p]));

    const nextEventCompat = {
        ...nextEvent,
        assignment: nextEvent.assignments[0] || { event_rule_id: nextEvent.rule.id, event_date: nextEvent.date }
    };

    const members = (membersData || []).map((m: any) => {
        const profile = profilesMap.get(m.member_id);
        return {
            role: m.role,
            memberId: m.member_id,
            name: profile?.name || 'Membro',
            avatarUrl: profile?.avatar_url,
            confirmed: m.confirmed,
            key: `${nextEventCompat.assignment.event_rule_id}|${nextEventCompat.assignment.event_date}|${m.role}`
        };
    });

    return {
        event: {
            id: nextEvent.rule.id,
            title: nextEvent.rule.title,
            date: nextEvent.date,
            time: nextEvent.rule.time,
            iso: nextEvent.iso,
            type: nextEvent.rule.type
        },
        members
    };
};

export const fetchNextEventTeam = async (ministryId: string, orgId: string) => {
    const data = await fetchNextEventCardData(ministryId, orgId);
    if (!data) return { date: null, team: [] };
    
    return {
        date: data.event.date,
        team: data.members.map(m => ({
            role: m.role,
            memberId: m.id,
            memberName: m.name
        }))
    };
};