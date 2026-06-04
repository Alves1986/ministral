// services/aiOrchestrator.ts
// ─── Gemini API — nativa e otimizada ───────────────────────

function getApiKey(): string {
  if (typeof process !== 'undefined' && process.env) {
    // GEMINI_API_KEY tem prioridade (chave válida AIzaSy...)
    // VITE_GEMINI_API_KEY pode conter chaves de outras APIs (AQ.Ab8...)
    const primary = process.env.GEMINI_API_KEY || '';
    const fallback = process.env.VITE_GEMINI_API_KEY || '';
    if (primary.startsWith('AIzaSy')) return primary;
    if (fallback.startsWith('AIzaSy')) return fallback;
    return primary || fallback;
  }
  return '';
}

export enum AI_TASKS {
  MINISTRY_HEALTH  = 'MINISTRY_HEALTH',
  SCALE_ANALYSIS   = 'SCALE_ANALYSIS',
  GENERATE_NOTICE  = 'GENERATE_NOTICE',
  EXPLAIN_DECISION = 'EXPLAIN_DECISION',
  TEXT_REWRITE     = 'TEXT_REWRITE',
  SCALE_SUGGESTION = 'SCALE_SUGGESTION',
  MEMBER_ANALYSIS  = 'MEMBER_ANALYSIS',
  PREVENTIVE_ALERT = 'PREVENTIVE_ALERT',
  SCALE_GENERATION = 'SCALE_GENERATION'
}

export const AI_MODELS = [
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash (Recomendado)',
    description: 'Modelo rápido, estável e eficiente para análises e reescritas diárias.'
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash (Avançado)',
    description: 'Modelo avançado com maior capacidade de raciocínio.'
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro (Máxima Capacidade)',
    description: 'Excelente raciocínio lógico e maior capacidade de análise profunda.'
  },
  {
    id: 'gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash Lite (Econômico)',
    description: 'Opção leve e econômica para tarefas simples.'
  }
];

// exportação legada para compatibilidade
export const OPENROUTER_MODELS = AI_MODELS;
export const DEFAULT_MODEL = AI_MODELS[0].id;

const GLOBAL_PERSONALITY = `
Você é um especialista em gestão de ministérios e organização de equipes.
Seu foco é: organização, equilíbrio, clareza e decisões práticas.
Evite respostas genéricas. Sempre entregue sugestões aplicáveis.
Seja direto e estruturado.
`;

interface AIContext {
  organization_name: string;
  ministry_name: string;
  total_members: number;
  active_members: number;
  roles: string[];
  history?: unknown;
  current_event?: unknown;
}

const JSON_TASKS = new Set([
  AI_TASKS.MINISTRY_HEALTH,
  AI_TASKS.GENERATE_NOTICE,
  AI_TASKS.TEXT_REWRITE,
]);

