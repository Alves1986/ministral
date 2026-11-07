import { SwapRequest } from '../types';

/**
 * Normaliza o nome de uma função de escala (trim + lowercase)
 */
export function normalizeSwapRole(role: unknown): string {
  return String(role ?? '').trim().toLowerCase();
}

/**
 * Resolve a lista de funções efetivas do membro no ministério atual.
 * Quando a busca fresca do banco (`freshFunctions`) já retornou um array
 * (mesmo que vazio `[]`, ex: funções recém-removidas), ela tem precedência
 * sobre o estado em cache da sessão (`sessionFunctions`).
 */
export function resolveUserSwapFunctions(
  freshFunctions: string[] | null | undefined,
  sessionFunctions?: string[] | null
): string[] {
  if (Array.isArray(freshFunctions)) {
    return freshFunctions;
  }
  return Array.isArray(sessionFunctions) ? sessionFunctions : [];
}

/**
 * Verifica se a lista de funções do membro contém a função exigida pela troca.
 */
export function hasMatchingSwapRole(
  userFunctions: string[] | null | undefined,
  targetRole: unknown
): boolean {
  const normalizedTarget = normalizeSwapRole(targetRole);
  if (!normalizedTarget || !Array.isArray(userFunctions) || userFunctions.length === 0) {
    return false;
  }
  return userFunctions.some((fn) => normalizeSwapRole(fn) === normalizedTarget);
}

/**
 * Determina se um pedido de troca deve aparecer no Mural de Trocas para o usuário atual.
 * Regra:
 * - Apenas pedidos `pending` e de eventos futuros;
 * - O próprio solicitante sempre vê o seu pedido (para poder cancelar);
 * - Qualquer outro membro (inclusive Admin) só vê se possuir a MESMA função do pedido.
 */
export function isSwapRequestVisibleToUser(
  req: Pick<SwapRequest, 'status' | 'eventIso' | 'requesterName' | 'requesterId' | 'role'>,
  currentUser: { id?: string; name: string; access_role?: string },
  effectiveUserFunctions: string[],
  now: Date = new Date()
): boolean {
  if (req.status !== 'pending') return false;

  const evtIso = (req.eventIso || '').split('|')[0];
  if (!evtIso || new Date(evtIso) <= now) return false;

  const isOwnRequest =
    (Boolean(req.requesterId && currentUser.id) && req.requesterId === currentUser.id) ||
    req.requesterName === currentUser.name;

  if (isOwnRequest) return true;

  return hasMatchingSwapRole(effectiveUserFunctions, req.role);
}

/**
 * Filtra os IDs de membros (`profile_id`) que devem receber notificação de um novo pedido de troca:
 * - Devem possuir a mesma função (`role`) em `functions`;
 * - Não notifica o próprio solicitante (`requesterId`);
 * - Sem duplicatas.
 */
export function getSwapNotificationRecipientIds(
  memberships: Array<{ profile_id?: string | null; functions?: unknown }>,
  role: unknown,
  requesterId?: string | null
): string[] {
  const normalizedTarget = normalizeSwapRole(role);
  if (!normalizedTarget || !Array.isArray(memberships)) return [];

  const seen = new Set<string>();
  const recipients: string[] = [];

  for (const m of memberships) {
    const pid = m?.profile_id;
    if (!pid || seen.has(pid)) continue;
    if (requesterId && pid === requesterId) continue;

    const funcs = Array.isArray(m.functions) ? (m.functions as string[]) : [];
    if (!hasMatchingSwapRole(funcs, normalizedTarget)) continue;

    seen.add(pid);
    recipients.push(pid);
  }

  return recipients;
}

