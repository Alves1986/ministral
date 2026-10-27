import { describe, it, expect } from 'vitest';
import { preparePdfScheduleData } from '../utils/pdfGenerator';

describe('Exportação de Escala em PDF antes de liberar (Rascunho / Draft)', () => {
  const mockOccurrences = [
    { ruleId: 'rule-1', date: '2026-11-01', time: '19:00', title: 'Culto da Noite' },
    { ruleId: 'rule-1', date: '2026-11-08', time: '19:00', title: 'Culto da Noite' },
  ];

  const mockMembers = [
    { id: 'member-1', name: 'Ana Silva' },
    { id: 'member-2', name: 'Carlos Souza' },
    { id: 'member-3', name: 'Beatriz Lima' },
  ];

  const mockRoles = ['Vocal 1', 'Vocal 2', 'Violão', 'Bateria'];

  it('deve gerar eventos e mapeamento de escala com voluntários antes da publicação', () => {
    // Escala em rascunho: NÃO possui a flag __PUBLISHED__
    const mockDraftAssignments = [
      { event_rule_id: 'rule-1', event_date: '2026-11-01', role: 'Vocal 1', member_id: 'member-1' },
      { event_rule_id: 'rule-1', event_date: '2026-11-01', role: 'Violão', member_id: 'member-2' },
      { event_rule_id: 'rule-1', event_date: '2026-11-08', role: 'Bateria', member_id: 'member-3' },
    ];

    const { events, schedule } = preparePdfScheduleData({
      occurrences: mockOccurrences,
      assignments: mockDraftAssignments,
      members: mockMembers,
      roles: mockRoles,
    });

    // 1. Valida estrutura de eventos
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({
      id: 'rule-1|2026-11-01',
      iso: '2026-11-01T19:00:00',
      title: 'Culto da Noite',
      dateDisplay: '01/11',
    });

    // 2. Valida mapeamento da escala com os nomes dos membros
    expect(schedule['rule-1|2026-11-01|Vocal 1']).toBe('Ana Silva');
    expect(schedule['rule-1|2026-11-01|Violão']).toBe('Carlos Souza');
    expect(schedule['rule-1|2026-11-08|Bateria']).toBe('Beatriz Lima');
    // Vagas não preenchidas permanecem indefinidas no mapa
    expect(schedule['rule-1|2026-11-01|Vocal 2']).toBeUndefined();
  });

  it('deve ignorar registros de sistema (__PUBLISHED__ e __EVENT_EXCLUDED__) no mapeamento de funções', () => {
    const mockAssignmentsWithFlags = [
      { event_rule_id: 'rule-1', event_date: '2026-11-01', role: 'Vocal 1', member_id: 'member-1' },
      { event_rule_id: 'rule-1', event_date: '2026-11-01', role: '__PUBLISHED__', member_id: 'system' },
      { event_rule_id: 'rule-1', event_date: '2026-11-01', role: '__EVENT_EXCLUDED__', member_id: 'system' },
    ];

    const { schedule } = preparePdfScheduleData({
      occurrences: mockOccurrences,
      assignments: mockAssignmentsWithFlags,
      members: mockMembers,
      roles: mockRoles,
    });

    expect(schedule['rule-1|2026-11-01|Vocal 1']).toBe('Ana Silva');
    expect(schedule['rule-1|2026-11-01|__PUBLISHED__']).toBeUndefined();
    expect(schedule['rule-1|2026-11-01|__EVENT_EXCLUDED__']).toBeUndefined();
  });

  it('deve mapear Coral da Ceia nos vocais no PDF quando houver membros de coral escalados', () => {
    const mockAssignmentsWithChoir = [
      { event_rule_id: 'rule-1', event_date: '2026-11-01', role: 'coral_1', member_id: 'member-1' },
      { event_rule_id: 'rule-1', event_date: '2026-11-01', role: 'coral_2', member_id: 'member-3' },
      { event_rule_id: 'rule-1', event_date: '2026-11-01', role: 'Violão', member_id: 'member-2' },
    ];

    const { schedule } = preparePdfScheduleData({
      occurrences: mockOccurrences,
      assignments: mockAssignmentsWithChoir,
      members: mockMembers,
      roles: mockRoles,
    });

    // O primeiro vocal deve receber o indicador de Coral com os participantes
    expect(schedule['rule-1|2026-11-01|Vocal 1']).toContain('Coral (2)');
    expect(schedule['rule-1|2026-11-01|Violão']).toBe('Carlos Souza');
  });

  it('deve permitir exportar escala individual em PDF antes da publicação', () => {
    const mockDraftAssignments = [
      { event_rule_id: 'rule-1', event_date: '2026-11-01', role: 'Vocal 1', member_id: 'member-1' },
      { event_rule_id: 'rule-1', event_date: '2026-11-08', role: 'Vocal 2', member_id: 'member-1' },
      { event_rule_id: 'rule-1', event_date: '2026-11-01', role: 'Violão', member_id: 'member-2' },
    ];

    const { events, schedule } = preparePdfScheduleData({
      occurrences: mockOccurrences,
      assignments: mockDraftAssignments,
      members: mockMembers,
      roles: mockRoles,
    });

    // Filtra escalas apenas do membro 'Ana Silva'
    const anaAssignments = events.filter(evt => {
      const vocal1 = schedule[`${evt.id}|Vocal 1`];
      const vocal2 = schedule[`${evt.id}|Vocal 2`];
      return vocal1 === 'Ana Silva' || vocal2 === 'Ana Silva';
    });

    expect(anaAssignments).toHaveLength(2);
    expect(anaAssignments[0].dateDisplay).toBe('01/11');
    expect(anaAssignments[1].dateDisplay).toBe('08/11');
  });
});
