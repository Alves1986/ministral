// aiScheduleUtils.ts — Constrói o prompt de GERAÇÃO DE ESCALA para a IA e
// faz o parse da resposta. Puro (sem rede), para ser usado tanto no
// aiOrchestrator (dev) quanto na função Vercel api/ai/schedule (produção).

export interface OccInput {
  date: string;
  time: string;
  ruleId: string;
  title: string;
}
export interface MemberInput {
  id: string;
  name: string;
  functions?: string[];
}
export interface ExistingAssignmentInput {
  event_rule_id: string;
  event_date: string;
  role: string;
  member_id?: string;
}
export interface ScheduleInput {
  occurrences: OccInput[];
  roles: string[];
  members: MemberInput[];
  availability: Record<string, unknown>; // memberId -> string[] | {date:status}
  existingAssignments: ExistingAssignmentInput[];
  rules?: {
    blockGroups?: string[][];
    allowExceptions?: string[][];
    memberBlocks?: string[][];
    memberPrefers?: string[][];
  };
  eventRoleExcludes?: Record<string, string[]>;
  memberNotes?: Record<string, string>;
  mode?: "fill" | "rebalance";
}

/**
 * Normaliza disponibilidade para { memberId: string[] } de datas indisponiveis.
 * No novo modelo opt-out, o array contém AUSENCIAS (datas que o membro NAO pode).
 * Para o formato legado objeto (presenca = disponivel), inverte para extrair ausencias.
 */
function normalizeAvailability(input: ScheduleInput): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const m of input.members || []) {
    const raw = input.availability?.[m.id];
    let absences: string[] = [];
    if (Array.isArray(raw)) {
      // Formato array: ja sao ausencias
      absences = raw.map((d) => String(d));
    } else if (raw && typeof raw === "object") {
      // Formato objeto legado (convertido por fetchAvailabilityForEditor):
      // chaves = dias disponiveis. Nao extraimos ausencias aqui — o motor ja sabe lidar.
      absences = [];
    }
    out[m.id] = absences;
  }
  return out;
}

/** Monta o prompt completo para a IA gerar as atribuições de escala. */
export function buildSchedulePrompt(input: ScheduleInput): string {
  const availByMember = normalizeAvailability(input);

  const occurrencesTxt = (input.occurrences || [])
    .map((o) => `- ${o.date} às ${o.time} (regra ${o.ruleId}) — ${o.title}`)
    .join("\n");

  const membersTxt = (input.members || [])
    .map((m) => {
      const funcs = (m.functions || []).join(", ") || "sem função";
      const dates = availByMember[m.id] || [];
      const availTxt =
        dates.length > 0
          ? dates.slice(0, 40).join(", ")
          : "sem disponibilidade informada";
      return `- ${m.name} (id: ${m.id}) — funções: [${funcs}] — disponível em: ${dates.length > 1 ? dates.length + " datas (" : ""}${availTxt}${dates.length > 1 ? ")" : ""}`;
    })
    .join("\n") || "- nenhum membro";

  const existingTxt = (input.existingAssignments || [])
    .filter((a) => a.member_id)
    .map((a) => `${a.event_date} / regra ${a.event_rule_id} / ${a.role} -> membro ${a.member_id}`)
    .join("\n") || "nenhuma escala preenchida ainda";

  const rules = input.rules || {};
  const rulesTxt: string[] = [];
  if ((rules.blockGroups || []).length)
    rulesTxt.push(`- Grupo de bloqueio (não escalar na mesma função em conflito): ${JSON.stringify(rules.blockGroups)}`);
  if ((rules.allowExceptions || []).length)
    rulesTxt.push(`- Exceções (permitem sobrepor bloqueio): ${JSON.stringify(rules.allowExceptions)}`);
  if ((rules.memberBlocks || []).length)
    rulesTxt.push(`- Bloqueio entre membros (não escalar juntos): ${JSON.stringify(rules.memberBlocks)}`);
  if ((rules.memberPrefers || []).length)
    rulesTxt.push(`- Preferência de servir juntos: ${JSON.stringify(rules.memberPrefers)}`);

  const eventRoleExcludesTxt = input.eventRoleExcludes
    ? Object.entries(input.eventRoleExcludes)
        .map(([ruleId, rolesArr]) => `- regra ${ruleId}: NÃO usar funções [${rolesArr.join(", ")}]`)
        .join("\n")
    : "";

  return `
Você é o ASSISTENTE DE ESCALA do ministério. Sua tarefa é preencher as escalas vazias
escolhendo o melhor membro para cada função, respeitando a disponibilidade e as regras.

EVENTOS DO MÊS (data | hora | regra | evento):
${occurrencesTxt}

FUNÇÕES DO MINISTÉRIO:
${(input.roles || []).join(", ")}

MEMBROS DISPONÍVEIS (nome | id | funções | disponibilidade):
${membersTxt}

ESCALAS JÁ PREENCHIDAS (não altere estas):
${existingTxt}

REGRAS DE CONFLITO:
${rulesTxt.length ? rulesTxt.join("\n") : "Sem regras de conflito cadastradas."}
${eventRoleExcludesTxt ? `RESTRIÇÕES POR EVENTO:\n${eventRoleExcludesTxt}` : ""}

INSTRUÇÕES:
1. Para cada evento do mês, para cada função/role, verifique se já está preenchido.
   Só proponha preenchimento para funções AINDA VAZIAS.
2. Escolha o membro que: (a) tem a função na sua lista de funções; (b) está disponível na data;
   (c) respeita as regras de conflito (bloqueios, grupos, membros bloqueados juntos);
   (d) se possível, evita sobrecarregar quem já tem muitas escalas.
3. Nunca use um membro em dois eventos na mesma data/horário com funções conflitantes.
4. Retorne APENAS um JSON array (sem markdown, sem explicações), onde cada item é:
   { "event_rule_id": "<ruleId>", "event_date": "YYYY-MM-DD", "role": "<Função>", "member_id": "<membroId>" }
5. Se não houver vagas a preencher, retorne [].`;
}

