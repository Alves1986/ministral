// services/aiOrchestrator.ts
// ─── OpenRouter API — sem dependências externas de IA ───────────────────────

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function getApiKey(): string {
  if (typeof window !== 'undefined') {
    return (import.meta as any).env?.VITE_OPENROUTER_API_KEY || '';
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env.VITE_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY || '';
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

export const OPENROUTER_MODELS = [
  {
    id: 'deepseek/deepseek-r1:free',
    name: 'DeepSeek R1 (Lógica)',
    description: 'Melhor raciocínio lógico. Ideal para análises, sugestões e explicações complexas.'
  },
  {
    id: 'google/gemini-2.0-flash-thinking-exp:free',
    name: 'Gemini Flash Thinking (Fallback)',
    description: 'Fallback rápido com raciocínio estruturado quando o DeepSeek estiver indisponível.'
  },
];

export const DEFAULT_MODEL = OPENROUTER_MODELS[0].id;

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
    2. Liste os membros e suas funções de forma clara e visualmente agradável com emojis.
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

async function callOpenRouter(prompt: string, taskType: AI_TASKS, model: string): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('VITE_OPENROUTER_API_KEY não configurada.');

  const isJson = JSON_TASKS.has(taskType);

  const body: any = {
    model,
    max_tokens: 4096,
    messages: [
      {
        role: 'system',
        content: 'Você é um assistente especialista em gestão eclesiástica. Responda de forma direta e técnica.' +
          (isJson ? ' Responda SOMENTE com JSON válido, sem markdown, sem blocos de código, sem texto adicional.' : '')
      },
      { role: 'user', content: prompt }
    ],
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://ministral.app',
        'X-Title': 'Ministral',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `OpenRouter error ${res.status}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    if (!content) throw new Error('OpenRouter retornou resposta vazia.');
    return content;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error(`Timeout: modelo ${model} não respondeu em 45s.`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callWithFallback(prompt: string, taskType: AI_TASKS, preferredModel?: string): Promise<string> {
  if (preferredModel) {
    return await callOpenRouter(prompt, taskType, preferredModel);
  }
  let lastErr: Error = new Error('Todos os modelos falharam.');
  for (const m of OPENROUTER_MODELS) {
    try {
      return await callOpenRouter(prompt, taskType, m.id);
    } catch (err: any) {
      console.warn(`[runAI] Modelo ${m.id} falhou: ${err.message}`);
      lastErr = err;
    }
  }
  throw lastErr;
}

export async function runAI(taskType: AI_TASKS, context: AIContext | any, payload?: any, preferredModel?: string): Promise<any> {
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
  try {
    const cleaned = content.trim();
    const jsonBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (jsonBlockMatch) {
      const parsed = JSON.parse(jsonBlockMatch[1].trim());
      return extractByTask(parsed, taskType);
    }
    const arrayStart = cleaned.indexOf('[');
    const objectStart = cleaned.indexOf('{');
    let jsonStart = -1;
    if (arrayStart !== -1 && objectStart !== -1) {
      jsonStart = Math.min(arrayStart, objectStart);
    } else if (arrayStart !== -1) {
      jsonStart = arrayStart;
    } else if (objectStart !== -1) {
      jsonStart = objectStart;
    }
    if (jsonStart !== -1) {
      const jsonStr = cleaned.slice(jsonStart);
      const parsed = JSON.parse(jsonStr);
      return extractByTask(parsed, taskType);
    }
    return cleaned;
  } catch {
    console.warn('[parseAIResponse] Falha ao parsear resposta como JSON:', content.slice(0, 200));
    return content;
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

interface ScheduleInput {
  occurrences: { date: string; time: string; ruleId: string; title: string }[];
  roles: string[];
  members: { id: string; name: string; functions: string[] }[];
  availability: Record<string, Record<string, string>>;
  existingAssignments: { event_rule_id: string; event_date: string; role: string; member_id: string }[];
  rules?: {
    blockGroups?: string[][];
    memberBlocks?: string[][];
    memberPrefers?: string[][];
    allowExceptions?: string[][];
  };
}

interface Assignment {
  event_rule_id: string;
  event_date: string;
  role: string;
  member_id: string;
}

function generateScheduleLocally(data: ScheduleInput): Assignment[] {
  const result: Assignment[] = [];
  const assignCount: Record<string, number> = {};
  data.members.forEach(m => { assignCount[m.id] = 0; });

  const allAssignments = (): Assignment[] => [...data.existingAssignments, ...result];

  function isMemberAvailable(memberId: string, date: string, time: string): boolean {
    const avail = data.availability[memberId];
    if (!avail) return false;
    const monthKey = `${date.substring(0, 7)}-01`;
    if (avail[monthKey] === 'BLK') return false;
    const dayVal = avail[date];
    if (!dayVal) return false;
    if (dayVal === 'BLK' || dayVal === 'unavailable') return false;
    if (dayVal === 'all') return true;
    const hour = parseInt(time.split(':')[0], 10);
    if (dayVal === 'M') return hour < 12;
    if (dayVal === 'N') return hour >= 18;
    if (dayVal === 'T') return hour >= 12 && hour < 18;
    return true;
  }

  function hasSundayTurnConflict(memberId: string, date: string, time: string): boolean {
    const weekday = new Date(date + 'T12:00:00').getDay();
    if (weekday !== 0) return false;
    const hour = parseInt(time.split(':')[0], 10);
    const isMorning = hour < 12;
    return allAssignments().some(a => {
      if (a.member_id !== memberId || a.event_date.slice(0, 10) !== date) return false;
      const occ = data.occurrences.find(o => o.ruleId === a.event_rule_id && o.date === a.event_date.slice(0, 10));
      if (!occ) return false;
      const assignedHour = parseInt(occ.time.split(':')[0], 10);
      return isMorning !== (assignedHour < 12);
    });
  }

  function hasBlockGroupConflict(memberId: string, role: string, ruleId: string, date: string): boolean {
    if (!data.rules?.blockGroups?.length) return false;
    const memberInEvent = allAssignments().filter(
      a => a.member_id === memberId && a.event_rule_id === ruleId && a.event_date.slice(0, 10) === date
    );
    for (const group of data.rules.blockGroups) {
      if (group.includes(role) && memberInEvent.some(a => group.includes(a.role))) return true;
    }
    return false;
  }

  function hasMemberBlockConflict(memberId: string, ruleId: string, date: string): boolean {
    if (!data.rules?.memberBlocks?.length) return false;
    const membersInEvent = allAssignments()
      .filter(a => a.event_rule_id === ruleId && a.event_date.slice(0, 10) === date)
      .map(a => a.member_id);
    for (const block of data.rules.memberBlocks) {
      if (block.includes(memberId)) {
        const blocked = block.find(id => id !== memberId);
        if (blocked && membersInEvent.includes(blocked)) return true;
      }
    }
    return false;
  }

  function getPreferredPartners(memberId: string): string[] {
    if (!data.rules?.memberPrefers?.length) return [];
    return data.rules.memberPrefers
      .filter(pair => pair.includes(memberId))
      .map(pair => pair.find(id => id !== memberId)!)
      .filter(Boolean);
  }

  for (const occ of data.occurrences) {
    for (const role of data.roles) {
      const alreadyFilled = allAssignments().some(
        a => a.event_rule_id === occ.ruleId && a.event_date.slice(0, 10) === occ.date && a.role === role
      );
      if (alreadyFilled) continue;

      const eligible = data.members.filter(m => {
        if (!m.functions.includes(role)) return false;
        if (!isMemberAvailable(m.id, occ.date, occ.time)) return false;
        if (hasSundayTurnConflict(m.id, occ.date, occ.time)) return false;
        if (hasBlockGroupConflict(m.id, role, occ.ruleId, occ.date)) return false;
        if (hasMemberBlockConflict(m.id, occ.ruleId, occ.date)) return false;
        return true;
      });

      if (eligible.length === 0) continue;

      const membersInEvent = allAssignments()
        .filter(a => a.event_rule_id === occ.ruleId && a.event_date.slice(0, 10) === occ.date)
        .map(a => a.member_id);

      let chosen = eligible.find(m =>
        getPreferredPartners(m.id).some(p => membersInEvent.includes(p))
      );

      if (!chosen) {
        eligible.sort((a, b) => (assignCount[a.id] || 0) - (assignCount[b.id] || 0));
        chosen = eligible[0];
      }

      result.push({ event_rule_id: occ.ruleId, event_date: occ.date, role, member_id: chosen.id });
      assignCount[chosen.id] = (assignCount[chosen.id] || 0) + 1;
    }
  }

  return result;
}

export async function generateScheduleWithAI(data: any, model?: string): Promise<Assignment[]> {
  return Promise.resolve(generateScheduleLocally(data));
}
