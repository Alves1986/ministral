-- ============================================================
-- Migração: Suporte ao Gateway de Pagamentos Asaas (Coexistência com Stripe)
-- Adiciona colunas para customer e subscription do Asaas e tabela de logs
-- ============================================================

-- 1. Adicionar colunas do Asaas na tabela organizations
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'asaas_customer_id') THEN
        ALTER TABLE organizations ADD COLUMN asaas_customer_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'asaas_subscription_id') THEN
        ALTER TABLE organizations ADD COLUMN asaas_subscription_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'payment_gateway') THEN
        ALTER TABLE organizations ADD COLUMN payment_gateway TEXT DEFAULT 'stripe';
    END IF;
END $$;

-- 2. Tabela de logs de eventos do Asaas (idempotência contra webhooks repetidos)
CREATE TABLE IF NOT EXISTS asaas_event_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT UNIQUE NOT NULL,
    event_type TEXT,
    payload JSONB,
    processed_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para verificação de idempotência rápida
CREATE INDEX IF NOT EXISTS idx_asaas_event_log_event_id ON asaas_event_log (event_id);
CREATE INDEX IF NOT EXISTS idx_asaas_event_log_processed_at ON asaas_event_log (processed_at DESC);

-- RLS para tabela de log do Asaas
ALTER TABLE asaas_event_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins podem ver asaas_event_log" ON asaas_event_log;
CREATE POLICY "Super admins podem ver asaas_event_log"
ON asaas_event_log FOR SELECT
TO authenticated
USING ( is_super_admin() = true );

