import { describe, it, expect, vi } from 'vitest';

export interface AIScheduleSuggestion {
  event_rule_id: string;
  event_date: string;
  role: string;
  member_id: string;
  replacedMemberId?: string;
  memberNote?: string;
}

export function filterSelectedSuggestions(
  suggestions: AIScheduleSuggestion[],
  selectedIndices: number[]
): AIScheduleSuggestion[] {
  return suggestions.filter((_, idx) => selectedIndices.includes(idx));
}

export function toggleSuggestionIndex(
  prevIndices: number[],
  targetIndex: number
): number[] {
  return prevIndices.includes(targetIndex)
    ? prevIndices.filter(i => i !== targetIndex)
    : [...prevIndices, targetIndex];
}

export function toggleAllSuggestionIndices(
  totalCount: number,
  currentIndices: number[]
): number[] {
  if (currentIndices.length === totalCount) {
    return [];
  }
  return Array.from({ length: totalCount }, (_, i) => i);
}

export async function applySelectedRebalanceSuggestions(
  suggestions: AIScheduleSuggestion[],
  selectedIndices: number[],
  handlers: {
    removeAssignment: (params: { event_rule_id: string; event_date: string; role: string }) => Promise<void>;
    saveAssignment: (params: { event_rule_id: string; event_date: string; role: string; member_id: string }) => Promise<void>;
  }
): Promise<{ appliedCount: number }> {
  const itemsToApply = filterSelectedSuggestions(suggestions, selectedIndices);
  if (itemsToApply.length === 0) {
    return { appliedCount: 0 };
  }

  for (const item of itemsToApply) {
    if (item.replacedMemberId) {
      await handlers.removeAssignment({
        event_rule_id: item.event_rule_id,
        event_date: item.event_date,
        role: item.role
      });
    }
    await handlers.saveAssignment({
      event_rule_id: item.event_rule_id,
      event_date: item.event_date,
      role: item.role,
      member_id: item.member_id
    });
  }

  return { appliedCount: itemsToApply.length };
}

describe('Schedule Rebalance Selection & Selective Application', () => {
  const mockSuggestions: AIScheduleSuggestion[] = [
    {
      event_rule_id: 'rule-culto-dom-noite',
      event_date: '2026-11-08',
      role: 'Bateria',
      member_id: 'member-joao',
      replacedMemberId: 'member-carlos-sobrecarregado'
    },
    {
      event_rule_id: 'rule-culto-dom-manha',
      event_date: '2026-11-15',
      role: 'Violão',
      member_id: 'member-marcos',
      replacedMemberId: 'member-felipe-sobrecarregado'
    },
    {
      event_rule_id: 'rule-culto-quarta',
      event_date: '2026-11-18',
      role: 'Baixo',
      member_id: 'member-andre' // Vaga vazia preenchida
    }
  ];

  it('initializes with all suggestions selected by default', () => {
    const allIndices = toggleAllSuggestionIndices(mockSuggestions.length, []);
    expect(allIndices).toEqual([0, 1, 2]);
    expect(filterSelectedSuggestions(mockSuggestions, allIndices)).toHaveLength(3);
  });

  it('allows deselecting and selecting individual swaps', () => {
    let selected = [0, 1, 2];

    // Desmarca a segunda troca (Violão)
    selected = toggleSuggestionIndex(selected, 1);
    expect(selected).toEqual([0, 2]);

    const filtered = filterSelectedSuggestions(mockSuggestions, selected);
    expect(filtered).toHaveLength(2);
    expect(filtered[0].role).toBe('Bateria');
    expect(filtered[1].role).toBe('Baixo');

    // Re-seleciona a segunda troca
    selected = toggleSuggestionIndex(selected, 1);
    expect(selected).toContain(1);
    expect(selected).toHaveLength(3);
  });

  it('allows deselecting all suggestions and reselecting all', () => {
    let selected = [0, 1, 2];

    // Quando todos estão marcados, toggleAll deve desmarcar todos
    selected = toggleAllSuggestionIndices(mockSuggestions.length, selected);
    expect(selected).toEqual([]);
    expect(filterSelectedSuggestions(mockSuggestions, selected)).toHaveLength(0);

    // Quando vazio, toggleAll deve selecionar todos
    selected = toggleAllSuggestionIndices(mockSuggestions.length, selected);
    expect(selected).toEqual([0, 1, 2]);
  });

  it('applies ONLY selected swaps and preserves unselected ones untouched', async () => {
    const removeMock = vi.fn().mockResolvedValue(undefined);
    const saveMock = vi.fn().mockResolvedValue(undefined);

    // O usuário escolhe apenas a primeira troca (Bateria), desmarcando a segunda e terceira
    const selectedIndices = [0];

    const result = await applySelectedRebalanceSuggestions(mockSuggestions, selectedIndices, {
      removeAssignment: removeMock,
      saveAssignment: saveMock
    });

    expect(result.appliedCount).toBe(1);

    // Remove do membro sobrecarregado da primeira troca
    expect(removeMock).toHaveBeenCalledTimes(1);
    expect(removeMock).toHaveBeenCalledWith({
      event_rule_id: 'rule-culto-dom-noite',
      event_date: '2026-11-08',
      role: 'Bateria'
    });

    // Salva o novo membro da primeira troca
    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(saveMock).toHaveBeenCalledWith({
      event_rule_id: 'rule-culto-dom-noite',
      event_date: '2026-11-08',
      role: 'Bateria',
      member_id: 'member-joao'
    });

    // A segunda troca (Violão) e a terceira (Baixo) NUNCA devem ter sido tocadas
    expect(saveMock).not.toHaveBeenCalledWith(expect.objectContaining({ role: 'Violão' }));
    expect(saveMock).not.toHaveBeenCalledWith(expect.objectContaining({ role: 'Baixo' }));
    expect(removeMock).not.toHaveBeenCalledWith(expect.objectContaining({ role: 'Violão' }));
  });

  it('does nothing when no swaps are selected', async () => {
    const removeMock = vi.fn().mockResolvedValue(undefined);
    const saveMock = vi.fn().mockResolvedValue(undefined);

    const result = await applySelectedRebalanceSuggestions(mockSuggestions, [], {
      removeAssignment: removeMock,
      saveAssignment: saveMock
    });

    expect(result.appliedCount).toBe(0);
    expect(removeMock).not.toHaveBeenCalled();
    expect(saveMock).not.toHaveBeenCalled();
  });
});
