import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearScheduleForMonth } from '../services/supabase/scales';
import * as clientModule from '../services/supabase/client';

describe('clearScheduleForMonth', () => {
  let mockDelete: any;
  let mockEqOrg: any;
  let mockEqMin: any;
  let mockGte: any;
  let mockLte: any;
  let mockIn: any;

  beforeEach(() => {
    mockIn = vi.fn().mockResolvedValue({ error: null });
    mockLte = vi.fn().mockImplementation(() => {
      // Retorna objeto com método in e thenable
      const res: any = {
        in: mockIn,
        then: (onfulfilled: any) => Promise.resolve({ error: null }).then(onfulfilled),
      };
      return res;
    });
    mockGte = vi.fn().mockReturnValue({ lte: mockLte });
    mockEqMin = vi.fn().mockReturnValue({ gte: mockGte });
    mockEqOrg = vi.fn().mockReturnValue({ eq: mockEqMin });
    mockDelete = vi.fn().mockReturnValue({ eq: mockEqOrg });

    const mockSb = {
      from: vi.fn().mockReturnValue({
        delete: mockDelete,
      }),
    };

    vi.spyOn(clientModule, 'getSupabase').mockReturnValue(mockSb as any);
  });

  it('limpa toda a escala do mês quando nenhum filtro de função é passado', async () => {
    await clearScheduleForMonth('min-1', 'org-1', '2026-10');

    expect(mockDelete).toHaveBeenCalled();
    expect(mockEqOrg).toHaveBeenCalledWith('organization_id', 'org-1');
    expect(mockEqMin).toHaveBeenCalledWith('ministry_id', 'min-1');
    expect(mockGte).toHaveBeenCalledWith('event_date', '2026-10-01');
    expect(mockLte).toHaveBeenCalledWith('event_date', '2026-10-31');
    expect(mockIn).not.toHaveBeenCalled();
  });

  it('limpa parcialmente apenas as funções especificadas (ex: Bateria e Baixo)', async () => {
    await clearScheduleForMonth('min-1', 'org-1', '2026-10', ['Bateria', 'Baixo']);

    expect(mockIn).toHaveBeenCalled();
    const calledRoles = mockIn.mock.calls[0][1];
    expect(calledRoles).toContain('Bateria');
    expect(calledRoles).toContain('Baixo');
    expect(calledRoles).not.toContain('Guitarra');
  });

  it('expande filtros genéricos de vocal (Vocal -> Vocal 1..10)', async () => {
    await clearScheduleForMonth('min-1', 'org-1', '2026-10', ['Vocal']);

    expect(mockIn).toHaveBeenCalled();
    const calledRoles = mockIn.mock.calls[0][1];
    expect(calledRoles).toContain('Vocal');
    expect(calledRoles).toContain('Vocal 1');
    expect(calledRoles).toContain('Vocal 2');
    expect(calledRoles).toContain('Vocal 5');
  });

  it('expande filtros genéricos de ministro (Ministro -> Ministro, Ministro de Louvor)', async () => {
    await clearScheduleForMonth('min-1', 'org-1', '2026-10', ['Ministro']);

    expect(mockIn).toHaveBeenCalled();
    const calledRoles = mockIn.mock.calls[0][1];
    expect(calledRoles).toContain('Ministro');
    expect(calledRoles).toContain('Ministro de Louvor');
  });
});
