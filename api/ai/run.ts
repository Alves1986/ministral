// api/ai/run.ts
// Função serverless Vercel — chama REST API do Gemini via fetch nativo
// NÃO usa @google/genai para evitar erros de bundling ESM no Vercel

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const MODELS_FALLBACK = [
  'gemini-2.0-flash',
  'gemini-2.5-flash',
  'gemini-2.0-flash-lite',
];

const SYSTEM_INSTRUCTION =
  'Você é um assistente especialista em gestão eclesiástica. Responda de forma direta e técnica.';

const GLOBAL_PERSONALITY = `
Você é um especialista em gestão de ministérios e organização de equipes.
Seu foco é: organização, equilíbrio, clareza e decisões práticas.
Evite respostas genéricas. Sempre entregue sugestões aplicáveis.
Seja direto e estruturado.
`;

// Tasks que retornam JSON puro
const JSON_TASKS = new Set([
  'MINISTRY_HEALTH',
  'GENERATE_NOTICE',
  'TEXT_REWRITE',
]);

function buildPrompt(taskType: string, context: any, payload: any): string {
  const ctx = context || {};
  const contextBlock = `
CONTEXTO DA ORGANIZAÇÃO:
- Organização: ${ctx.organization_name || 'Geral'}
- Ministério: ${ctx.ministry_name || 'Geral'}
- Total de Membros: ${ctx.total_members || 0}
- Membros Ativos: ${ctx.active_members || 0}
- Funções: ${(ctx.roles || []).join(', ')}
`;

  const prompts: Record<string, string> = {
    MINISTRY_HEALTH: `
${GLOBAL_PERSONALITY}
${contextBlock}
TAREFA:
Analise a saúde do ministério com base nos dados fornecidos.
DADOS: ${JSON.stringify(payload)}
REGRAS DE RESPOSTA:
Retorne OBRIGATORIAMENTE um JSON puro seguindo a estrutura solicitada.
ESTRUTURA:
{
  "score": número de 0 a 100,
  "status": "otimo" | "bom" | "atencao" | "critico",
  "summary": "frase curta e direta descrevendo o estado geral",
  "alerts": ["lista de problemas detectados"],
  "suggestions": ["lista de sugestões práticas de melhoria"]
}`,

    SCALE_ANALYSIS: `
${GLOBAL_PERSONALITY}
${contextBlock}
TAREFA:
Analise a organização das escalas.
Verifique: sobrecarga, repetição, falta de membros e equilíbrio geral.
DADOS: ${JSON.stringify(payload)}
Retorne análise clara + melhorias.
PADRÃO DE RESPOSTA:
- Título
- Pontos principais
- Sugestões práticas (Markdown)`,

    GENERATE_NOTICE: `
${GLOBAL_PERSONALITY}
${contextBlock}
TAREFA:
Crie um aviso unificado e organizado para o grupo do WhatsApp do ministério.
DIRETRIZES:
1. Trate todo evento como "Culto" no título da mensagem (ex: "Escala para o Culto - ${payload?.evento || ''}").
2. Liste os membros e suas funções de forma clara e visualmente agradável com emojis.
3. Inclua OBRIGATORIAMENTE ao final da mensagem o seguinte bloco de orientações:
⚠️ *Orientações:*
1. Cheguem com 30 minutos de antecedência para check-list dos equipamentos.
2. Caso haja algum imprevisto, comuniquem a liderança imediatamente.
3. Não esqueça de Confirmar a escala realizando o check-in no aplicativo.
Vamos juntos servir com excelência! 🚀
INFORMAÇÕES:
Evento: ${payload?.evento || ''}
Data: ${payload?.data || ''}
Horário: ${payload?.horario || ''}
Membros e Funções: ${payload?.funcoes || ''}
REGRAS DE RESPOSTA:
Retorne APENAS um objeto JSON.
ESTRUTURA:
{ "message": "Texto completo da mensagem formatado para WhatsApp (com quebras de linha e emojis)" }`,

    EXPLAIN_DECISION: `
${GLOBAL_PERSONALITY}
${contextBlock}
TAREFA:
Explique de forma clara como a escala foi gerada.
Inclua critérios, equilíbrio e limitações.
DADOS: ${JSON.stringify(payload)}
PADRÃO DE RESPOSTA (Markdown):
- Título
- Critérios usados
- Sugestões práticas`,

    TEXT_REWRITE: (() => {
      const styles: Record<string, string> = {
        professional: 'Reescreva o texto abaixo de forma formal, profissional e respeitosa.',
        exciting: 'Reescreva o texto abaixo de forma animada, motivadora e envolvente.',
        urgent: 'Reescreva o texto abaixo de forma urgente, direta e com senso de prioridade.',
      };
      const tone = payload?.tone || 'professional';
      return `
${styles[tone] || styles.professional}
TEXTO: "${payload?.text || ''}"
REGRAS:
- Retorne APENAS um objeto JSON válido, sem explicações ou markdown externo.
- A chave deve ser "html".
- O valor DEVE ser o texto em formato HTML simples.
ESTRUTURA ESPERADA:
{ "html": "<p><b>Atenção:</b> O ensaio foi cancelado.</p>" }`;
    })(),

    SCALE_SUGGESTION: `
${GLOBAL_PERSONALITY}
${contextBlock}
TAREFA:
Analise os dados e sugira melhorias antes da geração da escala.
DADOS: ${JSON.stringify(payload)}
PADRÃO DE RESPOSTA (Markdown):
- Título
- Pontos principais
- Sugestões práticas`,

    MEMBER_ANALYSIS: `
${GLOBAL_PERSONALITY}
${contextBlock}
TAREFA:
Analise os membros e identifique: mais ativos, sobrecarregados e ausentes.
DADOS: ${JSON.stringify(payload)}
PADRÃO DE RESPOSTA (Markdown):
- Título
- Pontos principais
- Sugestões práticas`,

    PREVENTIVE_ALERT: `
${GLOBAL_PERSONALITY}
${contextBlock}
TAREFA:
Detecte problemas como: falta de membros, conflitos de função e sobrecarga.
DADOS: ${JSON.stringify(payload)}
PADRÃO DE RESPOSTA (Markdown):
- Título
- Pontos principais
- Sugestões práticas`,
  };

  return prompts[taskType] || `${GLOBAL_PERSONALITY}\n${contextBlock}\nTAREFA: ${taskType}\nDADOS: ${JSON.stringify(payload)}`;
}

