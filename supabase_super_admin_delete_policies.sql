-- Execute este SQL no Painel do Supabase (SQL Editor)
-- Isso adiciona as políticas necessárias para Super Admins poderem editar e remover usuários e ministérios

-- Se a função is_super_admin não existir, por favor rode o script supabase_super_admin_policies.sql primeiro

-- Políticas para 'profiles'
DROP POLICY IF EXISTS "Super admins podem atualizar profiles" ON public.profiles;
CREATE POLICY "Super admins podem atualizar profiles"
ON public.profiles FOR UPDATE
USING ( public.is_super_admin() );

DROP POLICY IF EXISTS "Super admins podem deletar profiles" ON public.profiles;
CREATE POLICY "Super admins podem deletar profiles"
ON public.profiles FOR DELETE
USING ( public.is_super_admin() );

-- Políticas para 'ministry_members'
DROP POLICY IF EXISTS "Super admins podem ver ministry_members" ON public.ministry_members;
CREATE POLICY "Super admins podem ver ministry_members"
ON public.ministry_members FOR SELECT
USING ( public.is_super_admin() );

DROP POLICY IF EXISTS "Super admins podem atualizar ministry_members" ON public.ministry_members;
CREATE POLICY "Super admins podem atualizar ministry_members"
ON public.ministry_members FOR UPDATE
USING ( public.is_super_admin() );

DROP POLICY IF EXISTS "Super admins podem inserir ministry_members" ON public.ministry_members;
CREATE POLICY "Super admins podem inserir ministry_members"
ON public.ministry_members FOR INSERT
WITH CHECK ( public.is_super_admin() );

DROP POLICY IF EXISTS "Super admins podem deletar ministry_members" ON public.ministry_members;
CREATE POLICY "Super admins podem deletar ministry_members"
ON public.ministry_members FOR DELETE
USING ( public.is_super_admin() );