/** Extrai um array de atribuições válido da resposta de texto da IA. */
export function extractAssignments(text: string): Array<{
  event_rule_id: string;
  event_date: string;
  role: string;
  member_id: string;
}> {
  if (!text) return [];
  // Remove markdown code fences
  const cleaned = typeof text === "string" ? text.trim() : String(text);
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenceMatch ? fenceMatch[1] : cleaned;

  let arr: any[] = [];
  try {
    const parsed = JSON.parse(candidate);
    if (Array.isArray(parsed)) arr = parsed;
    else if (parsed && Array.isArray(parsed.assignments)) arr = parsed.assignments;
  } catch {
    // tenta extrair o primeiro array [...]
    const firstBracket = candidate.indexOf("[");
    const lastBracket = candidate.lastIndexOf("]");
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      try {
        arr = JSON.parse(candidate.slice(firstBracket, lastBracket + 1));
      } catch {
        arr = [];
      }
    }
  }

  return (Array.isArray(arr) ? arr : [])
    .filter(
      (a: any) =>
        a &&
        typeof a.event_rule_id === "string" &&
        typeof a.event_date === "string" &&
        typeof a.role === "string" &&
        (typeof a.member_id === "string" || typeof a.member_id === "number"),
    )
    .map((a: any) => ({
      event_rule_id: String(a.event_rule_id),
      event_date: String(a.event_date).slice(0, 10),
      role: String(a.role),
      member_id: String(a.member_id),
    }));
}

// ─── Validador compartilhado de atribuições ────────────────────────────

export type ValidationError = {
  type:
    | "UNKNOWN_EVENT"
    | "INVALID_ROLE"
    | "INELIGIBLE_MEMBER"
    | "UNAVAILABLE"
    | "ROLE_EXCLUDED"
    | "DUPLICATE"
    | "SLOT_FILLED";
  message: string;
};

/**
 * Valida uma única atribuição contra o contexto da escala.
 * Retorna null se válida, ou um ValidationError se inválida.
 */