const PROMPTS: Record<AI_TASKS, (data: any) => string> = {
  [AI_TASKS.MINISTRY_HEALTH]: (data) => `
    Analise a saúde do ministério com base nos dados fornecidos.
    DADOS: ${JSON.stringify(data)}
    REGRAS DE RESPOSTA:
    Retorne OBRIGATORIAMENTE um JSON puro seguindo a estrutura solicitada.
    ESTRUTURA:
    {
      "score": número de 0 a 100,
      "status": "otimo" | "bom" | "atencao" | "critico",
      "summary": "frase curta e direta descrevendo o estado geral",
      "alerts": ["lista de problemas detectados"],
      "suggestions": ["lista de sugestões práticas de melhoria"]
    }
  `,
  [AI_TASKS.SCALE_ANALYSIS]: (data) => `
    Analise a organização das escalas.
    Verifique: sobrecarga, repetição, falta de membros e equilíbrio geral.
    DADOS: ${JSON.stringify(data)}
    Retorne análise clara + melhorias.
    PADRÃO DE RESPOSTA:
    - Título
    - Pontos principais
    - Sugestões práticas (Markdown)
  `,
  [AI_TASKS.GENERATE_NOTICE]: (data) => `
    Crie um aviso unificado e organizado para o grupo do WhatsApp do ministério.
    DIRETRIZES:
    1. Trate todo evento como "Culto" no título da mensagem (ex: "Escala para o Culto - ${data.evento}").
    2. Liste os membros e suas funções de forma clara e visualmente agradável com emojis. ATENÇÃO: MOSTRE SOMENTE as funções e membros que estão na lista 'Membros e Funções'. Não invente funções secundárias e ignore qualquer função que não tenha um membro escalado.
    3. Inclua OBRIGATORIAMENTE ao final da mensagem o seguinte bloco de orientações:
    ⚠️ *Orientações:*
    1. Cheguem com 30 minutos de antecedência para check-list dos equipamentos.
    2. Caso haja algum imprevisto, comuniquem a liderança imediatamente.
    3. Não esqueça de Confirmar a escala realizando o check-in no aplicativo.
    Vamos juntos servir com excelência! 🚀
    INFORMAÇÕES:
    Evento: ${data.evento}
    Data: ${data.data}
    Horário: ${data.horario}
    Membros e Funções: ${data.funcoes}
    REGRAS DE RESPOSTA:
    Retorne APENAS um objeto JSON.
    ESTRUTURA:
    { "message": "Texto completo da mensagem formatado para WhatsApp (com quebras de linha e emojis)" }
  `,
  [AI_TASKS.EXPLAIN_DECISION]: (data) => `
    Explique de forma clara como a escala foi gerada.
    Inclua critérios, equilíbrio e limitações.
    DADOS: ${JSON.stringify(data)}
    PADRÃO DE RESPOSTA (Markdown):
    - Título
    - Critérios usados
    - Sugestões práticas
  `,
  [AI_TASKS.TEXT_REWRITE]: (data) => {
    const styles: Record<string, string> = {
      professional: "Reescreva o texto abaixo de forma formal, profissional e respeitosa.",
      exciting:     "Reescreva o texto abaixo de forma animada, motivadora e envolvente.",
      urgent:       "Reescreva o texto abaixo de forma urgente, direta e com senso de prioridade."
    };
    return `
      ${styles[data.tone as string] || styles.professional}
      TEXTO: "${data.text}"
      REGRAS:
      - Retorne APENAS um objeto JSON válido, sem explicações ou markdown externo.
      - A chave deve ser "html".
      - O valor DEVE ser o texto em formato HTML simples (use tags como <p>, <b>, <i>, <br>). SEM markdown como ** ou *.
      ESTRUTURA ESPERADA:
      {
        "html": "<p><b>Atenção:</b> O ensaio foi cancelado.</p>"
      }
    `;
  },
  [AI_TASKS.SCALE_SUGGESTION]: (data) => `
    Analise os dados e sugira melhorias antes da geração da escala.
    DADOS: ${JSON.stringify(data)}
    PADRÃO DE RESPOSTA (Markdown):
    - Título
    - Pontos principais
    - Sugestões práticas
  `,
  [AI_TASKS.MEMBER_ANALYSIS]: (data) => `
    Analise os membros e identifique: mais ativos, sobrecarregados e ausentes.
    DADOS: ${JSON.stringify(data)}
    PADRÃO DE RESPOSTA (Markdown):
    - Título
    - Pontos principais
    - Sugestões práticas
  `,
  [AI_TASKS.PREVENTIVE_ALERT]: (data) => `
    Detecte problemas como: falta de membros, conflitos de função e sobrecarga.
    DADOS: ${JSON.stringify(data)}
    PADRÃO DE RESPOSTA (Markdown):
    - Título
    - Pontos principais
    - Sugestões práticas
  `,
  [AI_TASKS.SCALE_GENERATION]: (_data) => '',
};

async function callAI(prompt: string, taskType: AI_TASKS, modelId: string): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada.');

  const isJson = JSON_TASKS.has(taskType);
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  const config: any = {
    systemInstruction: 'Você é um assistente especialista em gestão eclesiástica. Responda de forma direta e técnica.'
  };

  if (isJson) {
    config.responseMimeType = "application/json";
  }

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config
    });
    const content = response.text || '';
    if (!content) throw new Error('Gemini retornou resposta vazia.');
    return content;
  } catch (err: any) {
    throw err;
  }
}

async function callWithFallback(prompt: string, taskType: AI_TASKS, preferredModel?: string): Promise<string> {
  const knownModelIds = AI_MODELS.map(m => m.id);
  const validPreferred = preferredModel && knownModelIds.includes(preferredModel) ? preferredModel : undefined;

  const order = validPreferred
    ? [validPreferred, ...knownModelIds.filter(id => id !== validPreferred)]
    : knownModelIds;

  let lastErr: Error = new Error('Todos os modelos falharam.');
  for (const model of order) {
    try {
      return await callAI(prompt, taskType, model);
    } catch (err: any) {
      const errMsg: string = err.message || '';
      console.warn(`[runAI] Modelo ${model} falhou: ${errMsg}`);
      if (errMsg.includes('404') || errMsg.includes('NOT_FOUND')) {
        console.error(`[runAI] Modelo ${model} não existe nesta API. Pulando.`);
        lastErr = err;
        continue;
      }
      if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED')) {
        console.warn(`[runAI] Quota excedida para ${model}. Tentando próximo...`);
        lastErr = err;
        continue;
      }
      lastErr = err;
    }
  }
  console.error(`[runAI] Todos os modelos falharam. Último erro:`, lastErr);
  throw lastErr;
}

