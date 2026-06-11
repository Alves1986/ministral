import { vi, describe, it, expect, beforeEach } from 'vitest';
import { deleteGlobalUser } from '../services/supabase/admin';
import * as clientModule from '../services/supabase/client';

// Mock getSupabase
vi.mock('../services/supabase/client', () => {
  return {
    getSupabase: vi.fn(),
  };
});

describe('deleteGlobalUser Cascade Delete', () => {
  let mockSupabase: any;
  let deleteCalls: { table: string; field: string; val: string }[] = [];

  beforeEach(() => {
    vi.restoreAllMocks();
    deleteCalls = [];

    // Estrutura fluente do Supabase mockada
    const createMockChain = (tableName: string) => {
      const chain: any = {};
      chain.delete = vi.fn().mockImplementation(() => {
        return chain;
      });
      chain.eq = vi.fn().mockImplementation((field: string, val: string) => {
        deleteCalls.push({ table: tableName, field, val });
        return Promise.resolve({ error: null, data: null });
      });
      return chain;
    };

    mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        return createMockChain(table);
      }),
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-id' } } }),
      },
    };

    vi.spyOn(clientModule, 'getSupabase').mockReturnValue(mockSupabase);
  });

  it('should delete references in all dependent tables before deleting the profile', async () => {
    const userId = 'user-to-delete-123';
    const result = await deleteGlobalUser(userId);

    expect(result.success).toBe(true);

    // Tabelas que devem ser limpas
    const expectedTables = [
      'schedule_assignments',
      'ministry_members',
      'member_availability',
      'push_subscriptions',
      'swap_requests',
      'profiles',
    ];

    // Verificar se as tabelas foram acessadas
    expectedTables.forEach(table => {
      const callsForTable = deleteCalls.filter(c => c.table === table);
      expect(callsForTable.length, `Tabela ${table} deveria ter sido limpa`).toBeGreaterThan(0);
    });

    // A tabela profiles deve ser a última (ou após as dependências) para garantir a integridade
    const lastCall = deleteCalls[deleteCalls.length - 1];
    expect(lastCall.table).toBe('profiles');
    expect(lastCall.field).toBe('id');
    expect(lastCall.val).toBe(userId);
  });
});
