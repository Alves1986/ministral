// api/ai/run.ts
// Função serverless Vercel — chama REST API do Gemini via fetch nativo
// NÃO usa @google/genai para evitar erros de bundling ESM no Vercel

import { createClient } from '@supabase/supabase-js';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const MODELS_FALLBACK = [
  'gemini-2.5-flash',
  'gemini-3.5-flash',
  'gemini-3.8-flash',
  'gemini-3.5-flash-lite',
  'gemini-2.5-pro',
  'gemini-flash-latest',
];

const OPENROUTER_MODELS = [
  'meta-llama/llama-3-8b-instruct:free',
  'anthropic/claude-3-haiku',
  'google/gemini-flash-1.5',
];

const NVIDIA_BASE = 'https://integrate.api.nvidia.com/v1/chat/completions';
// Catalogo NVIDIA NIM validado em 2026-11-18. Modelos com fim de vida
// respondem HTTP 410 (Gone) e queimam o orcamento da funcao em fallback.
const NVIDIA_MODELS = [
  'nvidia/nemotron-3.5-lightning-30b-a3b',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
  'mistralai/mistral-large-4-1t-a52b'
];

const REQUEST_TIMEOUT_MS = 18000;
const TOTAL_BUDGET_MS = 26000;

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

    WHATSAPP_MSG_REWRITE: (() => {
      const tones: Record<string, string> = {
        motivador: 'Reescreva as orientações de forma animada, motivadora e inspiradora. Use emojis relevantes.',
        formal: 'Reescreva as orientações de forma formal, clara e respeitosa. Evite emojis em excesso.',
        acolhedor: 'Reescreva as orientações de forma carinhosa, acolhedora e gentil. Use emojis suaves.',
        direto: 'Reescreva as orientações de forma direta, objetiva e simples. Listas numéricas curtas.',
      };
      const tone = payload?.tone || 'motivador';
      return `
Você é um especialista em comunicação para ministérios de igrejas e grupos de WhatsApp.
${tones[tone] || tones.motivador}
Ministério: ${payload?.ministry_name || context?.ministry_name || 'Ministério'}
Texto original a reescrever:
---
${payload?.text || ''}
---
REGRAS OBRIGATÓRIAS:
1. Retorne APENAS o texto puro reescrito, sem explicações, sem títulos adicionais.
2. O texto deve ser formatado para WhatsApp: use *negrito* com asteriscos, não HTML.
3. Mantenha o formato de lista numerada se o original tiver.
4. Não adicione conteúdo inventado — apenas reescreva o que foi dado.
5. Ao final, inclua uma frase de fechamento inspiradora.`;
    })(),
  };

  return prompts[taskType] || `${GLOBAL_PERSONALITY}\n${contextBlock}\nTAREFA: ${taskType}\nDADOS: ${JSON.stringify(payload)}`;
}

async function callGeminiREST(
  apiKey: string,
  model: string,
  prompt: string,
  useJson: boolean,
  timeoutMs: number = REQUEST_TIMEOUT_MS
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
      maxOutputTokens: 8192,
    },
  };

  if (useJson) {
    body.generationConfig.responseMimeType = 'application/json';
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({ error: { message: response.statusText } }));
    const errMsg = errBody?.error?.message || response.statusText;
    const err = new Error(errMsg);
    (err as any).status = response.status;
    throw err;
  }

  const data = await response.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text: string = parts.map((p: any) => p.text).join('') || '';
  if (!text) throw new Error('Gemini retornou resposta vazia.');
  // warn (stderr) para aparecer nos runtime logs da Vercel no plano hobby
  console.warn(`[api/ai/run] provedor=gemini model=${model}`);
  return text;
}

async function callOpenRouterREST(apiKey: string, model: string, prompt: string, timeoutMs: number = REQUEST_TIMEOUT_MS): Promise<string> {
  const url = 'https://openrouter.ai/api/v1/chat/completions';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://ministral.app',
      'X-Title': 'Ministral'
    },
    body: JSON.stringify({
      model: model || 'meta-llama/llama-3-8b-instruct:free',
      messages: [
        { role: 'system', content: SYSTEM_INSTRUCTION },
        { role: 'user', content: prompt }
      ]
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({ error: { message: response.statusText } }));
    const errMsg = errBody?.error?.message || response.statusText;
    const err = new Error(errMsg);
    (err as any).status = response.status;
    throw err;
  }

  const data = await response.json();
  const text: string = data?.choices?.[0]?.message?.content || '';
  if (!text) throw new Error('OpenRouter retornou resposta vazia.');
  // warn (stderr) para aparecer nos runtime logs da Vercel no plano hobby
  console.warn(`[api/ai/run] provedor=openrouter model=${model}`);
  return text;
}

