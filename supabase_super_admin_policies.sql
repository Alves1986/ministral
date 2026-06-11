-- Execute este SQL no Painel do Supabase (SQL Editor) se a listagem de usuários ainda retornar vazia
-- Isso criará uma função segura e políticas para permitir que Super Admins acessem os dados.

-- 1. Função para verificar se o usuário é super_admin sem causar recursão infinita
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean AS $$
DECLARE
  is_admin boolean;
BEGIN
  SELECT is_super_admin INTO is_admin FROM public.profiles WHERE id = auth.uid();
  RETURN COALESCE(is_admin, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Políticas para 'profiles'
DROP POLICY IF EXISTS "Super admins podem ver todos os profiles" ON public.profiles;
CREATE POLICY "Super admins podem ver todos os profiles"
ON public.profiles FOR SELECT
USING ( public.is_super_admin() );

-- 3. Políticas para 'organizations'
DROP POLICY IF EXISTS "Super admins podem ver todas as organizations" ON public.organizations;
CREATE POLICY "Super admins podem ver todas as organizations"
ON public.organizations FOR SELECT
USING ( public.is_super_admin() );

-- 4. Políticas para 'organization_ministries'
DROP POLICY IF EXISTS "Super admins podem ver todos os ministries" ON public.organization_ministries;
CREATE POLICY "Super admins podem ver todos os ministries"
ON public.organization_ministries FOR SELECT
USING ( public.is_super_admin() );