async function callGeminiREST(
  apiKey: string,
  model: string,
  prompt: string,
  useJson: boolean
): Promise<string> {
  const url = `${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`;

  const body: any = {
    systemInstruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 4096,
    },
  };

  if (useJson) {
    body.generationConfig.responseMimeType = 'application/json';
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({ error: { message: response.statusText } }));
    const errMsg = errBody?.error?.message || response.statusText;
    const err = new Error(JSON.stringify(errBody?.error || { message: errMsg }));
    (err as any).status = response.status;
    throw err;
  }

  const data = await response.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!text) throw new Error('Gemini retornou resposta vazia.');
  return text;
}

async function callWithFallback(
  apiKey: string,
  prompt: string,
  useJson: boolean,
  preferredModel?: string
): Promise<string> {
  const knownModels = MODELS_FALLBACK;
  const order =
    preferredModel && knownModels.includes(preferredModel)
      ? [preferredModel, ...knownModels.filter((m) => m !== preferredModel)]
      : knownModels;

  let lastErr: Error = new Error('Todos os modelos falharam.');

  for (const model of order) {
    try {
      return await callGeminiREST(apiKey, model, prompt, useJson);
    } catch (err: any) {
      const status: number = err.status || 0;
      const msg: string = err.message || '';
      console.warn(`[api/ai/run] Modelo ${model} falhou (${status}): ${msg.slice(0, 200)}`);

      if (status === 404 || msg.includes('NOT_FOUND')) {
        console.error(`[api/ai/run] Modelo ${model} não existe. Pulando.`);
      } else if (status === 503 || msg.includes('UNAVAILABLE')) {
        console.warn(`[api/ai/run] Modelo ${model} indisponível. Tentando próximo...`);
      } else if (status === 429 || msg.includes('RESOURCE_EXHAUSTED')) {
        console.warn(`[api/ai/run] Quota excedida para ${model}. Tentando próximo...`);
      }
      lastErr = err;
    }
  }

  throw lastErr;
}

function parseResponse(content: string, taskType: string): any {
  try {
    const cleaned = content.trim();

    // Remove markdown code blocks se houver
    const jsonBlock = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (jsonBlock) {
      const parsed = JSON.parse(jsonBlock[1].trim());
      return extractByTask(parsed, taskType);
    }

    // Tenta extrair JSON raw
    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');
    let start = -1;
    let end = -1;

    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      start = firstBrace;
      end = cleaned.lastIndexOf('}') + 1;
    } else if (firstBracket !== -1) {
      start = firstBracket;
      end = cleaned.lastIndexOf(']') + 1;
    }

    if (start !== -1 && end > start) {
      const parsed = JSON.parse(cleaned.slice(start, end));
      return extractByTask(parsed, taskType);
    }

    return cleaned;
  } catch {
    return content;
  }
}

function extractByTask(parsed: any, taskType: string): any {
  if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
    if (taskType === 'GENERATE_NOTICE') {
      if (parsed.message)
        return [{ name: 'Grupo do Ministério', role: 'Aviso Geral', message: parsed.message }];
    }
    if ('messages' in parsed) return parsed.messages;
  }
  return parsed;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Resolve a API key — suporta ambas as variáveis de ambiente
  const apiKey =
    (process.env.GEMINI_API_KEY?.startsWith('AIzaSy') ? process.env.GEMINI_API_KEY : '') ||
    (process.env.VITE_GEMINI_API_KEY?.startsWith('AIzaSy') ? process.env.VITE_GEMINI_API_KEY : '') ||
    process.env.GEMINI_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    '';

  if (!apiKey) {
    console.error('[api/ai/run] GEMINI_API_KEY não configurada nas variáveis de ambiente do Vercel.');
    return res.status(500).json({
      error: 'GEMINI_API_KEY não configurada. Configure nas variáveis de ambiente do Vercel.',
    });
  }

  try {
    const { taskType, context, payload, preferredModel } = req.body || {};

    if (!taskType) {
      return res.status(400).json({ error: 'taskType é obrigatório.' });
    }

    // SCALE_GENERATION não usa IA — retorna array vazio (geração local no cliente)
    if (taskType === 'SCALE_GENERATION') {
      return res.status(200).json([]);
    }

    const useJson = JSON_TASKS.has(taskType);
    const prompt = buildPrompt(taskType, context, payload);

    const content = await callWithFallback(apiKey, prompt, useJson, preferredModel);
    const result = parseResponse(content, taskType);

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('[api/ai/run] Erro:', error.message || error);
    return res.status(500).json({
      error: error.message || 'Falha ao processar tarefa de IA.',
    });
  }
}
