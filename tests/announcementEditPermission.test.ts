import { describe, it, expect } from 'vitest';
import {
  encodeAnnouncementAuthor,
  parseAnnouncementAuthor,
  canUserEditAnnouncement,
} from '../utils/announcementUtils';

describe('Permissão Estrita de Edição de Avisos pelo Criador (announcementEditPermission)', () => {
  it('deve codificar e decodificar o nome do autor e ID do criador de forma transparente', () => {
    const encoded = encodeAnnouncementAuthor('Gilmara Silva', 'user-uuid-123');
    expect(encoded).toBe('Gilmara Silva::uid:user-uuid-123');

    const parsed = parseAnnouncementAuthor(encoded, null);
    expect(parsed.author).toBe('Gilmara Silva');
    expect(parsed.createdBy).toBe('user-uuid-123');
  });

  it('deve permitir editar o aviso APENAS para o usuário que o criou (por ID)', () => {
    const announcement = {
      author: 'Gilmara Silva',
      createdBy: 'user-gilmara-1',
      authorId: 'user-gilmara-1',
    };

    // Criadora do aviso -> PODE editar
    expect(
      canUserEditAnnouncement(announcement, { id: 'user-gilmara-1', name: 'Gilmara Silva' })
    ).toBe(true);

    // Outro administrador com ID diferente -> NÃO PODE editar
    expect(
      canUserEditAnnouncement(announcement, { id: 'user-admin-2', name: 'Carlos Admin' })
    ).toBe(false);

    // Outro usuário mesmo com nome igual mas ID diferente -> NÃO PODE editar
    expect(
      canUserEditAnnouncement(announcement, { id: 'user-outro-3', name: 'Gilmara Silva' })
    ).toBe(false);
  });

  it('deve permitir editar avisos legados (sem created_by no banco) apenas quando o author_name corresponde exatamente ao usuário logado', () => {
    const legacyAnnouncement = {
      author: 'Gilmara Silva',
      createdBy: undefined,
      authorId: undefined,
    };

    expect(
      canUserEditAnnouncement(legacyAnnouncement, { id: 'user-gilmara-1', name: 'Gilmara Silva' })
    ).toBe(true);

    expect(
      canUserEditAnnouncement(legacyAnnouncement, { id: 'user-admin-2', name: 'Carlos Admin' })
    ).toBe(false);
  });

  it('não deve permitir edição de avisos genéricos do sistema ("Admin" ou "Sistema") sem createdBy', () => {
    const systemAnnouncement = {
      author: 'Admin',
      createdBy: undefined,
    };

    expect(
      canUserEditAnnouncement(systemAnnouncement, { id: 'user-1', name: 'Admin' })
    ).toBe(false);
  });
});
