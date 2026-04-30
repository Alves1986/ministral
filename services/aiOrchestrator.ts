// services/aiOrchestrator.ts
// ─── OpenRouter API — sem dependências externas de IA ───────────────────────

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function getApiKey(): string {
  // Browser (Vite)
  if (typeof window !== 'undefined') {
    return (import.meta as any).env?.VITE_OPENROUTER_API_KEY || '';
  }
  // Node / SSR
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

// Modelos disponíveis — usados pelo AdvancedAIScreen e aqui como fallback
export const OPENROUTER_MODELS = [
  { id: 'minimax/minimax-m2.5:free',  name: 'MiniMax M2.5 (Equilibrado)',   description: 'Modelo versátil e confiável para uso geral.' },
  { id: 'openai/gpt-oss-120b:free',   name: 'GPT OSS 120B (Lógica)',        description: 'Focado em decisões complexas, análise e raciocínio.' },
  { id: 'z-ai/glm-4.5-air:free',      name: 'GLM-4.5 Air (Velocidade)',     description: 'Resposta ultra-rápida para tarefas de escrita.' },
];

export const DEFAULT_MODEL = OPENROUTER_MODELS[0].id; // minimax-m2.5:free

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

// ─── Tasks que precisam retornar JSON puro ───────────────────────────────────
const JSON_TASKS = new Set([
  AI_TASKS.MINISTRY_HEALTH,
  AI_TASKS.GENERATE_NOTICE,
  AI_TASKS.SCALE_GENERATION,
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
  [AI_TASKS.SCALE_GENERATION]: (data) => {
    // Extrair apenas as datas relevantes (do mês corrente das ocorrências)
    const relevantDates = new Set<string>(data.occurrences.map((o: any) => o.date));
    const trimmedAvailability: Record<string, Record<string, string>> = {};
    for (const [memberId, dateMap] of Object.entries(data.availability as Record<string, Record<string, string>>)) {
      const trimmed: Record<string, string> = {};
      for (const [dateKey, val] of Object.entries(dateMap)) {
        // Manter BLK mensal (YYYY-MM-01) e apenas datas relevantes
        if (dateKey.endsWith('-01') || relevantDates.has(dateKey)) {
          trimmed[dateKey] = val;
        }
      }
      if (Object.keys(trimmed).length > 0) {
        trimmedAvailability[memberId] = trimmed;
      }
    }

    return `
    Gere uma escala de ministério equilibrada e otimizada para as ocorrências abaixo seguindo RIGOROSAMENTE as regras de negócio.
    
    CRITÉRIOS DE DISPONIBILIDADE E PREENCHIMENTO:
    1. EXCLUSIVIDADE DE DISPONIBILIDADE: Um membro SÓ pode ser escalado se ele tiver marcado disponibilidade EXPLICITAMENTE no objeto 'availability' para aquela data (YYYY-MM-DD). Se não houver registro para ele naquela data (id dele não consta como chave), ou se o valor para a data for 'unavailable', ele NÃO PODE SER ESCALADO em hipótese alguma. ATENÇÃO: Se o objeto availability contiver a chave "YYYY-MM-01" com o valor "BLK", significa que o membro NÃO ESTÁ DISPONÍVEL no mês inteiro e não pode ser escalado em NENHUM dia desse mês.
    2. DEIXAR VAZIO SE NECESSÁRIO: Se para uma determinada função em uma data não houver NENHUM membro disponível que possua aquela função em seu perfil (functions), você DEVE deixar essa vaga vazia. Não tente "inventar" uma escala ou colocar alguém indisponível. É preferível uma escala incompleta do que uma que viole as disponibilidades.
    3. RESPEITO ÀS FUNÇÕES: Um membro só pode ser escalado em uma função (role) que esteja listada em seu array 'functions'.
    
    REGRAS DE CONFLITO (RULES):
    Use os dados de 'rules' para evitar conflitos:
    - blockGroups: Listas de funções que NÃO podem ser feitas pela mesma pessoa no mesmo evento.
    - memberBlocks: Pares de IDs de membros que NÃO podem ser escalados juntos no mesmo evento.
    - memberPrefers: Pares de IDs de membros que devem ser escalados juntos sempre que possível.
    
    REGRA DE DOMINGO (IMUTÁVEL):
    - Domingos podem ter até dois eventos no mesmo dia: um pela manhã (hora < 12:00) e um à noite (hora >= 18:00).
    - Um membro que já foi escalado em um evento de domingo de MANHÃ NÃO PODE ser escalado no evento de domingo à NOITE do mesmo dia, independentemente de sua disponibilidade declarada.
    - Para identificar isso: compare o campo 'time' das ocorrências. Se duas ocorrências caírem na mesma data (event_date igual) e uma tiver time < "12:00" e a outra time >= "18:00", trate-as como conflito de turno para o mesmo membro.
    - Esta regra se aplica em ambas as direções: escalado de manhã → bloqueado à noite; escalado à noite → bloqueado de manhã.
    
    DADOS DE ENTRADA:
    - Ocorrências: ${JSON.stringify(data.occurrences)}
    - Funções Requeridas: ${JSON.stringify(data.roles)}
    - Membros: ${JSON.stringify(data.members)}
    - Disponibilidade (apenas datas relevantes): ${JSON.stringify(trimmedAvailability)}
    - Escala Atual (NÃO SOBREPOR): ${JSON.stringify(data.existingAssignments)}
    - Regras de Conflito: ${JSON.stringify(data.rules)}
    
    REGRAS DE RESPOSTA:
    Retorne APENAS um array JSON. Não inclua texto explicativo, markdown ou blocos de código.
    ESTRUTURA DOS ITENS:
    { "event_rule_id": "ruleId da ocorrência", "event_date": "YYYY-MM-DD da ocorrência", "role": "função escalada", "member_id": "id do membro" }
  `;
  },
};

// ─── Core fetch ──────────────────────────────────────────────────────────────
async function callOpenRouter(prompt: string, taskType: AI_TASKS, model: string): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('VITE_OPENROUTER_API_KEY não configurada.');

  const isJson = JSON_TASKS.has(taskType);

  const body: any = {
    model,
    max_tokens: taskType === AI_TASKS.SCALE_GENERATION ? 8192 : 4096,
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
  const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 segundos

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
      throw new Error(`Timeout: modelo ${model} não respondeu em 25s.`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── Trylist — tenta modelos em sequência até um funcionar ──────────────────
async function callWithFallback(prompt: string, taskType: AI_TASKS, preferredModel?: string): Promise<string> {
  const order = preferredModel
    ? [preferredModel, ...OPENROUTER_MODELS.map(m => m.id).filter(id => id !== preferredModel)]
    : OPENROUTER_MODELS.map(m => m.id);

  let lastErr: Error = new Error('Todos os modelos falharam.');
  for (const model of order) {
    try {
      return await callOpenRouter(prompt, taskType, model);
    } catch (err: any) {
      console.warn(`[runAI] Modelo ${model} falhou: ${err.message}`);
      lastErr = err;
    }
  }
  throw lastErr;
}

// ─── Public API ──────────────────────────────────────────────────────────────
export async function runAI(taskType: AI_TASKS, context: AIContext | any, payload?: any, preferredModel?: string): Promise<any> {
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

    // Tenta extrair bloco ```json ... ``` ou ``` ... ```
    const jsonBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (jsonBlockMatch) {
      const parsed = JSON.parse(jsonBlockMatch[1].trim());
      return extractByTask(parsed, taskType);
    }

    // Tenta encontrar o primeiro [ ou { na resposta (ignora texto de "thinking" antes do JSON)
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
  if (taskType === AI_TASKS.SCALE_GENERATION) {
    if (Array.isArray(parsed)) return parsed;
    if (parsed.assignments && Array.isArray(parsed.assignments)) return parsed.assignments;
    if (parsed.escala && Array.isArray(parsed.escala)) return parsed.escala;
    if (parsed.schedule && Array.isArray(parsed.schedule)) return parsed.schedule;
  }
  if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
    if (taskType === AI_TASKS.GENERATE_NOTICE) {
      if (parsed.message) return [{ name: 'Grupo do Ministério', role: 'Aviso Geral', message: parsed.message }];
    }
    if ('messages' in parsed) return parsed.messages;
  }
  return parsed;
}

export async function generateScheduleWithAI(data: any, preferredModel?: string): Promise<any[]> {
  const context: AIContext = {
    organization_name: 'Geral',
    ministry_name: 'Geral',
    total_members: data.members?.length || 0,
    active_members: data.members?.length || 0,
    roles: data.roles || []
  };
  const result = await runAI(AI_TASKS.SCALE_GENERATION, context, data, preferredModel);
  return Array.isArray(result) ? result : [];
}
