import { generateScheduleLocally, generateScheduleWithAI } from './aiOrchestrator';

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
  eventRoleExcludes?: Record<string, string[]>;
  memberNotes?: Record<string, string>;
  mode?: 'fill' | 'rebalance';
}

/**
 * Gera atribuições de escala usando a IA (assistente que entende membros,
 * funções, disponibilidade e regras de conflito).
 *
 * - Navegador: chama a função Vercel `/api/ai/schedule` (com JWT). Se falhar
 *   (rede, erro 5xx, quota), usa a geração local (heurística) como fallback.
 * - Servidor (dev/serverless): usa o orchestrator, que tenta a IA real e
 *   cai no algoritmo local se a IA falhar.
 */
export const generateAISchedule = async (input: ScheduleInput, model?: string) => {
  // Rebalance é um algoritmo determinístico local (troca de equilíbrio) —
  // não passa pela IA (a IA preenche vagas novas; rebalance reorganiza as existentes).
  if (input.mode === 'rebalance') {
    return generateScheduleLocally(input as any);
  }

  if (typeof window !== 'undefined') {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      try {
        const { getSupabase } = await import('./supabase/client');
        const sb = getSupabase();
        if (sb) {
          const { data: { session } } = await sb.auth.getSession();
          if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`;
          }
        }
      } catch (e) {
        console.warn('[aiScheduleService] Não foi possível anexar token de sessão:', e);
      }

      const res = await fetch('/api/ai/schedule', {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...input, model }),
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
      } else {
        const errJson = await res.json().catch(() => null);
        console.warn('[aiScheduleService] /api/ai/schedule retornou erro:', res.status, errJson);
      }
      console.warn('[aiScheduleService] /api/ai/schedule não retornou atribuições; usando geração local.');
    } catch (e) {
      console.warn('[aiScheduleService] Erro ao chamar a IA; usando geração local:', e);
    }
    return generateScheduleLocally(input as any);
  }

  try {
    const result: any = await generateScheduleWithAI(input, model);
    return Array.isArray(result) ? result : (result.assignments || []);
  } catch (error) {
    console.error('[aiScheduleService] Error generating schedule:', error);
    return [];
  }
};
