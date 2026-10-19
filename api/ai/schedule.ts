// api/ai/schedule.ts — Função serverless Vercel
// Gera ATRIBUIÇÕES DE ESCALA por IA (Gemini): entende membros, funções,
// disponibilidade e regras de conflito, e devolve um JSON de atribuições.
// Usa REST direto (sem o SDK @google/genai) para evitar erros de bundling.

import { createClient } from '@supabase/supabase-js';
import { buildSchedulePrompt, extractAssignments } from '../../services/aiScheduleUtils.ts';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODELS_FALLBACK = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.0-flash-lite'];

async function callGeminiJSON(apiKey: string, model: string, prompt: string): Promise<string> {
  const url = `${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`;
  const body = {
    systemInstruction: {
      parts: [{ text: 'Você é um assistente especialista em gestão eclesiástica. Responda de forma direta e técnica.' }],
    },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({ error: { message: response.statusText } }));
    const err = new Error(JSON.stringify(errBody?.error || { message: response.statusText }));
    (err as any).status = response.status;
    throw err;
  }

  const data = await response.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text: string = parts.map((p: any) => p.text).join('') || '';
  if (!text) throw new Error('Gemini retornou resposta vazia.');
  return text;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // --- AUTENTICAÇÃO (JWT do Supabase) ---
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const supabaseAnon =
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      '';
    const authHeader = req.headers.authorization || '';
    if (!supabaseUrl || !supabaseAnon || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Não autorizado. Faça login e tente novamente.' });
    }
    const token = authHeader.slice('Bearer '.length);
    const sb = createClient(supabaseUrl, supabaseAnon);
    const { data: { user }, error } = await sb.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
  } catch (authErr: any) {
    console.error('[api/ai/schedule] Erro na autenticação:', authErr?.message || authErr);
    return res.status(500).json({ error: 'Falha ao validar sessão.' });
  }

  const geminiApiKey =
    (process.env.GEMINI_API_KEY?.startsWith('AIzaSy') ? process.env.GEMINI_API_KEY : '') ||
    (process.env.VITE_GEMINI_API_KEY?.startsWith('AIzaSy') ? process.env.VITE_GEMINI_API_KEY : '') ||
    process.env.GEMINI_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    '';

  const openRouterApiKey = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY || '';

  if (!geminiApiKey && !openRouterApiKey) {
    return res.status(500).json({ error: 'Serviço de IA temporariamente indisponível.' });
  }

  try {
    const { occurrences, roles, members, availability, existingAssignments, rules, eventRoleExcludes, memberNotes, mode, model } = req.body || {};

    // Rebalance fica por conta do cliente (algoritmo local determinístico)
    if (mode === 'rebalance') {
      return res.status(200).json([]);
    }

    if (!Array.isArray(occurrences) || occurrences.length === 0) {
      return res.status(200).json([]);
    }

    const prompt = buildSchedulePrompt({
      occurrences,
      roles: roles || [],
      members: members || [],
      availability: availability || {},
      existingAssignments: existingAssignments || [],
      rules: rules || {},
      eventRoleExcludes: eventRoleExcludes || undefined,
      memberNotes: memberNotes || undefined,
    });

    const knownModels = MODELS_FALLBACK;
    const order =
      model && knownModels.includes(model)
        ? [model, ...knownModels.filter((m) => m !== model)]
        : knownModels;

    let lastErr: Error | null = null;
    let raw = '';
    for (const m of order) {
      try {
        raw = await callGeminiJSON(geminiApiKey, m, prompt);
        break;
      } catch (err: any) {
        lastErr = err;
        console.warn(`[api/ai/schedule] Modelo ${m} falhou (${err?.status || 0}): ${(err?.message || '').slice(0, 150)}`);
      }
    }
    if (!raw) throw lastErr || new Error('Todos os modelos falharam.');

    const assignments = extractAssignments(raw);
    return res.status(200).json(assignments);
  } catch (error: any) {
    console.error('[api/ai/schedule] Erro:', error?.message || error);
    return res.status(500).json({ error: 'Falha ao gerar escala com IA.' });
  }
}