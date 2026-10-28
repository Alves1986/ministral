import { describe, it, expect } from 'vitest';
import { 
  deduplicatePlaylistNotifications,
  canDispatchPlaylistNotification,
  resetPlaylistNotificationCooldown,
  extractPlaylistNotificationKey
} from '../utils/repertoireUtils';
import { AppNotification } from '../types';

describe('Deduplicação e Controle de Notificações de Playlist (repertoirePlaylistNotification)', () => {
  describe('extractPlaylistNotificationKey', () => {
    it('deve extrair a chave correta com base na data e no identificador do culto', () => {
      const notif: AppNotification = {
        id: 'n-1',
        title: '🎵 Playlist para Projeção Disponível!',
        message: 'O louvor postou a playlist para o Culto Dom - Noite (28/10/2026) com 5 músicas.',
        type: 'info',
        timestamp: new Date().toISOString(),
        read: false,
        actionLink: 'repertoire'
      };

      const key = extractPlaylistNotificationKey(notif);
      expect(key).toBe('playlist_28/10/2026_noite');
    });

    it('deve retornar null se não for notificação relacionada a playlist ou repertório', () => {
      const notif: AppNotification = {
        id: 'n-2',
        title: 'Nova Troca Solicitada',
        message: 'Você tem uma nova solicitação de troca.',
        type: 'info',
        timestamp: new Date().toISOString(),
        read: false,
        actionLink: 'schedule'
      };

      expect(extractPlaylistNotificationKey(notif)).toBeNull();
    });
  });

  describe('deduplicatePlaylistNotifications', () => {
    it('deve consolidar notificações de playlist repetidas para o mesmo culto na mesma data', () => {
      const now = new Date().toISOString();
      const notifications: AppNotification[] = [
        {
          id: 'notif-1',
          ministryId: 'min-louvor',
          ministryName: 'Louvor',
          organizationId: 'org-1',
          title: '🎵 Playlist do Culto Postada!',
          message: 'A playlist para o Culto Dom - Noite (28/10/2026) foi publicada no repertório com 4 músicas.',
          type: 'info',
          timestamp: now,
          read: false,
          actionLink: 'repertoire'
        },
        {
          id: 'notif-2',
          ministryId: 'min-danca',
          ministryName: 'Dança',
          organizationId: 'org-1',
          title: '💃 Repertório de Louvor para Dança!',
          message: 'O louvor postou a playlist para o Culto Dom - Noite (28/10/2026) com 4 músicas. Playlist disponível no repertório para ensaio de coreografia!',
          type: 'info',
          timestamp: now,
          read: false,
          actionLink: 'repertoire'
        },
        {
          id: 'notif-3',
          ministryId: 'min-louvor',
          ministryName: 'Louvor',
          organizationId: 'org-1',
          title: 'Nova Playlist no Repertório',
          message: 'Marcos publicou a playlist para o Culto Dom - Noite (28/10/2026) com 4 músicas.',
          type: 'info',
          timestamp: now,
          read: false,
          actionLink: 'repertoire'
        },
        {
          id: 'notif-outra',
          ministryId: 'min-louvor',
          ministryName: 'Louvor',
          organizationId: 'org-1',
          title: 'Escala Publicada',
          message: 'A escala do mês de Novembro foi liberada.',
          type: 'success',
          timestamp: now,
          read: false,
          actionLink: 'schedule'
        }
      ];

      const deduplicated = deduplicatePlaylistNotifications(notifications);

      // Deve manter a notificação de escala e apenas UMA notificação consolidada de playlist para o Culto Dom - Noite
      expect(deduplicated.length).toBe(2);
      const playlistNotif = deduplicated.find(n => n.actionLink === 'repertoire');
      expect(playlistNotif).toBeDefined();
      expect(playlistNotif?.title).toContain('Playlist');

      const scheduleNotif = deduplicated.find(n => n.actionLink === 'schedule');
      expect(scheduleNotif).toBeDefined();
    });

    it('não deve agrupar playlists de cultos diferentes na mesma data (ex: Manhã vs Noite)', () => {
      const now = new Date().toISOString();
      const notifications: AppNotification[] = [
        {
          id: 'notif-manha',
          ministryId: 'min-louvor',
          ministryName: 'Louvor',
          organizationId: 'org-1',
          title: '🎵 Playlist do Culto Postada!',
          message: 'A playlist para o Culto Dom - Manhã (25/10/2026) foi publicada no repertório com 3 músicas.',
          type: 'info',
          timestamp: now,
          read: false,
          actionLink: 'repertoire'
        },
        {
          id: 'notif-noite',
          ministryId: 'min-louvor',
          ministryName: 'Louvor',
          organizationId: 'org-1',
          title: '🎵 Playlist do Culto Postada!',
          message: 'A playlist para o Culto Dom - Noite (25/10/2026) foi publicada no repertório com 4 músicas.',
          type: 'info',
          timestamp: now,
          read: false,
          actionLink: 'repertoire'
        }
      ];

      const deduplicated = deduplicatePlaylistNotifications(notifications);
      expect(deduplicated.length).toBe(2);
    });
  });

  describe('canDispatchPlaylistNotification (Debounce e Idempotência)', () => {
    it('deve bloquear disparos repetidos para a mesma playlist no intervalo de cooldown', () => {
      resetPlaylistNotificationCooldown();

      const key = 'org-1_min-louvor_2026-10-28_rule-dom-noite';
      expect(canDispatchPlaylistNotification(key)).toBe(true);

      // Tentativa imediata deve ser bloqueada
      expect(canDispatchPlaylistNotification(key)).toBe(false);

      // Chave diferente deve ser permitida
      const differentKey = 'org-1_min-louvor_2026-10-28_rule-dom-manha';
      expect(canDispatchPlaylistNotification(differentKey)).toBe(true);
    });
  });
});

