import { describe, it, expect } from 'vitest';
import { isRepertoireItemForEvent } from '../utils/repertoireUtils';

describe('Isolamento de Repertório por Culto e Evento (repertoireEventIsolation)', () => {
  const morningEvent = {
    ruleId: 'rule-dom-manha',
    title: 'Culto Dom - Manhã',
    date: '2026-10-25',
    time: '09:30',
  };

  const nightEvent = {
    ruleId: 'rule-dom-noite',
    title: 'Culto Dom - Noite',
    date: '2026-10-25',
    time: '19:00',
  };

  it('não deve exibir músicas do culto de Domingo de Manhã no culto de Domingo de Noite com ruleId diferente na mesma data', () => {
    const morningSong = {
      id: 'song-1',
      title: 'Maravilhosa Graça',
      date: '2026-10-25',
      event_rule_id: 'rule-dom-manha',
      observation: 'Culto: Culto Dom - Manhã (09:30)',
    };

    // No culto da Manhã, deve ser incluída
    expect(isRepertoireItemForEvent(morningSong, morningEvent)).toBe(true);

    // No culto da Noite (mesma data, ruleId diferente), NÃO DEVE ser incluída!
    expect(isRepertoireItemForEvent(morningSong, nightEvent)).toBe(false);
  });

  it('deve isolar corretamente itens legados sem event_rule_id através do título/horário na observation', () => {
    const legacyMorningSong = {
      id: 'song-legacy-1',
      title: 'Gabriel Guedes - Tributo a Iehovah',
      date: '2026-10-25',
      event_rule_id: null,
      observation: 'Culto: Culto Dom - Manhã (09:30)',
    };

    const legacyNightSong = {
      id: 'song-legacy-2',
      title: 'Vitorioso és',
      date: '2026-10-25',
      event_rule_id: null,
      observation: 'Culto: Culto Dom - Noite (19:00)',
    };

    // Item da manhã não deve aparecer na noite
    expect(isRepertoireItemForEvent(legacyMorningSong, nightEvent)).toBe(false);
    expect(isRepertoireItemForEvent(legacyMorningSong, morningEvent)).toBe(true);

    // Item da noite não deve aparecer na manhã
    expect(isRepertoireItemForEvent(legacyNightSong, morningEvent)).toBe(false);
    expect(isRepertoireItemForEvent(legacyNightSong, nightEvent)).toBe(true);
  });

  it('não deve incluir músicas de datas diferentes', () => {
    const otherDateSong = {
      id: 'song-3',
      title: 'Tu és + Águas Purificadoras',
      date: '2026-10-18',
      event_rule_id: 'rule-dom-noite',
      observation: 'Culto: Culto Dom - Noite (19:00)',
    };

    expect(isRepertoireItemForEvent(otherDateSong, nightEvent)).toBe(false);
  });

  it('deve filtrar corretamente uma lista mista de repertório para o culto específico', () => {
    const allSongs = [
      { id: '1', title: 'Música Manhã 1', date: '2026-10-25', event_rule_id: 'rule-dom-manha', observation: 'Culto: Culto Dom - Manhã (09:30)' },
      { id: '2', title: 'Música Manhã 2', date: '2026-10-25', event_rule_id: 'rule-dom-manha', observation: 'Culto: Culto Dom - Manhã (09:30)' },
      { id: '3', title: 'Música Noite 1', date: '2026-10-25', event_rule_id: 'rule-dom-noite', observation: 'Culto: Culto Dom - Noite (19:00)' },
    ];

    const morningFiltered = allSongs.filter(s => isRepertoireItemForEvent(s, morningEvent));
    expect(morningFiltered).toHaveLength(2);
    expect(morningFiltered.map(s => s.id)).toEqual(['1', '2']);

    const nightFiltered = allSongs.filter(s => isRepertoireItemForEvent(s, nightEvent));
    expect(nightFiltered).toHaveLength(1);
    expect(nightFiltered.map(s => s.id)).toEqual(['3']);
  });
});
