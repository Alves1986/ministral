import { describe, it, expect } from 'vitest';
import {
  resolveUserSwapFunctions,
  hasMatchingSwapRole,
  isSwapRequestVisibleToUser,
  getSwapNotificationRecipientIds,
} from '../utils/swapUtils';

describe('Filtro Estrito de Trocas por Função (swapRoleFilter)', () => {
  const now = new Date('2026-11-06T12:00:00Z');
  const futureSwap = {
    status: 'pending' as const,
    eventIso: '2026-11-15T19:00:00',
    requesterName: 'Lucas',
    requesterId: 'user-lucas',
    role: 'Teclado',
  };

  it('respeita array vazio [] vindo do banco em resolveUserSwapFunctions sem cair em cache antigo da sessão', () => {
    // Se o banco retornou [], significa que o usuário não tem funções no ministério atual
    expect(resolveUserSwapFunctions([], ['Teclado', 'Violão'])).toEqual([]);
    // Enquanto a query está carregando (undefined/null), usa o fallback da sessão
    expect(resolveUserSwapFunctions(undefined, ['Teclado'])).toEqual(['Teclado']);
    expect(resolveUserSwapFunctions(null, ['Violão'])).toEqual(['Violão']);
  });

  it('bloqueia visualização de troca para Admin que NÃO possui a mesma função', () => {
    const adminSemFuncao = {
      id: 'admin-1',
      name: 'Pastor Marcos',
      access_role: 'admin',
    };
    const effectiveFuncs = resolveUserSwapFunctions(['Ministro', 'Violão'], ['Teclado']);

    expect(isSwapRequestVisibleToUser(futureSwap, adminSemFuncao, effectiveFuncs, now)).toBe(false);
  });

  it('bloqueia visualização de troca para membro sem nenhuma função cadastrada', () => {
    const membroSemFuncao = {
      id: 'member-empty',
      name: 'João',
      access_role: 'member',
    };

    expect(isSwapRequestVisibleToUser(futureSwap, membroSemFuncao, [], now)).toBe(false);
  });

  it('exibe a troca para quem possui a mesma função (comparação case-insensitive e com trim)', () => {
    const tecladista = {
      id: 'member-2',
      name: 'Ana',
      access_role: 'member',
    };

    expect(isSwapRequestVisibleToUser(futureSwap, tecladista, ['  teclado  ', 'Vocal'], now)).toBe(true);
  });

  it('sempre exibe o próprio pedido para o solicitante poder cancelar, mesmo se suas funções mudarem', () => {
    const solicitante = {
      id: 'user-lucas',
      name: 'Lucas',
      access_role: 'member',
    };

    expect(isSwapRequestVisibleToUser(futureSwap, solicitante, [], now)).toBe(true);
  });

  it('envia notificações de novo pedido apenas para membros com a mesma função (excluindo solicitante e admins sem a função)', () => {
    const memberships = [
      { profile_id: 'user-lucas', functions: ['Teclado'] }, // próprio solicitante -> ignorar
      { profile_id: 'admin-sem-teclado', functions: ['Ministro', 'Guitarra'] }, // admin sem a função -> ignorar
      { profile_id: 'membro-sem-funcao', functions: [] }, // sem função -> ignorar
      { profile_id: 'tecladista-1', functions: ['  teclado '] }, // tem a função -> notificar
      { profile_id: 'tecladista-2', functions: ['Vocal', 'TECLADO'] }, // tem a função -> notificar
      { profile_id: 'tecladista-1', functions: ['Teclado'] }, // duplicado -> ignorar duplicata
    ];

    const recipients = getSwapNotificationRecipientIds(memberships, 'Teclado', 'user-lucas');
    expect(recipients).toEqual(['tecladista-1', 'tecladista-2']);
  });

  it('valida guarda do performSwapSQL permitindo assumir apenas se possuir a função correspondente', () => {
    expect(hasMatchingSwapRole(['Violão', 'Guitarra'], 'Teclado')).toBe(false);
    expect(hasMatchingSwapRole([], 'Teclado')).toBe(false);
    expect(hasMatchingSwapRole(['Violão', ' teclado '], 'Teclado')).toBe(true);
  });

  it('corresponde vagas numeradas da escala ("Vocal 1", "Vocal 2", "Dança 1") com a função base do membro ("Vocal", "Dança")', () => {
    expect(hasMatchingSwapRole(['Vocal'], 'Vocal 1')).toBe(true);
    expect(hasMatchingSwapRole(['Vocal'], 'Vocal 2')).toBe(true);
    expect(hasMatchingSwapRole(['Dança'], 'Dança 1')).toBe(true);
    expect(hasMatchingSwapRole(['Dançarina'], 'Dança 2')).toBe(true);
    expect(hasMatchingSwapRole(['Back Vocal'], 'Back Vocal 1')).toBe(true);

    // Mas preserva funções distintas por faixa etária (ex: Kids)
    expect(hasMatchingSwapRole(['Professor 03–06'], 'Professor 07–11')).toBe(false);
    expect(hasMatchingSwapRole(['Professor 03–06'], 'Professor 03–06')).toBe(true);
  });

  it('ignora diferenças de acentuação ao comparar funções ("Violão" vs "Violao")', () => {
    expect(hasMatchingSwapRole(['Violao'], 'Violão')).toBe(true);
    expect(hasMatchingSwapRole(['Violão'], 'Violao')).toBe(true);
    expect(hasMatchingSwapRole(['Danca'], 'Dança 1')).toBe(true);
  });

  it('prioriza funções recém-salvas localmente ou da lista de membros quando o banco retorna null', () => {
    // Quando freshFunctions é null (ex: sem linha prévia em ministry_members), usa memberFunctions e sessionFunctions
    expect(resolveUserSwapFunctions(null, [], ['Teclado'], null)).toEqual(['Teclado']);
    // Quando o usuário acabou de atualizar suas funções localmente, mescla imediatamente com freshFunctions
    expect(resolveUserSwapFunctions(['Violão'], ['Violão'], ['Violão'], ['Violão', 'Vocal'])).toEqual([
      'Violão',
      'Vocal',
    ]);
    // Quando o usuário removeu todas as funções localmente ([]), respeita []
    expect(resolveUserSwapFunctions(['Violão'], ['Violão'], ['Violão'], [])).toEqual([]);
  });
});

