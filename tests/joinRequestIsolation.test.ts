import { describe, it, expect } from 'vitest';
import { filterNotificationsForUser } from '../utils/notificationFilter';
import { 
  isNotificationForMinistry, 
  validateJoinMinistryEligibility,
  sanitizeNotificationMessage
} from '../utils/joinRequestUtils';

describe('Isolamento de Solicitações de Entrada e Travas (joinRequestIsolation)', () => {
  const adminLouvorMidiaId = 'admin-louvor-midia-id';
  const adminDancaId = 'admin-danca-id';
  const superAdminId = 'super-admin-id';

  const ministryLouvorId = 'min-louvor-id';
  const ministryMidiaId = 'min-midia-id';
  const ministryDancaId = 'min-danca-id';

  const mockNotifications = [
    // 1. Solicitação de Entrada no Louvor
    {
      id: 'notif-join-louvor',
      ministry_id: ministryLouvorId,
      title: 'Solicitação de Entrada',
      message: 'O usuário João solicitou entrada no ministério Louvor.',
      type: 'join_request',
      action_link: JSON.stringify({ userId: 'user-joao', ministryId: ministryLouvorId, userName: 'João' }),
    },
    // 2. Solicitação de Entrada na Dança
    {
      id: 'notif-join-danca',
      ministry_id: ministryDancaId,
      title: 'Solicitação de Entrada',
      message: 'O usuário Maria solicitou entrada no ministério Dança.',
      type: 'join_request',
      action_link: JSON.stringify({ userId: 'user-maria', ministryId: ministryDancaId, userName: 'Maria' }),
    },
    // 3. Solicitação de Entrada na Dança com ministry_id nulo no topo mas presente no action_link
    {
      id: 'notif-join-danca-legacy',
      ministry_id: null,
      title: 'Solicitação de Entrada',
      message: 'O usuário Pedro solicitou entrada no ministério Dança.',
      type: 'join_request',
      action_link: JSON.stringify({ userId: 'user-pedro', ministryId: ministryDancaId, userName: 'Pedro' }),
    },
    // 4. Solicitação sem qualquer menção de ministério (não verificável)
    {
      id: 'notif-join-unknown',
      ministry_id: null,
      title: 'Solicitação de Entrada',
      message: 'O usuário SemMinistério solicitou entrada.',
      type: 'join_request',
      action_link: JSON.stringify({ userId: 'user-anon' }),
    },
  ];

  it('admin de Louvor e Mídia NÃO deve receber notificações de solicitação de entrada da Dança', () => {
    const adminAllowedMids = [ministryLouvorId, ministryMidiaId];
    const filtered = filterNotificationsForUser(mockNotifications, adminLouvorMidiaId, adminAllowedMids, true);
    const ids = filtered.map(n => n.id);

    // Deve receber apenas a do Louvor
    expect(ids).toContain('notif-join-louvor');

    // NÃO deve receber as solicitações da Dança
    expect(ids).not.toContain('notif-join-danca');
    expect(ids).not.toContain('notif-join-danca-legacy');
    expect(ids).not.toContain('notif-join-unknown');
  });

  it('admin da Dança deve receber as solicitações de entrada da Dança', () => {
    const adminAllowedMids = [ministryDancaId];
    const filtered = filterNotificationsForUser(mockNotifications, adminDancaId, adminAllowedMids, true);
    const ids = filtered.map(n => n.id);

    expect(ids).toContain('notif-join-danca');
    expect(ids).toContain('notif-join-danca-legacy');
    expect(ids).not.toContain('notif-join-louvor');
  });

  it('Super Admin / Org Admin Geral pode receber solicitações de todos os ministérios', () => {
    const filtered = filterNotificationsForUser(mockNotifications, superAdminId, [ministryLouvorId, ministryMidiaId, ministryDancaId], true, true);
    const ids = filtered.map(n => n.id);

    expect(ids).toContain('notif-join-louvor');
    expect(ids).toContain('notif-join-danca');
  });

  describe('isNotificationForMinistry (filtro estrito na tela de membros e dashboard)', () => {
    it('deve retornar true apenas quando o ministério bate com o ministério ativo', () => {
      expect(isNotificationForMinistry(mockNotifications[0], ministryLouvorId)).toBe(true);
      expect(isNotificationForMinistry(mockNotifications[0], ministryDancaId)).toBe(false);

      expect(isNotificationForMinistry(mockNotifications[1], ministryDancaId)).toBe(true);
      expect(isNotificationForMinistry(mockNotifications[1], ministryLouvorId)).toBe(false);

      // Notificação legada com ministry_id nulo no root mas presente no payload
      expect(isNotificationForMinistry(mockNotifications[2], ministryDancaId)).toBe(true);
      expect(isNotificationForMinistry(mockNotifications[2], ministryLouvorId)).toBe(false);

      // Notificação sem ministério não deve vazar em nenhum ministério
      expect(isNotificationForMinistry(mockNotifications[3], ministryLouvorId)).toBe(false);
      expect(isNotificationForMinistry(mockNotifications[3], ministryDancaId)).toBe(false);
    });
  });

  describe('validateJoinMinistryEligibility (trava de solicitações duplicadas ou indevidas)', () => {
    const userId = 'user-test-123';
    const targetMinId = 'min-danca-id';

    it('deve rejeitar solicitação se o membro já estiver em ministry_members', () => {
      const existingMembers = [{ profile_id: userId, ministry_id: targetMinId }];
      const allowedMinistries = [targetMinId];
      const pendingRequests: any[] = [];

      const result = validateJoinMinistryEligibility(userId, targetMinId, existingMembers, allowedMinistries, pendingRequests);
      expect(result.canJoin).toBe(false);
      expect(result.reason).toBe('already_member');
      expect(result.message).toContain('Você já faz parte');
    });

    it('deve rejeitar solicitação se o membro já tiver o ministério em profiles.allowed_ministries', () => {
      const existingMembers: any[] = [];
      const allowedMinistries = [targetMinId];
      const pendingRequests: any[] = [];

      const result = validateJoinMinistryEligibility(userId, targetMinId, existingMembers, allowedMinistries, pendingRequests);
      expect(result.canJoin).toBe(false);
      expect(result.reason).toBe('already_member');
    });

    it('deve rejeitar solicitação se já houver um pedido pendente para o mesmo usuário e ministério', () => {
      const existingMembers: any[] = [];
      const allowedMinistries: string[] = ['min-louvor-id'];
      const pendingRequests = [
        {
          id: 'pending-1',
          ministry_id: targetMinId,
          type: 'join_request',
          target_user_id: userId,
        }
      ];

      const result = validateJoinMinistryEligibility(userId, targetMinId, existingMembers, allowedMinistries, pendingRequests);
      expect(result.canJoin).toBe(false);
      expect(result.reason).toBe('already_pending');
      expect(result.message).toContain('já foi enviada');
    });

    it('deve permitir solicitação se o membro for elegível e não tiver pedido pendente', () => {
      const existingMembers: any[] = [];
      const allowedMinistries: string[] = ['min-louvor-id'];
      const pendingRequests: any[] = [];

      const result = validateJoinMinistryEligibility(userId, targetMinId, existingMembers, allowedMinistries, pendingRequests);
      expect(result.canJoin).toBe(true);
      expect(result.reason).toBe('eligible');
    });
  });

  describe('sanitizeNotificationMessage (higienização contra vazamento de JSON e metadados)', () => {
    it('deve remover marcadores [DADOS_SOLICITACAO:{...}] e manter a mensagem limpa', () => {
      const dirty = 'O usuário Lucas solicitou entrada no ministério Dança.\n[DADOS_SOLICITACAO:{"userId":"uuid-123","userName":"Lucas","userEmail":"lucas@email.com"}]';
      const clean = sanitizeNotificationMessage(dirty);
      expect(clean).toBe('O usuário Lucas solicitou entrada no ministério Dança.');
      expect(clean).not.toContain('DADOS_SOLICITACAO');
      expect(clean).not.toContain('uuid-123');
      expect(clean).not.toContain('lucas@email.com');
    });

    it('deve remover marcadores legados <!--JOIN_DATA:...--> e payloads JSON soltos', () => {
      const dirty = 'O voluntário Ana pediu entrada. <!--JOIN_DATA:{"userId":"abc"}--> {"userId":"abc","email":"a@b.com"}';
      const clean = sanitizeNotificationMessage(dirty);
      expect(clean).toBe('O voluntário Ana pediu entrada.');
      expect(clean).not.toContain('JOIN_DATA');
      expect(clean).not.toContain('userId');
    });

    it('deve deduplicar repetição de (Ministério: ...)', () => {
      const duplicated = 'O usuário Marcos entrou no ministério Louvor (Ministério: Louvor) (Ministério: Louvor)';
      const clean = sanitizeNotificationMessage(duplicated);
      expect(clean).toBe('O usuário Marcos entrou no ministério Louvor (Ministério: Louvor)');
    });
  });
});

