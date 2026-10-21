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

export const fetchAvailabilityForEditor = async (ministryId: string, orgId: string): Promise<{
  availability: Record<string, Record<string, string>>;
  memberNotes: Record<string, string>;
  availabilityRaw: Record<string, string[]>;
}> => {
  const sb = getSupabase();
  if (!sb || ministryId.length !== 36 || orgId.length !== 36) return { availability: {}, memberNotes: {}, availabilityRaw: {} };
  const { data } = await sb.from('member_availability')
    .select('user_id, available_date, note')
    .eq('ministry_id', ministryId)
    .eq('organization_id', orgId);

  // Novo modelo: registros representam AUSENCIAS (opt-out).
  // note='BLK' -> mes todo indisponivel
  // note='FREE' -> mes todo disponivel (sem ausencias)
  // note='M'|'N' -> apenas manha ou noite indisponivel
  // note=null -> dia todo indisponivel
  // note='NOTE:...' -> observacao geral
  const rawMap: Record<string, string[]> = {};
  const memberNotes: Record<string, string> = {};

  data?.forEach((row: any) => {
    if (!rawMap[row.user_id]) rawMap[row.user_id] = [];

    if (row.note === 'BLK') {
      rawMap[row.user_id].push(`${row.available_date.substring(0, 7)}-BLK`);
      return;
    }
    if (row.note === 'FREE') {
      rawMap[row.user_id].push(`${row.available_date.substring(0, 7)}-FREE`);
      return;
    }
    if (row.note && row.note.startsWith('NOTE:')) {
      const actualNote = row.note.substring(5).trim();
      if (!/^\d{2}:\d{2}(:\d{2})?$/.test(actualNote)) {
        const noteKey = `${row.user_id}_${row.available_date.substring(0, 7)}`;
        memberNotes[noteKey] = actualNote;
      }
      return;
    }
    const baseDate = row.available_date;
    if (row.note && ['M', 'N'].includes(row.note)) {
      rawMap[row.user_id].push(`${baseDate}_${row.note}`);
    } else {
      rawMap[row.user_id].push(baseDate);
    }
  });

  Object.keys(rawMap).forEach(uid => { rawMap[uid] = [...new Set(rawMap[uid])]; });

  // Converte o array de ausencias para o formato legado do motor de escala:
  // { userId: { 'YYYY-MM-DD': 'all' | 'M' | 'N' } }
  // Presenca de uma data = disponivel; ausencia da chave = indisponivel.
  // BLK = mapa vazio para aquele mes.
  // FREE ou sem dados = todos os dias do mes marcados como 'all'.
  const legacyMap: Record<string, Record<string, string>> = {};

  // Descobre todos os usuarios com algum registro
  const allUserIds = [...new Set([...Object.keys(rawMap)])];

  for (const userId of allUserIds) {
    const absences = rawMap[userId] || [];
    legacyMap[userId] = {};

    // Descobre todos os meses mencionados
    const months = [...new Set(
      absences
        .map(d => d.substring(0, 7))
        .filter(m => /^\d{4}-\d{2}$/.test(m))
    )];

    for (const month of months) {
      const isBlocked = absences.includes(`${month}-BLK`);
      if (isBlocked) {
        // Mes inteiro indisponivel: marca especial no legado
        legacyMap[userId][`${month}-01-BLK`] = 'BLK';
        continue;
      }

      // Preenche todos os dias do mes como disponivel ('all')
      const [yearStr, monthStr] = month.split('-');
      const yr = parseInt(yearStr);
      const mo = parseInt(monthStr);
      const daysInMonth = new Date(yr, mo, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const dateKey = `${month}-${String(d).padStart(2, '0')}`;
        legacyMap[userId][dateKey] = 'all';
      }

      // Remove/ajusta as ausencias especificas
      for (const absence of absences) {
        if (!absence.startsWith(month) || absence.endsWith('-BLK') || absence.endsWith('-FREE')) continue;
        if (absence.endsWith('_M')) {
          const dateKey = absence.slice(0, 10);
          if (legacyMap[userId][dateKey] === 'all') {
            legacyMap[userId][dateKey] = 'N'; // So noite disponivel
          } else if (legacyMap[userId][dateKey] === 'M') {
            delete legacyMap[userId][dateKey]; // M e N ausentes = dia todo ausente
          }
        } else if (absence.endsWith('_N')) {
          const dateKey = absence.slice(0, 10);
          if (legacyMap[userId][dateKey] === 'all') {
            legacyMap[userId][dateKey] = 'M'; // So manha disponivel
          } else if (legacyMap[userId][dateKey] === 'N') {
            delete legacyMap[userId][dateKey]; // N e M ausentes = dia todo ausente
          }
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(absence)) {
          delete legacyMap[userId][absence]; // Dia inteiro ausente
        }
      }
    }
  }

  return { availability: legacyMap, memberNotes, availabilityRaw: rawMap };
};


