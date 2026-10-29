import { describe, it, expect } from 'vitest';
import {
  deduplicateEventRules,
  organizeCultosForSelection,
  extractRuleTemplates,
  CalendarCultoItem,
} from '../utils/repertoireUtils';

describe('Seleção Inteligente de Cultos no Repertório (repertoireCultoSelection)', () => {
  const sampleCultos: CalendarCultoItem[] = [
    {
      key: '2026-10-25_rule-manha_09:30',
      id: 'rule-manha|2026-10-25',
      ruleId: 'rule-manha',
      title: 'Culto Dom - Manhã',
      date: '2026-10-25',
      time: '09:30',
      iso: '2026-10-25T09:30',
      weekday: 0,
      weekdayShort: 'Dom',
      weekdayFull: 'Domingo',
      dateDisplay: '25/10',
      isPast: true,
      isNext: false,
    },
    {
      key: '2026-10-25_rule-noite_19:00',
      id: 'rule-noite|2026-10-25',
      ruleId: 'rule-noite',
      title: 'Culto Dom - Noite',
      date: '2026-10-25',
      time: '19:00',
      iso: '2026-10-25T19:00',
      weekday: 0,
      weekdayShort: 'Dom',
      weekdayFull: 'Domingo',
      dateDisplay: '25/10',
      isPast: true,
      isNext: false,
    },
    {
      key: '2026-11-01_rule-manha_09:30',
      id: 'rule-manha|2026-11-01',
      ruleId: 'rule-manha',
      title: 'Culto Dom - Manhã',
      date: '2026-11-01',
      time: '09:30',
      iso: '2026-11-01T09:30',
      weekday: 0,
      weekdayShort: 'Dom',
      weekdayFull: 'Domingo',
      dateDisplay: '01/11',
      isPast: false,
      isNext: true,
    },
    {
      key: '2026-11-01_rule-noite_19:00',
      id: 'rule-noite|2026-11-01',
      ruleId: 'rule-noite',
      title: 'Culto Dom - Noite',
      date: '2026-11-01',
      time: '19:00',
      iso: '2026-11-01T19:00',
      weekday: 0,
      weekdayShort: 'Dom',
      weekdayFull: 'Domingo',
      dateDisplay: '01/11',
      isPast: false,
      isNext: false,
    },
    {
      key: '2026-11-08_rule-manha_09:30',
      id: 'rule-manha|2026-11-08',
      ruleId: 'rule-manha',
      title: 'Culto Dom - Manhã',
      date: '2026-11-08',
      time: '09:30',
      iso: '2026-11-08T09:30',
      weekday: 0,
      weekdayShort: 'Dom',
      weekdayFull: 'Domingo',
      dateDisplay: '08/11',
      isPast: false,
      isNext: false,
    },
    {
      key: '2026-11-08_rule-noite_19:00',
      id: 'rule-noite|2026-11-08',
      ruleId: 'rule-noite',
      title: 'Culto Dom - Noite',
      date: '2026-11-08',
      time: '19:00',
      iso: '2026-11-08T19:00',
      weekday: 0,
      weekdayShort: 'Dom',
      weekdayFull: 'Domingo',
      dateDisplay: '08/11',
      isPast: false,
      isNext: false,
    },
  ];

  it('deve incluir todos os cultos futuros mesmo na virada do mês (ex: fim de outubro exibindo cultos de novembro)', () => {
    const organized = organizeCultosForSelection(sampleCultos, []);

    expect(organized.nextCulto?.key).toBe('2026-11-01_rule-manha_09:30');
    // Não pode esconder o culto de domingo à noite (01/11 19:00) nem os de 08/11!
    expect(organized.upcomingCultos).toHaveLength(4);
    expect(organized.upcomingCultos.map(c => c.key)).toEqual([
      '2026-11-01_rule-manha_09:30',
      '2026-11-01_rule-noite_19:00',
      '2026-11-08_rule-manha_09:30',
      '2026-11-08_rule-noite_19:00',
    ]);

    // Quick-pick deve trazer os próximos 4 cultos para seleção com 1 clique
    expect(organized.quickPickCultos).toHaveLength(4);
    expect(organized.quickPickCultos[0].title).toBe('Culto Dom - Manhã');
    expect(organized.quickPickCultos[1].title).toBe('Culto Dom - Noite');
  });

  it('deve contabilizar quantas músicas cada culto já possui cadastradas no repertório (songsCount)', () => {
    const repertoireItems = [
      {
        id: '1',
        title: 'Bondade de Deus',
        date: '2026-11-01',
        eventRuleId: 'rule-manha',
        eventRuleTitle: 'Culto Dom - Manhã',
        eventRuleTime: '09:30',
      },
      {
        id: '2',
        title: 'Santo Pra Sempre',
        date: '2026-11-01',
        eventRuleId: 'rule-manha',
        eventRuleTitle: 'Culto Dom - Manhã',
        eventRuleTime: '09:30',
      },
      {
        id: '3',
        title: 'Porque Ele Vive',
        date: '2026-11-01',
        observation: 'Culto: Culto Dom - Noite (19:00)',
      },
    ];

    const organized = organizeCultosForSelection(sampleCultos, repertoireItems);

    const domManha = organized.upcomingCultos.find(c => c.key === '2026-11-01_rule-manha_09:30');
    const domNoite = organized.upcomingCultos.find(c => c.key === '2026-11-01_rule-noite_19:00');
    const dom08Manha = organized.upcomingCultos.find(c => c.key === '2026-11-08_rule-manha_09:30');

    expect(domManha?.songsCount).toBe(2);
    expect(domNoite?.songsCount).toBe(1);
    expect(dom08Manha?.songsCount).toBe(0);
  });

  it('deve agrupar cultos futuros por mês e ordenar cultos passados do mais recente para o mais antigo', () => {
    const organized = organizeCultosForSelection(sampleCultos, []);

    expect(organized.upcomingByMonth).toHaveLength(1);
    expect(organized.upcomingByMonth[0].monthKey).toBe('2026-11');
    expect(organized.upcomingByMonth[0].cultos).toHaveLength(4);

    // Passados em ordem decrescente (mais recente primeiro para facilitar consulta)
    expect(organized.pastCultos).toHaveLength(2);
    expect(organized.pastCultos[0].key).toBe('2026-10-25_rule-noite_19:00');
    expect(organized.pastCultos[1].key).toBe('2026-10-25_rule-manha_09:30');
  });

  it('deve isolar as regras do ministério atual e nunca duplicar cultos do mesmo dia/horário com grafias parecidas (Culto Dom - Manhã vs Culto Dom Manhã vs Culto de Domingo - Manhã)', () => {
    const rawRules = [
      {
        id: 'rule-louvor-manha',
        ministry_id: 'min-louvor',
        title: 'Culto Dom - Manhã',
        type: 'weekly',
        weekday: 0,
        time: '09:30:00',
        active: true,
      },
      {
        id: 'rule-louvor-noite',
        ministry_id: 'min-louvor',
        title: 'Culto Dom - Noite',
        type: 'weekly',
        weekday: 0,
        time: '19:00:00',
        active: true,
      },
      {
        id: 'rule-midia-manha',
        ministry_id: 'min-midia',
        title: 'Culto Dom Manhã',
        type: 'weekly',
        weekday: 0,
        time: '09:30:00',
        active: true,
      },
      {
        id: 'rule-recepcao-manha',
        ministry_id: 'min-recepcao',
        title: 'Culto de Domingo - Manhã',
        type: 'weekly',
        weekday: 0,
        time: '09:30',
        active: true,
      },
    ];

    const deduped = deduplicateEventRules(rawRules, 'min-louvor');
    expect(deduped).toHaveLength(2);
    expect(deduped.map(r => r.id)).toEqual(['rule-louvor-manha', 'rule-louvor-noite']);
  });

  it('deve remover cultos duplicados no mesmo dia e horário em organizeCultosForSelection (ex: Culto Dom - Manhã, Culto Dom Manhã, Culto de Domingo - Manhã)', () => {
    const duplicatedCultos: CalendarCultoItem[] = [
      {
        key: '2026-11-01_rule-1_09:30',
        id: 'rule-1|2026-11-01',
        ruleId: 'rule-1',
        title: 'Culto Dom - Manhã',
        date: '2026-11-01',
        time: '09:30',
        iso: '2026-11-01T09:30',
        weekday: 0,
        weekdayShort: 'Dom',
        weekdayFull: 'Domingo',
        dateDisplay: '01/11',
        isPast: false,
        isNext: true,
      },
      {
        key: '2026-11-01_rule-2_09:30',
        id: 'rule-2|2026-11-01',
        ruleId: 'rule-2',
        title: 'Culto Dom Manhã',
        date: '2026-11-01',
        time: '09:30',
        iso: '2026-11-01T09:30',
        weekday: 0,
        weekdayShort: 'Dom',
        weekdayFull: 'Domingo',
        dateDisplay: '01/11',
        isPast: false,
        isNext: false,
      },
      {
        key: '2026-11-01_sem-regra_09:30',
        id: '2026-11-01_sem-regra_09:30',
        ruleId: null,
        title: 'Culto de Domingo - Manhã',
        date: '2026-11-01',
        time: '09:30',
        iso: '2026-11-01T09:30',
        weekday: 0,
        weekdayShort: 'Dom',
        weekdayFull: 'Domingo',
        dateDisplay: '01/11',
        isPast: false,
        isNext: false,
      },
      {
        key: '2026-11-01_rule-noite_19:00',
        id: 'rule-noite|2026-11-01',
        ruleId: 'rule-noite',
        title: 'Culto Dom - Noite',
        date: '2026-11-01',
        time: '19:00',
        iso: '2026-11-01T19:00',
        weekday: 0,
        weekdayShort: 'Dom',
        weekdayFull: 'Domingo',
        dateDisplay: '01/11',
        isPast: false,
        isNext: false,
      },
    ];

    const organized = organizeCultosForSelection(duplicatedCultos, []);
    expect(organized.upcomingCultos).toHaveLength(2);
    expect(organized.quickPickCultos).toHaveLength(2);
    expect(organized.quickPickCultos.map(c => c.title)).toEqual([
      'Culto Dom - Manhã',
      'Culto Dom - Noite',
    ]);
  });

  it('deve extrair modelos únicos de cultos existentes (extractRuleTemplates) para preenchimento rápido', () => {
    const rules = [
      { id: 'r1', title: 'Culto Dom - Manhã', time: '09:30:00', type: 'weekly', weekday: 0 },
      { id: 'r2', title: 'Culto Dom - Noite', time: '19:00:00', type: 'weekly', weekday: 0 },
      { id: 'r3', title: 'Culto de Ensino', time: '19:30', type: 'weekly', weekday: 3 },
    ];

    const templates = extractRuleTemplates(rules);
    expect(templates).toHaveLength(3);
    expect(templates[0]).toEqual({ title: 'Culto Dom - Manhã', time: '09:30', ruleId: 'r1' });
    expect(templates[1]).toEqual({ title: 'Culto Dom - Noite', time: '19:00', ruleId: 'r2' });
    expect(templates[2]).toEqual({ title: 'Culto de Ensino', time: '19:30', ruleId: 'r3' });
  });
});