export async function runAI(taskType: AI_TASKS, context: AIContext | any, payload?: any, preferredModel?: string): Promise<any> {
  if (typeof window !== 'undefined') {
    // Estamos no navegador: chamar nosso backend ao invés de ligar diretamente (esconde API Key)
    const res = await fetch('/api/ai/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskType, context, payload, preferredModel })
    });
    if (!res.ok) {
      const text = await res.text();
      try {
        const err = JSON.parse(text);
        throw new Error(err.error || 'Erro na camada de proxy da IA');
      } catch (e) {
        throw new Error(`Erro na API (${res.status}): ${text}`);
      }
    }
    return res.json();
  }

  if (taskType === AI_TASKS.SCALE_GENERATION) {
    return generateScheduleLocally(payload);
  }

  let actualContext = context as AIContext;
  let actualPayload = payload;

  if (!payload && context && !(context as AIContext).organization_name) {
    actualPayload = context;
    actualContext = { organization_name: 'Geral', ministry_name: 'Geral', total_members: 0, active_members: 0, roles: [] };
  }

  if (!actualPayload) throw new Error('Payload is required for AI task');

  const promptGenerator = PROMPTS[taskType];
  if (!promptGenerator) throw new Error(`Task type ${taskType} not implemented.`);

  const fullPrompt = `
    ${GLOBAL_PERSONALITY}
    CONTEXTO DA ORGANIZAÇÃO:
    - Organização: ${actualContext.organization_name}
    - Ministério: ${actualContext.ministry_name}
    - Total de Membros: ${actualContext.total_members}
    - Membros Ativos: ${actualContext.active_members}
    - Funções: ${(actualContext.roles || []).join(', ')}
    TAREFA:
    ${promptGenerator(actualPayload)}
  `;

  try {
    const content = await callWithFallback(fullPrompt, taskType, preferredModel);
    return parseAIResponse(content, taskType);
  } catch (error: any) {
    console.error(`[AIOrchestrator] Falha para task ${taskType}:`, error);
    throw new Error(`Erro na IA (${taskType}): ${error.message || 'Erro desconhecido'}`);
  }
}

function parseAIResponse(content: string, taskType: AI_TASKS): any {
  let cleaned = content;
  try {
    cleaned = cleaned.trim();

    const jsonBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (jsonBlockMatch) {
      const parsed = JSON.parse(jsonBlockMatch[1].trim());
      return extractByTask(parsed, taskType);
    }

    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');
    let jsonStart = -1;
    let jsonEnd = -1;

    if (firstBrace !== -1 && firstBracket !== -1) {
      if (firstBrace < firstBracket) {
        jsonStart = firstBrace;
        jsonEnd = cleaned.lastIndexOf('}') + 1;
      } else {
        jsonStart = firstBracket;
        jsonEnd = cleaned.lastIndexOf(']') + 1;
      }
    } else if (firstBrace !== -1) {
      jsonStart = firstBrace;
      jsonEnd = cleaned.lastIndexOf('}') + 1;
    } else if (firstBracket !== -1) {
      jsonStart = firstBracket;
      jsonEnd = cleaned.lastIndexOf(']') + 1;
    }

    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      const jsonStr = cleaned.slice(jsonStart, jsonEnd);
      const parsed = JSON.parse(jsonStr);
      return extractByTask(parsed, taskType);
    }
    return cleaned;
  } catch (err) {
    return cleaned;
  }
}

function extractByTask(parsed: any, taskType: AI_TASKS): any {
  if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
    if (taskType === AI_TASKS.GENERATE_NOTICE) {
      if (parsed.message) return [{ name: 'Grupo do Ministério', role: 'Aviso Geral', message: parsed.message }];
    }
    if ('messages' in parsed) return parsed.messages;
  }
  return parsed;
}

// ─── Geração de Escala Local ───────────────────────────────