export const fetchGlobalConflictsV2 = async (ministryId: string, orgId: string, month: string) => {
  const sb = getSupabase();
  if (!sb || ministryId.length !== 36) return {};
  
  const [yearStr, mStr] = month.split('-');
  const year = parseInt(yearStr);
  const m = parseInt(mStr);
  const lastDay = new Date(year, m, 0).getDate();
  const startDate = `${month}-01`;
  const endDate = `${month}-${lastDay}`;

  const { data } = await sb.from('schedule_assignments')
    .select('member_id, ministry_id, event_date, role, profiles(name)')
    .eq('organization_id', orgId)
    .neq('ministry_id', ministryId)
    .gte('event_date', startDate)
    .lte('event_date', endDate);

  const conflicts: Record<string, { date: string, ministryId: string, role: string }[]> = {};
  data?.forEach((row: any) => {
    const memberId = row.member_id;
    if (memberId) {
      if (!conflicts[memberId]) conflicts[memberId] = [];
      conflicts[memberId].push({
        date: row.event_date,
        ministryId: row.ministry_id,
        role: row.role
      });
    }
  });
  return conflicts;
};

export const fetchConflictRules = async (ministryId: string, orgId: string) => {
  const sb = getSupabase();
  if (!sb || ministryId.length !== 36) return { blockGroups: [], allowExceptions: [], memberBlocks: [], memberPrefers: [], eventRoleExcludes: {} };
  const { data } = await sb.from('schedule_conflict_rules')
    .select('rule_type, functions, label')
    .eq('ministry_id', ministryId)
    .eq('organization_id', orgId);

  const blockGroups = data?.filter((r:any) => r.rule_type === 'block_group' && !r.label?.startsWith('[MEMBER_BLOCK]') && !r.label?.startsWith('[EVENT_ROLE_EXCLUDE]')).map((r:any) => r.functions) || [];
  const allowExceptions = data?.filter((r:any) => r.rule_type === 'allow_exception' && !r.label?.startsWith('[MEMBER_PREFER]')).map((r:any) => r.functions) || [];
  
  const memberBlocks = data?.filter((r:any) => r.label?.startsWith('[MEMBER_BLOCK]')).map((r:any) => r.functions.map((f: string) => f.replace('member:', ''))) || [];
  const memberPrefers = data?.filter((r:any) => r.label?.startsWith('[MEMBER_PREFER]')).map((r:any) => r.functions.map((f: string) => f.replace('member:', ''))) || [];

  const eventRoleExcludes: Record<string, string[]> = {};
  data?.filter((r: any) => r.label?.startsWith('[EVENT_ROLE_EXCLUDE]')).forEach((r: any) => {
    const match = r.label?.match(/event_rule_id=([\/\w-]+)/);
    if (match?.[1]) {
      eventRoleExcludes[match[1]] = r.functions || [];
    }
  });

  return {
    blockGroups,
    allowExceptions,
    memberBlocks,
    memberPrefers,
    eventRoleExcludes
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
    const cleanFunctions = (m.functions || []).filter((r: string) => !r.startsWith('__vocal_count:') && !r.startsWith('__dance_count:'));
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

export const confirmAssignmentV2 = async (
  ministryId: string,
  orgId: string,
  payload: {
    event_rule_id: string;
    event_date: string;
    role: string;
  }
) => {
  const sb = getSupabase();
  if (!sb) throw new Error("NO_SUPABASE");

  const { data, error } = await sb
    .from("schedule_assignments")
    .update({ confirmed: true })
    .match({
      organization_id: orgId,
      ministry_id: ministryId,
      event_rule_id: payload.event_rule_id,
      event_date: payload.event_date,
      role: payload.role
    });

  if (error) throw error;
  return data;
};

export const togglePublishScheduleV2 = async (
  ministryId: string,
  orgId: string,
  monthStr: string,
  isPublished: boolean,
  fallbackRuleId?: string
) => {
  const sb = getSupabase();
  if (!sb) throw new Error("NO_SUPABASE");

  if (isPublished) {
    let ruleId = fallbackRuleId;
    if (!ruleId) {
      const { data: firstRule } = await sb
        .from("event_rules")
        .select("id")
        .eq("organization_id", orgId)
        .eq("ministry_id", ministryId)
        .eq("active", true)
        .limit(1)
        .maybeSingle();
      ruleId = firstRule?.id;
    }
    if (!ruleId) {
      const { data: anyRule } = await sb
        .from("event_rules")
        .select("id")
        .eq("organization_id", orgId)
        .eq("ministry_id", ministryId)
        .limit(1)
        .maybeSingle();
      ruleId = anyRule?.id;
    }

    if (!ruleId) {
      throw new Error("Cadastre ao menos um evento ou culto antes de liberar a escala.");
    }

    const { error } = await sb.from("schedule_assignments").upsert(
      {
        organization_id: orgId,
        ministry_id: ministryId,
        event_rule_id: ruleId,
        event_date: `${monthStr}-01`,
        role: "__PUBLISHED__",
        member_id: null,
        confirmed: false
      },
      { onConflict: "organization_id,ministry_id,event_rule_id,event_date,role" }
    );
    if (error) throw error;
  } else {
    const [year, month] = monthStr.split('-');
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const startDate = `${monthStr}-01`;
    const endDate = `${monthStr}-${lastDay}`;

    const { error } = await sb.from("schedule_assignments")
      .delete()
      .eq("organization_id", orgId)
      .eq("ministry_id", ministryId)
      .eq("role", "__PUBLISHED__")
      .gte("event_date", startDate)
      .lte("event_date", endDate);
    if (error) throw error;
  }
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

    // 1. Buscar regras de eventos ativas do ministério
    const { data: rules } = await sb.from('event_rules')
        .select('id, title, type, weekday, date, time')
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId)
        .eq('active', true);

    if (!rules || rules.length === 0) return null;
    const rulesMap = new Map(rules.map(r => [r.id, r]));

    // 2. Buscar exclusões de eventos (__EVENT_EXCLUDED__)
    const { data: exclusionsData } = await sb
        .from("schedule_assignments")
        .select("event_rule_id, event_date")
        .eq("ministry_id", ministryId)
        .eq("organization_id", orgId)
        .eq("role", "__EVENT_EXCLUDED__");

    const exclusions = new Set(
        exclusionsData?.map(a => `${a.event_rule_id}|${a.event_date?.slice(0, 10)}`) || []
    );

    // 3. Gerar ocorrências para o mês atual, próximo mês e mês subsequente
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const occurrencesCurrent = generateOccurrencesV2(rules as any, currentYear, currentMonth);
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
    const occurrencesNext = generateOccurrencesV2(rules as any, nextYear, nextMonth);

    const monthAfter = nextMonth === 12 ? 1 : nextMonth + 1;
    const yearAfter = nextMonth === 12 ? nextYear + 1 : nextYear;
    const occurrencesAfter = generateOccurrencesV2(rules as any, yearAfter, monthAfter);

    const allOccurrences = [...occurrencesCurrent, ...occurrencesNext, ...occurrencesAfter]
        .sort((a, b) => a.iso.localeCompare(b.iso));

    // 4. Encontrar o próximo evento cronológico que não foi excluído
    // Considera evento ativo até 2 horas após o horário de início
    const nowTime = now.getTime();
    const nextOcc = allOccurrences.find(occ => {
        const key = `${occ.ruleId}|${occ.date}`;
        if (exclusions.has(key)) return false;

        const [y, m, d] = occ.date.split("-").map(Number);
        const [hh, mm] = (occ.time || "00:00").split(":").map(Number);
        const eventTimestamp = new Date(y, m - 1, d, hh || 0, mm || 0, 0).getTime();
        return eventTimestamp >= nowTime - 2 * 60 * 60 * 1000;
    });

    if (!nextOcc) return null;

    // 5. Verificar se o mês deste evento está liberado/publicado
    const eventMonthStr = nextOcc.date.slice(0, 7);
    const { data: publishedRows } = await sb
        .from("schedule_assignments")
        .select("id")
        .eq("ministry_id", ministryId)
        .eq("organization_id", orgId)
        .eq("role", "__PUBLISHED__")
        .gte("event_date", `${eventMonthStr}-01`)
        .lte("event_date", `${eventMonthStr}-31`)
        .limit(1);

    const isPublished = Boolean(publishedRows && publishedRows.length > 0);

    // 6. Buscar atribuições reais deste evento
    const { data: assignments } = await sb
        .from("schedule_assignments")
        .select("id, event_rule_id, event_date, role, member_id, confirmed")
        .eq("ministry_id", ministryId)
        .eq("organization_id", orgId)
        .eq("event_rule_id", nextOcc.ruleId)
        .eq("event_date", nextOcc.date)
        .neq("role", "__EVENT_EXCLUDED__")
        .neq("role", "__PUBLISHED__");

    // 7. Se a escala estiver liberada, carregar os membros escalados
    let members: any[] = [];
    if (isPublished && assignments && assignments.length > 0) {
        const memberIds = assignments.map(a => a.member_id).filter(Boolean);
        if (memberIds.length > 0) {
            const { data: profilesData } = await sb
                .from('profiles')
                .select('id, name, avatar_url')
                .in('id', memberIds);

            const profilesMap = new Map(profilesData?.map(p => [p.id, p]));

            members = assignments
                .filter(a => a.member_id)
                .map(a => {
                    const profile = profilesMap.get(a.member_id);
                    return {
                        role: a.role,
                        memberId: a.member_id,
                        name: profile?.name || 'Membro',
                        avatarUrl: profile?.avatar_url,
                        confirmed: a.confirmed,
                        key: `${nextOcc.ruleId}|${nextOcc.date}|${a.role}`
                    };
                });
        }
    }

    const rule = rulesMap.get(nextOcc.ruleId);
    return {
        event: {
            id: nextOcc.ruleId,
            title: nextOcc.title,
            date: nextOcc.date,
            time: nextOcc.time,
            iso: nextOcc.iso,
            type: rule?.type || 'weekly'
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
            memberId: m.memberId, // era m.id (undefined) — bug de mapeamento corrigido
            memberName: m.name
        }))
    };
};