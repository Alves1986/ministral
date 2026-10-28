/**
 * Utilitário para filtragem e roteamento seguro de notificações.
 * Garante privacidade absoluta: notificações individuais são entregues
 * estritamente ao voluntário alvo, impedindo vazamento para outros membros ou admins.
 */

import { extractMinistryIdFromNotification } from './joinRequestUtils';

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
  isAdmin: boolean = false,
  isOrgAdminOrSuper: boolean = false
): RawNotificationItem[] {
  if (!Array.isArray(notifications)) return [];

  const validMinistryIds = (allowedMinistryIds || []).filter(Boolean);

  return notifications.filter((n) => {
    // 1. Notificações administrativas de entrada (join_request)
    if (n.type === 'join_request') {
      if (!isAdmin) return false;

      // Se for super admin ou org admin geral, pode visualizar solicitações de todos os ministérios
      if (isOrgAdminOrSuper) return true;

      // Admin comum de ministério: SÓ pode visualizar se a solicitação for do seu ministério
      const targetMid = extractMinistryIdFromNotification(n);
      if (targetMid) {
        return validMinistryIds.includes(targetMid);
      }
      // Se não puder comprovar o ministério de destino, nunca exibe para admin de outro ministério
      return false;
    }

    const target = n.target_user_id || n.targetUserId || (n as any).user_id;

    // 2. REGRA ABSOLUTA DE PRIVACIDADE:
    // Se a notificação tem um usuário específico de destino,
    // ELA SÓ PODE SER ENTREGUE AO PRÓPRIO USUÁRIO DESTINATÁRIO!
    // Nem mesmo admins ou outros voluntários podem recebê-la.
    if (target) {
      return target === userId;
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


