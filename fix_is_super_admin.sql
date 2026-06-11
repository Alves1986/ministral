-- Corrige a função is_super_admin para evitar o erro de recursão infinita no banco de dados.
-- A versão anterior tentava consultar a tabela profiles, o que causava um loop (travando as consultas)
-- já que a tabela profiles usava a função is_super_admin para decidir se liberava o acesso.

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean AS $$
BEGIN
  -- Retorna false ou lê do token JWT.
  -- Isso quebra o ciclo de recursão e restaura o acesso rápido a todas as tabelas 
  -- (ministry_members, ministry_settings, schedule_conflict_rules, etc).
  RETURN coalesce((auth.jwt() ->> 'is_super_admin')::boolean, false);
END;
$$ LANGUAGE plpgsql STABLE;