interface ScheduleInput {
  occurrences: { date: string; time: string; ruleId: string; title: string }[];
  roles: string[];
  members: { id: string; name: string; functions: string[] }[];
  availability: Record<string, string[] | Record<string, string>>;
  existingAssignments: { event_rule_id: string; event_date: string; role: string; member_id: string }[];
  rules?: {
    blockGroups?: string[][];
    memberBlocks?: string[][];
    memberPrefers?: string[][];
    allowExceptions?: string[][];
  };
  eventRoleExcludes?: Record<string, string[]>; // { ruleId: ['Camera', 'Transmissao'] }
  memberNotes?: Record<string, string>;          // { 'userId_YYYY-MM': 'texto da observação' }
  mode?: 'fill' | 'rebalance';
}

interface Assignment {
  event_rule_id: string;
  event_date: string;
  role: string;
  member_id: string;
  replacedMemberId?: string; // Modo rebalance: quem está sendo substituído
  memberNote?: string;       // Observação deixada pelo membro para o mês
}

type ExistingAssignment = ScheduleInput['existingAssignments'][number];

/** Normaliza qualquer formato de data para YYYY-MM-DD */
function normalizeDate(d: string): string {
  return d.slice(0, 10);
}

// ─── Helpers de Disponibilidade e Regras (module-level) ────────────────────

function isMemberAvailable(
  memberId: string,
  date: string,
  time: string,
  availability: Record<string, string[] | Record<string, string>>
): boolean {
  const avail = availability[memberId];
  if (!avail) return false;

  const monthKey = `${date.substring(0, 7)}-01`;
  if ((avail as Record<string, string>)[monthKey] === 'BLK') return false;

  const dayVal = (avail as Record<string, string>)[date];
  if (dayVal === 'BLK' || dayVal === 'unavailable') return false;

  // Formato array (padrão do useMinistryQueries / AvancedAIScreen)
  if (Array.isArray(avail)) {
    if (avail.includes(date)) return true;

    const timePart = time.slice(0, 5);
    if (avail.includes(`${date}_${timePart}`)) return true;

    const hour = parseInt(timePart.slice(0, 2), 10);
    const isMorning = hour < 12;
    if (isMorning && avail.includes(`${date}_M`)) return true;
    if (!isMorning && avail.includes(`${date}_N`)) return true;

    return false;
  }

  // Formato objeto (ScheduleEditorV2 / legado)
  if (!dayVal) return false;
  if (dayVal === 'all') return true;
  const hour = parseInt(time.split(':')[0], 10);
  if (dayVal === 'M') return hour < 12;
  if (dayVal === 'N') return hour >= 18;
  if (dayVal === 'T') return hour >= 12 && hour < 18;
  return true;
}

function hasSundayTurnConflict(
  memberId: string,
  date: string,
  time: string,
  allAssignments: ExistingAssignment[],
  occurrences: ScheduleInput['occurrences']
): boolean {
  const weekday = new Date(date + 'T12:00:00').getDay();
  if (weekday !== 0) return false;
  const hour = parseInt(time.split(':')[0], 10);
  const isMorning = hour < 12;
  return allAssignments.some(a => {
    if (a.member_id !== memberId || normalizeDate(a.event_date) !== date) return false;
    const occ = occurrences.find(
      o => o.ruleId === a.event_rule_id && o.date === normalizeDate(a.event_date)
    );
    if (!occ) return false;
    const assignedHour = parseInt(occ.time.split(':')[0], 10);
    return isMorning !== (assignedHour < 12);
  });
}

function hasBlockGroupConflict(
  memberId: string,
  role: string,
  ruleId: string,
  date: string,
  allAssignments: ExistingAssignment[],
  rules?: ScheduleInput['rules']
): boolean {
  if (!rules?.blockGroups?.length) return false;
  const memberInEvent = allAssignments.filter(
    a => a.member_id === memberId &&
         a.event_rule_id === ruleId &&
         normalizeDate(a.event_date) === date
  );
  for (const group of rules.blockGroups) {
    if (!group.includes(role)) continue;
    const conflicting = memberInEvent.find(a => group.includes(a.role));
    if (!conflicting) continue;
    const hasException = rules.allowExceptions?.some(exc =>
      exc.includes(role) && exc.includes(conflicting.role)
    );
    if (!hasException) return true;
  }
  return false;
}

