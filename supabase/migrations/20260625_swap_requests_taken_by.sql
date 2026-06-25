-- ============================================================
-- Migração: Adiciona colunas taken_by_id e taken_by_name em swap_requests
-- Problema: performSwapSQL tenta gravar quem assumiu a escala nessas colunas,
-- mas elas não existem na tabela, causando erro "column not found in schema cache"
-- ============================================================

-- Adiciona coluna taken_by_id (UUID de quem assumiu a escala)
ALTER TABLE swap_requests
  ADD COLUMN IF NOT EXISTS taken_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Adiciona coluna taken_by_name (nome de quem assumiu a escala)
ALTER TABLE swap_requests
  ADD COLUMN IF NOT EXISTS taken_by_name TEXT;

-- Adiciona coluna taken_at (timestamp de quando foi assumida)
ALTER TABLE swap_requests
  ADD COLUMN IF NOT EXISTS taken_at TIMESTAMPTZ;

-- Comentários para documentação
COMMENT ON COLUMN swap_requests.taken_by_id IS 'ID do usuário que assumiu a escala';
COMMENT ON COLUMN swap_requests.taken_by_name IS 'Nome do usuário que assumiu a escala';
COMMENT ON COLUMN swap_requests.taken_at IS 'Data/hora em que a escala foi assumida';

-- Atualiza o cache do schema do PostgREST
NOTIFY pgrst, 'reload schema';
