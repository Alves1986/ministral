import { SwapRequest } from '../types';

const LOCAL_FUNCTIONS_PREFIX = 'ministral_user_functions_';

/**
 * Salva localmente as funções do usuário naquele ministério como garantia imediata de sincronia.
 */
export function setSavedLocalUserFunctions(
  ministryId: string | undefined | null,
  userId: string | undefined | null,
  functions: string[]
): void {
  if (!ministryId || !userId || typeof window === 'undefined') return;
  try {
    const clean = (Array.isArray(functions) ? functions : []).filter(
      (r) => !String(r).startsWith('__vocal_count:') && !String(r).startsWith('__dance_count:')
    );
    localStorage.setItem(`${LOCAL_FUNCTIONS_PREFIX}${ministryId}_${userId}`, JSON.stringify(clean));
  } catch {
    // ignore storage errors
  }
}

/**
 * Recupera as funções salvas localmente para o usuário no ministério, ou `null` se nunca salvas localmente.
 */
export function getSavedLocalUserFunctions(
  ministryId: string | undefined | null,
  userId: string | undefined | null
): string[] | null {
  if (!ministryId || !userId || typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${LOCAL_FUNCTIONS_PREFIX}${ministryId}_${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Normaliza o nome de uma função de escala:
 * - remove acentos (ex: "Violão" -> "violao", "Dança" -> "danca")
 * - converte para minúsculas
 * - remove espaços extras
 */
export function normalizeSwapRole(role: unknown): string {
  return String(role ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Extrai a função base removendo numeração de vaga da escala
 * (ex: "Vocal 1" -> "vocal", "Vocal 2" -> "vocal", "Dança 3" -> "danca",
 * "Back Vocal 1" -> "back vocal", "Câmera 2" -> "camera")
 * preservando faixas etárias como "Professor 03–06" e unificando sinônimos de dança.
 */
export function normalizeSwapBaseRole(role: unknown): string {
  const norm = normalizeSwapRole(role);
  if (!norm) return '';

  // Remove sufixos numéricos de slot no final ("vocal 1", "vocal #2", "vocal (1)")
  // mas preserva intervalos com hífen/en-dash como "professor 03-06" ou "professor 03–06"
  const withoutSlotNumber = norm
    .replace(/(?<![0-9\u2013\u2014-])(?:\s+#?\d+|\s*\(\d+\))$/g, '')
    .trim();

  if (withoutSlotNumber === 'dancarina' || withoutSlotNumber === 'bailarina') {
    return 'danca';
  }

  return withoutSlotNumber;
}

/**
 * Resolve a lista de funções efetivas do membro no ministério atual.
 * - Se `localSavedFunctions` existir (funções salvas explicitamente pelo usuário neste dispositivo),
 *   une/prioriza quando o banco ainda não refletiu a atualização.
 * - Se `freshFunctions` (vindo de `ministry_members`) trouxer funções preenchidas, usa `freshFunctions`.
 * - Se `freshFunctions` for `null`, `undefined` ou vazio `[]` (ex: usuário sem linha em `ministry_members`
 *   ou delay de sincronização), recorre a `memberFunctions` (`publicMembers`) e `sessionFunctions` (`currentUser.ministry_functions`).
 */
export function resolveUserSwapFunctions(
  freshFunctions: string[] | null | undefined,
  sessionFunctions?: string[] | null,
  memberFunctions?: string[] | null,
  localSavedFunctions?: string[] | null
): string[] {
  // 1. Se o usuário acabou de salvar funções localmente neste dispositivo:
  if (Array.isArray(localSavedFunctions)) {
    return localSavedFunctions;
  }

  // 2. Se a busca fresca do banco retornou funções cadastradas:
  if (Array.isArray(freshFunctions) && freshFunctions.length > 0) {
    return freshFunctions;
  }

  // 3. Se a lista de membros do ministério atual (publicMembers) possui funções para este usuário:
  if (Array.isArray(memberFunctions) && memberFunctions.length > 0) {
    return memberFunctions;
  }

  // 4. Se a busca fresca do banco retornou explicitamente [] (linha existe porém vazia)
  // e não há funções em publicMembers:
  if (Array.isArray(freshFunctions)) {
    return [];
  }

  // 5. Fallback para funções da sessão enquanto a query carrega ou offline:
  return Array.isArray(sessionFunctions) ? sessionFunctions : [];
}

/**
 * Verifica se a lista de funções do membro contém a função exigida pela troca.
 * Suporta tanto correspondência exata ("Violão" === "Violão") quanto correspondência
 * com vaga numerada da escala ("Vocal" casa com "Vocal 1", "Vocal 2", etc.).
 */
export function hasMatchingSwapRole(
  userFunctions: string[] | null | undefined,
  targetRole: unknown
): boolean {
  const normalizedTarget = normalizeSwapRole(targetRole);
  const baseTarget = normalizeSwapBaseRole(targetRole);
  if (!normalizedTarget || !Array.isArray(userFunctions) || userFunctions.length === 0) {
    return false;
  }

  return userFunctions.some((fn) => {
    const normFn = normalizeSwapRole(fn);
    const baseFn = normalizeSwapBaseRole(fn);
    if (!normFn) return false;
    return normFn === normalizedTarget || (Boolean(baseFn && baseTarget) && baseFn === baseTarget);
  });
}

/**
 * Verifica se a data/hora ISO do evento do pedido de troca ainda é futura (ou do dia atual quando sem hora).
 */
export function isSwapEventUpcoming(eventIso: unknown, now: Date = new Date()): boolean {
  const rawIso = String(eventIso ?? '').split('|')[0].trim();
  if (!rawIso) return false;

  // Se vier apenas YYYY-MM-DD sem horário, considera até o fim do dia no fuso local
  const normalizedIso = rawIso.includes('T') ? rawIso : `${rawIso}T23:59:59`;
  const evtDate = new Date(normalizedIso);
  if (Number.isNaN(evtDate.getTime())) return false;

  return evtDate > now;
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

  if (!isSwapEventUpcoming(req.eventIso, now)) return false;

  const isOwnRequest =
    (Boolean(req.requesterId && currentUser.id) && req.requesterId === currentUser.id) ||
    (Boolean(req.requesterName && currentUser.name) &&
      req.requesterName.trim().toLowerCase() === currentUser.name.trim().toLowerCase());

  if (isOwnRequest) return true;

  return hasMatchingSwapRole(effectiveUserFunctions, req.role);
}

/**
 * Filtra os IDs de membros (`profile_id`) que devem receber notificação de um novo pedido de troca:
 * - Devem possuir a mesma função (`role`) em `functions` (incluindo correspondência base ex: "Vocal" para "Vocal 1");
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
    if (!hasMatchingSwapRole(funcs, role)) continue;

    seen.add(pid);
    recipients.push(pid);
  }

  return recipients;
}
