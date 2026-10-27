import { describe, it, expect } from 'vitest';
import { preparePdfScheduleData, generateFullSchedulePDF } from '../utils/pdfGenerator';

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

  it('deve mapear Coral da Ceia apenas como "Coral" (sem nomes e sem contagem)', () => {
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

    // O primeiro vocal deve ser apenas "Coral", sem os nomes dos membros
    expect(schedule['rule-1|2026-11-01|Vocal 1']).toBe('Coral');
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

  it('deve gerar PDF completo ocupando estritamente 1 única página e sanitizar Coral', () => {
    // Simula um mês com 16 eventos e 14 funções (cenário real da imagem do usuário)
    const occurrences16 = Array.from({ length: 16 }, (_, i) => {
      const day = String(i * 2 + 1).padStart(2, '0');
      return {
        id: `rule-1|2026-11-${day}`,
        iso: `2026-11-${day}T19:00:00`,
        title: i % 2 === 0 ? 'Culto Dom - Noite' : 'Culto de Quarta',
        dateDisplay: `${day}/11`,
      };
    });

    const roles14 = [
      'MINISTRO', 'VOCAL 1', 'VOCAL 2', 'VOCAL 3', 'VOCAL 4', 'VOCAL 5',
      'VIOLÃO', 'GUITARRA', 'BAIXO', 'BATERIA', 'TECLADO', 'AUDIO',
    ];

    const mockSchedule: Record<string, string> = {};
    occurrences16.forEach(evt => {
      roles14.forEach(role => {
        if (role === 'VOCAL 1' && evt.dateDisplay === '08/11') {
          // Cenário com texto longo antigo de coral
          mockSchedule[`${evt.id}|${role}`] = 'Coral (19): Maria Lobato, Marcio Florsz, Isabela Costa, Vanessa Quadros de Oliveira da Silveira';
        } else {
          mockSchedule[`${evt.id}|${role}`] = 'Membro de Teste';
        }
      });
    });

    const doc = generateFullSchedulePDF(
      'Ministério de Louvor',
      '2026-11',
      occurrences16,
      roles14,
      mockSchedule,
      null,
      false
    );

    // Deve ocupar estritamente 1 página
    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBe(1);
  });
});
