import { describe, it, expect } from 'vitest';
import { filterNotificationsForUser } from '../utils/notificationFilter';

describe('Isolamento e Roteamento Seguro de Notificações (notificationsRouting)', () => {
  const adminId = 'admin-uuid-1';
  const memberAId = 'member-a-uuid';
  const memberBId = 'member-b-uuid';

  const ministryLouvorId = 'min-louvor-id';
  const ministryMidiaId = 'min-midia-id';
  const ministryDancaId = 'min-danca-id';

  const mockNotifications = [
    // 1. Notificação individual da escala para Membro A no Louvor
    {
      id: 'notif-1',
      ministry_id: ministryLouvorId,
      title: '📅 Escala de Outubro liberada',
      message: 'Membro A, você está escalado(a) em: 01/11 - Culto (Vocal).',
      target_user_id: memberAId,
      type: 'success',
      action_link: 'history',
    },
    // 2. Notificação individual da escala para Membro B no Louvor
    {
      id: 'notif-2',
      ministry_id: ministryLouvorId,
      title: '📅 Escala de Outubro liberada',
      message: 'Membro B, você está escalado(a) em: 08/11 - Culto (Bateria).',
      target_user_id: memberBId,
      type: 'success',
      action_link: 'history',
    },
    // 3. Notificação individual da escala para o Admin (que também foi escalado no Louvor)
    {
      id: 'notif-3',
      ministry_id: ministryLouvorId,
      title: '📅 Escala de Outubro liberada',
      message: 'Admin, você está escalado(a) em: 15/11 - Culto (Violão).',
      target_user_id: adminId,
      type: 'success',
      action_link: 'history',
    },
    // 4. Comunicado geral da escala liberada para o Louvor (broadcast sem target_user_id)
    {
      id: 'notif-4',
      ministry_id: ministryLouvorId,
      title: '📅 Escala de Outubro liberada',
      message: 'A escala oficial de Outubro já está disponível no calendário.',
      target_user_id: null,
      type: 'info',
      action_link: 'calendar',
    },
    // 5. Solicitação de entrada de novo membro no Louvor (join_request)
    {
      id: 'notif-5',
      ministry_id: ministryLouvorId,
      title: 'Solicitação de Entrada',
      message: 'Novo voluntário solicitou entrada na equipe.',
      target_user_id: null,
      type: 'join_request',
      action_link: 'members',
    },
    // 6. Comunicado geral da Dança (ministério que o admin do Louvor/Mídia não participa)
    {
      id: 'notif-6',
      ministry_id: ministryDancaId,
      title: 'Ensaio Geral da Dança',
      message: 'Ensaio marcado para sábado às 14h.',
      target_user_id: null,
      type: 'info',
    },
    // 7. Comunicado global da Igreja (sem ministério e sem target)
    {
      id: 'notif-7',
      ministry_id: null,
      title: 'Culto de Missões',
      message: 'Todos convidados para o culto especial.',
      target_user_id: null,
      type: 'info',
    },
  ];

  it('o admin em 2 ministérios (Louvor e Mídia) NÃO deve receber notificações particulares de escala dos outros membros', () => {
    const adminAllowedMids = [ministryLouvorId, ministryMidiaId];
    const adminNotifs = filterNotificationsForUser(mockNotifications, adminId, adminAllowedMids, true);

    const receivedIds = adminNotifs.map(n => n.id);

    // Deve receber a sua própria notificação de escala
    expect(receivedIds).toContain('notif-3');

    // Deve receber o comunicado geral do Louvor
    expect(receivedIds).toContain('notif-4');

    // Deve receber solicitações de entrada (join_request) como admin
    expect(receivedIds).toContain('notif-5');

    // Deve receber comunicados globais da organização
    expect(receivedIds).toContain('notif-7');

    // CRÍTICO: NÃO deve receber a notificação individual do Membro A nem do Membro B!
    expect(receivedIds).not.toContain('notif-1');
    expect(receivedIds).not.toContain('notif-2');

    // Não deve receber comunicados de ministérios aos quais não pertence (Dança)
    expect(receivedIds).not.toContain('notif-6');
  });

  it('o Membro A deve receber APENAS a sua notificação individual e comunicados gerais de seu ministério', () => {
    const memberAAllowedMids = [ministryLouvorId];
    const memberANotifs = filterNotificationsForUser(mockNotifications, memberAId, memberAAllowedMids, false);

    const receivedIds = memberANotifs.map(n => n.id);

    // Deve receber sua própria notificação
    expect(receivedIds).toContain('notif-1');

    // Deve receber o comunicado geral do Louvor
    expect(receivedIds).toContain('notif-4');

    // Deve receber o comunicado global
    expect(receivedIds).toContain('notif-7');

    // CRÍTICO: NÃO deve receber a notificação do Membro B nem do Admin
    expect(receivedIds).not.toContain('notif-2');
    expect(receivedIds).not.toContain('notif-3');

    // Não deve receber solicitações de admin (join_request)
    expect(receivedIds).not.toContain('notif-5');

    // Não deve receber comunicados da Dança
    expect(receivedIds).not.toContain('notif-6');
  });

  it('o Membro B deve receber APENAS a sua própria notificação e nunca a do Membro A', () => {
    const memberBAllowedMids = [ministryLouvorId];
    const memberBNotifs = filterNotificationsForUser(mockNotifications, memberBId, memberBAllowedMids, false);

    const receivedIds = memberBNotifs.map(n => n.id);

    expect(receivedIds).toContain('notif-2');
    expect(receivedIds).not.toContain('notif-1');
    expect(receivedIds).not.toContain('notif-3');
    expect(receivedIds).not.toContain('notif-5');
  });
});
