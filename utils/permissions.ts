import { User } from '../types';

/**
 * Verifica se o usuário ativo tem permissão para gerenciar a organização.
 * Usado como guard para a Central Operacional e outros painéis administrativos.
 */
export function canManageOrganization(user: User | null | undefined): boolean {
  if (!user) return false;
  return (
    user.access_role === 'admin' ||
    !!user.isOrgAdmin ||
    !!user.isSuperAdmin
  );
}
