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

-- 5. Remove a função is_super_admin
DROP FUNCTION IF EXISTS public.is_super_admin();

-- NOTA: As políticas que o script de correção (fix_policies_editor_escala.sql) criou 
-- serão mantidas para garantir que os usuários normais tenham acesso de leitura, 
-- já que são políticas básicas padrão para usuários autenticados.
