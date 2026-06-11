-- Este script reverte TODAS as políticas e funções criadas para o Super Admin.
-- Ao rodar este script, o sistema voltará ao estado original antes das permissões de Super Admin.

-- 1. Remove as políticas de Profiles
DROP POLICY IF EXISTS "Super admins podem ver todos os profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super admins podem atualizar profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super admins podem deletar profiles" ON public.profiles;

-- 2. Remove as políticas de Organizations
DROP POLICY IF EXISTS "Super admins podem ver todas as organizations" ON public.organizations;

-- 3. Remove as políticas de Organization Ministries
DROP POLICY IF EXISTS "Super admins podem ver todos os ministries" ON public.organization_ministries;

-- 4. Remove as políticas de Ministry Members
DROP POLICY IF EXISTS "Super admins podem ver ministry_members" ON public.ministry_members;
DROP POLICY IF EXISTS "Super admins podem atualizar ministry_members" ON public.ministry_members;
DROP POLICY IF EXISTS "Super admins podem inserir ministry_members" ON public.ministry_members;
DROP POLICY IF EXISTS "Super admins podem deletar ministry_members" ON public.ministry_members;

-- 5. Não remover a função is_super_admin() pois o banco de dados inteiro depende dela!
-- A função is_super_admin() faz parte das políticas originais (core) do sistema.
