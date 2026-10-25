import { describe, it, expect } from 'vitest';
import { normalizeTabAlias, formatScheduleForWhatsApp } from '../utils/navigation';

describe('Navigation & History Sync Utilities', () => {
  it('correctly maps legacy tab aliases to unified tabs', () => {
    expect(normalizeTabAlias('schedule')).toEqual({ tab: 'calendar' });
    expect(normalizeTabAlias('repertoire-manager')).toEqual({ tab: 'repertoire' });
    expect(normalizeTabAlias('send-announcements')).toEqual({ tab: 'announcements', openCreate: true });
    expect(normalizeTabAlias('event-rules')).toEqual({ tab: 'schedule-editor', subTab: 'events' });
    expect(normalizeTabAlias('schedule-rules')).toEqual({ tab: 'schedule-editor', subTab: 'rules' });
    expect(normalizeTabAlias('dashboard')).toEqual({ tab: 'dashboard' });
    expect(normalizeTabAlias(null)).toEqual({ tab: 'dashboard' });
    expect(normalizeTabAlias(undefined)).toEqual({ tab: 'dashboard' });
  });

  it('formats schedule text properly for WhatsApp with emojis', () => {
    const formatted = formatScheduleForWhatsApp({
      title: 'Culto da Família',
      dateDisplay: '25/10/2026',
      time: '19:30',
      roles: [
        { role: 'Vocal', member: 'Mariana' },
        { role: 'Bateria', member: 'Pedro' },
        { role: 'Violão', member: 'Vago' }
      ],
      songs: [
        { title: 'Porque Ele Vive', key: 'G', link: 'https://youtube.com/watch?v=123' },
        { title: 'Bondade de Deus', key: 'C' }
      ]
    });

    expect(formatted).toContain('📅 *Culto da Família*');
    expect(formatted).toContain('🗓️ 25/10/2026 às 19:30');
    expect(formatted).toContain('👥 *Equipe Escalada:*');
    expect(formatted).toContain('• Vocal: Mariana');
    expect(formatted).toContain('• Bateria: Pedro');
    expect(formatted).toContain('• Violão: Vago');
    expect(formatted).toContain('🎵 *Repertório:*');
    expect(formatted).toContain('1. Porque Ele Vive (Tom: G)');
    expect(formatted).toContain('🔗 https://youtube.com/watch?v=123');
    expect(formatted).toContain('2. Bondade de Deus (Tom: C)');
    expect(formatted).toContain('Ministral');
  });
});
