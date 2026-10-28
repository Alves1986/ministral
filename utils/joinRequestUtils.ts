/**
 * Utilitários de validação e isolamento de solicitações de entrada (join_request).
 * Previne duplicidade de solicitações e vazamento de pedidos entre ministérios.
 */

export interface JoinEligibilityResult {
  canJoin: boolean;
  reason: 'already_member' | 'already_pending' | 'eligible';
  message?: string;
}

/**
 * Extrai o ID do ministério a partir de uma notificação com suporte a payloads JSON e legados.
 */
export function extractMinistryIdFromNotification(n: any): string | null {
  if (!n) return null;

  // 1. Campo de primeiro nível
  const rootMid = n.ministry_id || n.ministryId;
  if (rootMid && typeof rootMid === 'string' && rootMid.trim() !== '' && rootMid !== 'undefined' && rootMid !== 'null') {
    return rootMid.trim();
  }

  // 2. Extrai de action_link / actionLink se for JSON
  const actionLink = n.action_link || n.actionLink;
  if (typeof actionLink === 'string') {
    const trimmed = actionLink.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        const mid = parsed.ministryId || parsed.targetMinistryId || parsed.ministry_id;
        if (mid && typeof mid === 'string' && mid.trim() !== '') {
          return mid.trim();
        }
      } catch {}
    }
  }

  // 3. Extrai de marcadores embutidos em message
  const msg = typeof n.message === 'string' ? n.message : '';
  const markerMatch = msg.match(/\[DADOS_SOLICITACAO:(.*?)\]/) || msg.match(/<!--JOIN_DATA:(.*?)-->/);
  if (markerMatch && markerMatch[1]) {
    try {
      const parsed = JSON.parse(markerMatch[1]);
      const mid = parsed.ministryId || parsed.targetMinistryId || parsed.ministry_id;
      if (mid && typeof mid === 'string' && mid.trim() !== '') {
        return mid.trim();
      }
    } catch {}
  }

  return null;
}

/**
 * Verifica se a notificação pertence estritamente ao ministério informado.
 * NUNCA aceita notificações sem ministério comprovado para evitar vazamentos na interface.
 */
export function isNotificationForMinistry(n: any, ministryId: string): boolean {
  if (!n || !ministryId) return false;
  const notifMinId = extractMinistryIdFromNotification(n);
  if (!notifMinId) return false;
  return notifMinId === ministryId;
}

/**
 * Valida se um usuário pode solicitar entrada em um ministério.
 * Bloqueia se o usuário já for membro ativo ou se já houver um pedido pendente.
 */
export function validateJoinMinistryEligibility(
  userId: string,
  ministryId: string,
  existingMembers: Array<{ profile_id?: string; id?: string; ministry_id?: string }>,
  allowedMinistries: string[] = [],
  pendingRequests: any[] = []
): JoinEligibilityResult {
  if (!userId || !ministryId) {
    return { canJoin: false, reason: 'already_member', message: 'Dados inválidos para solicitação.' };
  }

  // 1. Checa se já é membro ativo na tabela canônica ministry_members
  const isAlreadyInMembers = (existingMembers || []).some(
    m => (m.profile_id === userId || m.id === userId) && (!m.ministry_id || m.ministry_id === ministryId)
  );

  if (isAlreadyInMembers) {
    return {
      canJoin: false,
      reason: 'already_member',
      message: 'Você já faz parte deste ministério.',
    };
  }

  // 2. Checa se já tem acesso em allowed_ministries
  if (allowedMinistries.includes(ministryId)) {
    return {
      canJoin: false,
      reason: 'already_member',
      message: 'Você já faz parte deste ministério.',
    };
  }

  // 3. Checa se já possui uma solicitação pendente para este ministério
  const hasPending = (pendingRequests || []).some(n => {
    if (!n) return false;
    const notifMid = extractMinistryIdFromNotification(n);
    if (notifMid !== ministryId) return false;

    // Checa targetUserId / target_user_id
    const targetUid = n.target_user_id || n.targetUserId || n.user_id;
    if (targetUid === userId) return true;

    // Checa payload em actionLink / action_link
    const al = n.action_link || n.actionLink;
    if (typeof al === 'string' && al.includes(userId)) return true;

    return false;
  });

  if (hasPending) {
    return {
      canJoin: false,
      reason: 'already_pending',
      message: 'Sua solicitação de entrada para este ministério já foi enviada e está aguardando aprovação.',
    };
  }

  return { canJoin: true, reason: 'eligible' };
}