function hasMemberBlockConflict(
  memberId: string,
  ruleId: string,
  date: string,
  allAssignments: ExistingAssignment[],
  rules?: ScheduleInput['rules']
): boolean {
  if (!rules?.memberBlocks?.length) return false;
  const membersInEvent = allAssignments
    .filter(a => a.event_rule_id === ruleId && normalizeDate(a.event_date) === date)
    .map(a => a.member_id);
  for (const block of rules.memberBlocks) {
    if (block.includes(memberId)) {
      const blocked = block.find(id => id !== memberId);
      if (blocked && membersInEvent.includes(blocked)) return true;
    }
  }
  return false;
}

function getPreferredPartners(memberId: string, rules?: ScheduleInput['rules']): string[] {
  if (!rules?.memberPrefers?.length) return [];
  return rules.memberPrefers
    .filter(pair => pair.includes(memberId))
    .map(pair => pair.find(id => id !== memberId)!)
    .filter(Boolean);
}

// ─── Modo Fill: preenche vagas vazias ───────────────────────────────────────

function fillSchedule(data: ScheduleInput): Assignment[] {
  const result: Assignment[] = [];

  // Inicializa contadores com escalas já existentes (evita sobrecarregar quem já foi escalado)
  const assignCount: Record<string, number> = {};
  data.members.forEach(m => { assignCount[m.id] = 0; });
  data.existingAssignments.forEach(a => {
    if (a.member_id && a.role !== '__EVENT_EXCLUDED__' && assignCount[a.member_id] !== undefined) {
      assignCount[a.member_id] = (assignCount[a.member_id] || 0) + 1;
    }
  });

  const allAssignments = (): ExistingAssignment[] => [
    ...data.existingAssignments,
    ...result
  ];

  for (const occ of data.occurrences) {
    for (const role of data.roles) {
      // Verifica se esta função está excluída para este evento específico
      const excludedRoles = data.eventRoleExcludes?.[occ.ruleId] || [];
      if (excludedRoles.includes(role)) continue;

      // Vaga já preenchida — pula
      const alreadyFilled = allAssignments().some(
        a => a.event_rule_id === occ.ruleId &&
             normalizeDate(a.event_date) === occ.date &&
             a.role === role
      );
      if (alreadyFilled) continue;

      // Filtra membros elegíveis respeitando todas as regras
      const eligible = data.members.filter(m => {
        if (!m.functions.includes(role)) return false;
        if (!isMemberAvailable(m.id, occ.date, occ.time, data.availability)) return false;
        if (hasSundayTurnConflict(m.id, occ.date, occ.time, allAssignments(), data.occurrences)) return false;
        if (hasBlockGroupConflict(m.id, role, occ.ruleId, occ.date, allAssignments(), data.rules)) return false;
        if (hasMemberBlockConflict(m.id, occ.ruleId, occ.date, allAssignments(), data.rules)) return false;
        return true;
      });

      if (eligible.length === 0) continue;

      const membersInEvent = allAssignments()
        .filter(a => a.event_rule_id === occ.ruleId && normalizeDate(a.event_date) === occ.date)
        .map(a => a.member_id);

      // Prioridade 1: membro com parceiro preferido já no evento
      let chosen = eligible.find(m =>
        getPreferredPartners(m.id, data.rules).some(p => membersInEvent.includes(p))
      );

      // Prioridade 2: membro menos escalado no mês
      if (!chosen) {
        const sorted = [...eligible].sort(
          (a, b) => (assignCount[a.id] || 0) - (assignCount[b.id] || 0)
        );
        chosen = sorted[0];
      }

      // Verifica se o membro escolhido tem observação para o mês
      const monthKey = occ.date.substring(0, 7);
      const memberNote = data.memberNotes?.[`${chosen.id}_${monthKey}`];

      result.push({
        event_rule_id: occ.ruleId,
        event_date: occ.date,
        role,
        member_id: chosen.id,
        ...(memberNote ? { memberNote } : {})
      });
      assignCount[chosen.id] = (assignCount[chosen.id] || 0) + 1;
    }
  }

  return result;
}

// ─── Modo Rebalance: sugere trocas para equilibrar a carga mensal ───────────