async function callNvidiaREST(apiKey: string, model: string, prompt: string, timeoutMs: number = REQUEST_TIMEOUT_MS): Promise<string> {
  const url = NVIDIA_BASE;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://ministral.app',
      'X-Title': 'Ministral'
    },
    body: JSON.stringify({
      model: model || NVIDIA_MODELS[0],
      messages: [
        { role: 'system', content: SYSTEM_INSTRUCTION },
        { role: 'user', content: prompt }
      ]
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({ error: { message: response.statusText } }));
    const errMsg = errBody?.error?.message || response.statusText;
    const err = new Error(`NVIDIA API Error: ${errMsg}`);
    (err as any).status = response.status;
    throw err;
  }

  const data = await response.json();
  const text: string = data?.choices?.[0]?.message?.content || '';
  if (!text) throw new Error('NVIDIA retornou resposta vazia.');
  // warn (stderr) para aparecer nos runtime logs da Vercel no plano hobby
  console.warn(`[api/ai/run] provedor=nvidia model=${model}`);
  return text;
}

async function callWithFallback(
  geminiKey: string,
  openRouterKey: string,
  nvidiaKey: string,
  prompt: string,
  useJson: boolean,
  preferredModel?: string
): Promise<string> {
  // Teto da funcao e 30s (vercel.json). Para antes disso para devolver um
  // erro claro em vez de um 504 por tempo esgotado.
  const startedAt = Date.now();
  const remainingMs = () => Math.max(0, TOTAL_BUDGET_MS - (Date.now() - startedAt));
  const timeoutFor = () => Math.min(REQUEST_TIMEOUT_MS, remainingMs());
  const fatalStatus = (status?: number) => status === 404 || status === 410;

  const isNvidiaModel = Boolean(preferredModel && NVIDIA_MODELS.includes(preferredModel));
  const isOpenRouterModel = Boolean(
    preferredModel && !isNvidiaModel && (
      preferredModel.includes('/') ||
      OPENROUTER_MODELS.includes(preferredModel)
    )
  );

  // Se o modelo solicitado for NVIDIA e houver chave, prioriza a NVIDIA
  if (isNvidiaModel && nvidiaKey && remainingMs() > 4000) {
    try {
      return await callNvidiaREST(nvidiaKey, preferredModel!, prompt, timeoutFor());
    } catch (err: any) {
      console.warn(`[api/ai/run] Modelo NVIDIA ${preferredModel} falhou (${err?.status || 0}): ${(err?.message || '').slice(0, 150)}`);
      if (!geminiKey && !openRouterKey) throw err;
    }
  }

  // Se o modelo solicitado for OpenRouter e houver chave, prioriza OpenRouter
  if (isOpenRouterModel && openRouterKey && remainingMs() > 4000) {
    try {
      return await callOpenRouterREST(openRouterKey, preferredModel!, prompt, timeoutFor());
    } catch (err: any) {
      console.warn(`[api/ai/run] OpenRouter model ${preferredModel} falhou (${err?.status || 0}): ${(err?.message || '').slice(0, 150)}`);
      if (!geminiKey) throw err;
    }
  }

  // Prepara ordem de modelos Gemini
  const knownModels = MODELS_FALLBACK;
  const order =
    preferredModel && !isNvidiaModel && !isOpenRouterModel
      ? [preferredModel, ...knownModels.filter((m) => m !== preferredModel)]
      : knownModels;

  let lastErr: Error = new Error('Todos os modelos de IA falharam.');

  if (geminiKey) {
    for (const model of order) {
      if (remainingMs() < 4000) break;
      try {
        return await callGeminiREST(geminiKey, model, prompt, useJson, timeoutFor());
      } catch (err: any) {
        const status: number = err.status || 0;
        const msg: string = err.message || '';
        console.warn(`[api/ai/run] Modelo ${model} falhou (${status}): ${msg.slice(0, 150)}`);
        lastErr = err;
        if (fatalStatus(status)) break;
      }
    }
  }

  // Se o Gemini falhou ou nao tem chave configurada, tenta OpenRouter se disponivel
  if (openRouterKey && !isOpenRouterModel && remainingMs() > 4000) {
    try {
      return await callOpenRouterREST(openRouterKey, 'meta-llama/llama-3-8b-instruct:free', prompt, timeoutFor());
    } catch (openRouterErr: any) {
      console.warn('[api/ai/run] Fallback OpenRouter falhou:', openRouterErr?.message);
    }
  }

  // Ultimo recurso: NVIDIA (ignora o catalogo preferido, tenta os vivos)
  if (nvidiaKey && !isNvidiaModel && remainingMs() > 4000) {
    for (const model of NVIDIA_MODELS) {
      if (remainingMs() < 4000) break;
      try {
        return await callNvidiaREST(nvidiaKey, model, prompt, timeoutFor());
      } catch (nvidiaErr: any) {
        console.warn(`[api/ai/run] Fallback NVIDIA ${model} falhou (${nvidiaErr?.status || 0}): ${(nvidiaErr?.message || '').slice(0, 150)}`);
        if (fatalStatus(nvidiaErr?.status)) break;
      }
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

  // --- AUTENTICAÇÃO: exige JWT válido do Supabase (evita abuso/queima da quota Gemini) ---
  try {
    const supabaseUrl =
      process.env.SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      '';
    const supabaseAnon =
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      '';
    const authHeader = req.headers.authorization || '';

    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Não autorizado. Token de sessão ausente.' });
    }

    if (!supabaseUrl || !supabaseAnon) {
      console.error('[api/ai/run] Configuração Supabase incompleta (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
      return res.status(500).json({
        error: 'Configuração de autenticação incompleta no servidor (Vercel). Verifique VITE_SUPABASE_ANON_KEY.'
      });
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      return res.status(401).json({ error: 'Token de autenticação vazio.' });
    }

    const sb = createClient(supabaseUrl, supabaseAnon);
    const { data: { user }, error } = await sb.auth.getUser(token);
    if (error || !user) {
      console.warn('[api/ai/run] Sessão do usuário inválida ou expirada:', error?.message);
      return res.status(401).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
    }
  } catch (authErr: any) {
    console.error('[api/ai/run] Erro na autenticação:', authErr?.message || authErr);
    return res.status(500).json({ error: 'Falha ao validar sessão: ' + (authErr?.message || 'Erro interno') });
  }

  // Resolve as chaves de API — suporta ambas as variações de nomes e remove aspas/espaços acidentais
  const rawGemini =
    process.env.GEMINI_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    '';
  const geminiApiKey = rawGemini.trim().replace(/^["']|["']$/g, '');

  const rawOpenRouter =
    process.env.OPENROUTER_API_KEY ||
    process.env.VITE_OPENROUTER_API_KEY ||
    '';
  const openRouterApiKey = rawOpenRouter.trim().replace(/^["']|["']$/g, '');

  const rawNvidia = process.env.NVIDIA_API_KEY || '';
  const nvidiaApiKey = rawNvidia.trim().replace(/^["']|["']$/g, '');

  if (!geminiApiKey && !openRouterApiKey && !nvidiaApiKey) {
    console.error('[api/ai/run] Nenhuma chave de IA (GEMINI_API_KEY, OPENROUTER_API_KEY ou NVIDIA_API_KEY) configurada.');
    return res.status(500).json({
      error: 'Serviço de IA indisponível. Verifique se a variável GEMINI_API_KEY está configurada no painel da Vercel.',
    });
  }

  try {
    const { taskType, context, payload, preferredModel } = req.body || {};

    if (!taskType) {
      return res.status(400).json({ error: 'taskType é obrigatório.' });
    }

    // SCALE_GENERATION não usa IA neste endpoint — retorna array vazio (geração local no cliente)
    if (taskType === 'SCALE_GENERATION') {
      return res.status(200).json([]);
    }

    const useJson = JSON_TASKS.has(taskType);
    const prompt = buildPrompt(taskType, context, payload);

    const content = await callWithFallback(geminiApiKey, openRouterApiKey, nvidiaApiKey, prompt, useJson, preferredModel);
    const result = parseResponse(content, taskType);

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('[api/ai/run] Erro:', error.message || error);
    let errMsg = error.message || 'Falha ao processar tarefa de IA.';
    if (errMsg.includes('503') || errMsg.includes('high demand') || errMsg.includes('UNAVAILABLE')) {
      errMsg = 'O serviço da IA está com alta demanda temporária. Tente novamente em alguns segundos.';
    } else if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED')) {
      errMsg = 'Limite de requisições da IA atingido temporariamente. Aguarde um minuto.';
    }
    return res.status(500).json({
      error: errMsg,
      status: error.status || 500,
    });
  }
}
