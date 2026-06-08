-- Migração: Adiciona suporte ao Typebot em swap_requests
-- Adiciona colunas reason (motivo do pedido) e origin (fonte da solicitação)

ALTER TABLE swap_requests
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS origin TEXT DEFAULT 'app';

COMMENT ON COLUMN swap_requests.reason IS
  'Motivo da solicitação de troca, informado pelo membro (opcional)';

COMMENT ON COLUMN swap_requests.origin IS
  'Origem da solicitação: app | whatsapp_text | whatsapp_typebot';