function rebalanceSchedule(data: ScheduleInput): Assignment[] {
  // Contagem atual de escalas por membro
  const currentCount: Record<string, number> = {};
  data.members.forEach(m => { currentCount[m.id] = 0; });
  data.existingAssignments.forEach(a => {
    if (a.member_id && a.role !== '__EVENT_EXCLUDED__' && currentCount[a.member_id] !== undefined) {
      currentCount[a.member_id]++;
    }
  });

  const totalAssigned = Object.values(currentCount).reduce((s, c) => s + c, 0);
  const memberCount = data.members.length;
  if (memberCount === 0 || totalAssigned === 0) return [];

  const avgLoad = totalAssigned / memberCount;
  const overloadThreshold = Math.ceil(avgLoad);

  // Membros com mais escalas que a média (mais sobrecarregados primeiro)
  const overloaded = data.members
    .filter(m => (currentCount[m.id] || 0) > overloadThreshold)
    .sort((a, b) => (currentCount[b.id] || 0) - (currentCount[a.id] || 0));

  if (overloaded.length === 0) return [];

  const result: Assignment[] = [];
  const mutableCounts = { ...currentCount };
  const swappedKeys = new Set<string>();

  for (const heavyMember of overloaded) {
    // Pega as escalas do membro sobrecarregado (mais recentes primeiro para trocar as últimas)
    const memberAssignments = [...data.existingAssignments]
      .filter(a => a.member_id === heavyMember.id && a.role !== '__EVENT_EXCLUDED__')
      .sort((a, b) => b.event_date.localeCompare(a.event_date));

    for (const assign of memberAssignments) {
      // Parar quando este membro já estiver equilibrado
      if ((mutableCounts[heavyMember.id] || 0) <= overloadThreshold) break;

      const key = `${assign.event_rule_id}|${normalizeDate(assign.event_date)}|${assign.role}`;
      if (swappedKeys.has(key)) continue;

      // Encontra a ocorrência para obter o horário
      const occ = data.occurrences.find(
        o => o.ruleId === assign.event_rule_id && o.date === normalizeDate(assign.event_date)
      );
      if (!occ) continue;

      // Assignments restantes neste evento (excluindo o membro sendo trocado)
      const remainingEventAssignments = data.existingAssignments.filter(
        a => a.event_rule_id === assign.event_rule_id &&
             normalizeDate(a.event_date) === normalizeDate(assign.event_date) &&
             a.member_id !== heavyMember.id
      );
      const membersInEvent = remainingEventAssignments.map(a => a.member_id);

      // Busca substituto elegível com menor carga
      const candidates = data.members.filter(m => {
        if (m.id === heavyMember.id) return false;
        // Só substitui se reduzir efetivamente o desequilíbrio
        if ((mutableCounts[m.id] || 0) >= (mutableCounts[heavyMember.id] || 0) - 1) return false;
        if (!m.functions.includes(assign.role)) return false;
        if (!isMemberAvailable(m.id, occ.date, occ.time, data.availability)) return false;
        // Não pode já estar neste evento nesta função
        if (membersInEvent.includes(m.id)) return false;
        if (hasBlockGroupConflict(m.id, assign.role, assign.event_rule_id, normalizeDate(assign.event_date), remainingEventAssignments, data.rules)) return false;
        if (hasMemberBlockConflict(m.id, assign.event_rule_id, normalizeDate(assign.event_date), remainingEventAssignments, data.rules)) return false;
        // Verifica conflito de turno no domingo
        const tempAll: ExistingAssignment[] = [
          ...data.existingAssignments.filter(
            a => !(a.member_id === heavyMember.id &&
                   a.event_rule_id === assign.event_rule_id &&
                   normalizeDate(a.event_date) === normalizeDate(assign.event_date))
          ),
          ...result
        ];
        if (hasSundayTurnConflict(m.id, occ.date, occ.time, tempAll, data.occurrences)) return false;
        return true;
      }).sort((a, b) => (mutableCounts[a.id] || 0) - (mutableCounts[b.id] || 0));

      if (candidates.length === 0) continue;

      const replacement = candidates[0];
      const monthKey = occ.date.substring(0, 7);
      const memberNote = data.memberNotes?.[`${replacement.id}_${monthKey}`];

      result.push({
        event_rule_id: assign.event_rule_id,
        event_date: normalizeDate(assign.event_date),
        role: assign.role,
        member_id: replacement.id,
        replacedMemberId: heavyMember.id,
        ...(memberNote ? { memberNote } : {})
      });

      mutableCounts[heavyMember.id]--;
      mutableCounts[replacement.id]++;
      swappedKeys.add(key);
    }
  }

  return result;
}

// ─── Entry Point ────────────────────────────────────────────────────────────

function generateScheduleLocally(data: ScheduleInput): Assignment[] {
  if (data.mode === 'rebalance') {
    return rebalanceSchedule(data);
  }
  return fillSchedule(data);
}

export async function generateScheduleWithAI(data: ScheduleInput, _model?: string): Promise<Assignment[]> {
  return Promise.resolve(generateScheduleLocally(data));
}