export function validateAssignment(
  assignment: {
    event_rule_id: string;
    event_date: string;
    role: string;
    member_id: string;
  },
  input: ScheduleInput,
): ValidationError | null {
  const { event_rule_id, event_date, role, member_id } = assignment;

  // 1. Evento inexistente
  const occurrenceExists = (input.occurrences || []).some(
    (o) => o.ruleId === event_rule_id && o.date === event_date,
  );
  if (!occurrenceExists) {
    return {
      type: "UNKNOWN_EVENT",
      message: `Evento não encontrado: regra ${event_rule_id} em ${event_date}.`,
    };
  }

  // 2. Função inválida (não existe no ministério)
  if (!(input.roles || []).includes(role)) {
    return {
      type: "INVALID_ROLE",
      message: `Função "${role}" não existe no ministério.`,
    };
  }

  // 3. Membro inelegível (não encontrado na lista)
  const member = (input.members || []).find((m) => m.id === member_id);
  if (!member) {
    return {
      type: "INELIGIBLE_MEMBER",
      message: `Membro ${member_id} não encontrado na lista de membros.`,
    };
  }

  // 4. Membro não tem a função atribuída
  if (member.functions && member.functions.length > 0 && !member.functions.includes(role)) {
    return {
      type: "INELIGIBLE_MEMBER",
      message: `${member.name} não possui a função "${role}".`,
    };
  }

  // 5. Indisponibilidade — suporta ambos os formatos:
  //    - Array (opt-out): marcadores de ausencia. Ausencia na data = indisponivel.
  //    - Objeto legado: chaves sao dias disponiveis. Ausencia da chave = indisponivel.
  const avail = input.availability?.[member_id];
  const occ = (input.occurrences || []).find(
    (o) => o.ruleId === event_rule_id && o.date === event_date
  );
  if (avail !== undefined && occ) {
    if (Array.isArray(avail)) {
      // Formato array de ausencias
      const month = event_date.substring(0, 7);
      if (avail.includes(`${month}-BLK`)) {
        return { type: "UNAVAILABLE", message: `${member.name} marcou o mês inteiro como indisponível.` };
      }
      // FREE ou sem dados = disponivel
      if (!avail.includes(`${month}-FREE`) && avail.length > 0) {
        if (avail.includes(event_date)) {
          return { type: "UNAVAILABLE", message: `${member.name} não está disponível em ${event_date}.` };
        }
        const hour = parseInt((occ.time || '00:00').split(':')[0], 10);
        const isMorning = hour < 12;
        if (isMorning && avail.includes(`${event_date}_M`)) {
          return { type: "UNAVAILABLE", message: `${member.name} não está disponível pela manhã em ${event_date}.` };
        }
        if (!isMorning && avail.includes(`${event_date}_N`)) {
          return { type: "UNAVAILABLE", message: `${member.name} não está disponível à noite em ${event_date}.` };
        }
      }
    } else if (typeof avail === 'object') {
      // Formato objeto legado: presenca de chave = disponivel
      const availObj = avail as Record<string, string>;
      const month = event_date.substring(0, 7);
      // Checar BLK
      if (availObj[`${month}-01-BLK`] === 'BLK' || availObj[`${month}-01`] === 'BLK') {
        return { type: "UNAVAILABLE", message: `${member.name} marcou o mês inteiro como indisponível.` };
      }
      const dayVal = availObj[event_date];
      // Tem dados do mes mas o dia nao esta no mapa = ausencia
      const hasDaysInMonth = Object.keys(availObj).some(k => k.startsWith(month) && !k.includes('BLK'));
      if (hasDaysInMonth && !dayVal) {
        return { type: "UNAVAILABLE", message: `${member.name} não está disponível em ${event_date}.` };
      }
      if (dayVal && dayVal !== 'all' && dayVal !== 'unavailable') {
        const hour = parseInt((occ.time || '00:00').split(':')[0], 10);
        const eventPeriod = hour < 12 ? 'M' : 'N';
        const weekday = new Date(event_date + 'T12:00:00').getDay();
        if (weekday === 0 && dayVal !== eventPeriod) {
          return { type: "UNAVAILABLE", message: `${member.name} não está disponível no período deste evento (${event_date}).` };
        }
      }
    }
  }

  // 6. Exclusão de função por evento
  if (input.eventRoleExcludes?.[event_rule_id]?.includes(role)) {
    return {
      type: "ROLE_EXCLUDED",
      message: `Função "${role}" está excluída para o evento (regra ${event_rule_id}).`,
    };
  }

  // 7. Duplicidade (mesmo membro, mesma data, mesma função, mesmo evento)
  const isDuplicate = (input.existingAssignments || []).some(
    (a) =>
      a.event_rule_id === event_rule_id &&
      a.event_date === event_date &&
      a.role === role &&
      a.member_id === member_id,
  );
  if (isDuplicate) {
    return {
      type: "DUPLICATE",
      message: `${member.name} já está escalado para "${role}" neste evento.`,
    };
  }

  // 8. Vaga já preenchida (outro membro já ocupa essa posição)
  const slotFilled = (input.existingAssignments || []).some(
    (a) =>
      a.event_rule_id === event_rule_id &&
      a.event_date === event_date &&
      a.role === role &&
      a.member_id &&
      a.member_id !== member_id,
  );
  if (slotFilled) {
    return {
      type: "SLOT_FILLED",
      message: `A vaga "${role}" em ${event_date} já está preenchida por outro membro.`,
    };
  }

  return null;
}

/**
 * Valida um array de atribuições e retorna os resultados.
 * Cada resultado contém a atribuição original e, se inválida, o erro.
 */
export function validateAssignments(
  assignments: Array<{
    event_rule_id: string;
    event_date: string;
    role: string;
    member_id: string;
  }>,
  input: ScheduleInput,
): Array<{
  assignment: (typeof assignments)[0];
  error: ValidationError | null;
}> {
  return assignments.map((assignment) => ({
    assignment,
    error: validateAssignment(assignment, input),
  }));
}