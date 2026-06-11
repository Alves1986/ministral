-- Execute este script no SQL Editor do Supabase para restaurar a leitura de membros e funções no Editor de Escala

-- Restaura o acesso de leitura à tabela ministry_members para usuários autenticados
-- Isso é essencial para que o Editor de Escala consiga listar as funções dos membros
DROP POLICY IF EXISTS "Permitir leitura de ministry_members para usuarios autenticados" ON public.ministry_members;
CREATE POLICY "Permitir leitura de ministry_members para usuarios autenticados"
ON public.ministry_members FOR SELECT
USING ( auth.role() = 'authenticated' );

-- Garante que os profiles possam ser lidos para buscar nomes e fotos
DROP POLICY IF EXISTS "Permitir leitura de profiles para usuarios autenticados" ON public.profiles;
CREATE POLICY "Permitir leitura de profiles para usuarios autenticados"
ON public.profiles FOR SELECT
USING ( auth.role() = 'authenticated' );

-- Restaura a leitura das configurações do ministério (onde os cargos podem estar salvos)
DROP POLICY IF EXISTS "Permitir leitura de ministry_settings para usuarios autenticados" ON public.ministry_settings;
CREATE POLICY "Permitir leitura de ministry_settings para usuarios autenticados"
ON public.ministry_settings FOR SELECT
USING ( auth.role() = 'authenticated' );

-- Restaura a leitura de organization_ministries (necessário para buscar detalhes do ministério)
DROP POLICY IF EXISTS "Permitir leitura de organization_ministries para usuarios autenticados" ON public.organization_ministries;
CREATE POLICY "Permitir leitura de organization_ministries para usuarios autenticados"
ON public.organization_ministries FOR SELECT
USING ( auth.role() = 'authenticated' );

-- Restaura a leitura de organizations (necessário para detalhes da organização)
DROP POLICY IF EXISTS "Permitir leitura de organizations para usuarios autenticados" ON public.organizations;
CREATE POLICY "Permitir leitura de organizations para usuarios autenticados"
ON public.organizations FOR SELECT
USING ( auth.role() = 'authenticated' );
