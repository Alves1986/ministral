/**
 * Utilitário para filtragem e roteamento seguro de notificações.
 * Garante privacidade absoluta: notificações individuais são entregues
 * estritamente ao voluntário alvo, impedindo vazamento para outros membros ou admins.
 */

export interface RawNotificationItem {
  id: string;
  ministry_id?: string | null;
  organization_id?: string | null;
  title: string;
  message: string;
  type?: string | null;
  action_link?: string | null;
  target_user_id?: string | null;
  targetUserId?: string | null;
  user_id?: string | null;
  [key: string]: any;
}

export function filterNotificationsForUser(
  notifications: RawNotificationItem[],
  userId: string,
  allowedMinistryIds: string[],
  isAdmin: boolean = false
): RawNotificationItem[] {
  if (!Array.isArray(notifications)) return [];

  const validMinistryIds = (allowedMinistryIds || []).filter(Boolean);

  return notifications.filter((n) => {
    const target = n.target_user_id || n.targetUserId || (n as any).user_id;

    // 1. REGRA ABSOLUTA DE PRIVACIDADE:
    // Se a notificação tem um usuário específico de destino,
    // ELA SÓ PODE SER ENTREGUE AO PRÓPRIO USUÁRIO DESTINATÁRIO!
    // Nem mesmo admins ou outros voluntários podem recebê-la.
    if (target) {
      return target === userId;
    }

    // 2. Notificações administrativas (join_request) só vão para administradores
    if (n.type === 'join_request') {
      if (!isAdmin) return false;
      // Se for join_request de um ministério específico, o admin deve participar daquele ministério
      if (n.ministry_id && validMinistryIds.length > 0) {
        return validMinistryIds.includes(n.ministry_id);
      }
      return true;
    }

    // 3. Avisos restritos a administradores
    if (!isAdmin && (n.action_link === 'super-admin-message' || n.action_link === 'super-admin-broadcast-admins')) {
      return false;
    }

    // 4. Notificações de ministério sem target (comunicados coletivos/broadcast):
    // Só devem ser entregues se o usuário pertencer àquele ministério
    if (n.ministry_id) {
      return validMinistryIds.includes(n.ministry_id);
    }

    // 5. Comunicados globais da organização (ministry_id nulo e target_user_id nulo)
    return true;
  });
}
