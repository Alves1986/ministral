-- ============================================================
-- Migração: Suporte completo a Quotas e Limites de IA por Organização
-- Permite controlar limites de IA (Gratuita vs Paga/Turbo),
-- cotas semanais e contabilização de uso.
-- ============================================================

-- 1. Adicionar colunas de controle de IA na tabela organizations
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'ai_enabled') THEN
        ALTER TABLE organizations ADD COLUMN ai_enabled BOOLEAN DEFAULT true;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'ai_tier') THEN
        ALTER TABLE organizations ADD COLUMN ai_tier TEXT DEFAULT 'free'; -- 'free' | 'pro' | 'enterprise' | 'custom'
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'ai_weekly_limit') THEN
        ALTER TABLE organizations ADD COLUMN ai_weekly_limit INTEGER DEFAULT 25;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'ai_bonus_credits') THEN
        ALTER TABLE organizations ADD COLUMN ai_bonus_credits INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'ai_allowed_models') THEN
        ALTER TABLE organizations ADD COLUMN ai_allowed_models TEXT DEFAULT 'basic'; -- 'basic' | 'all'
    END IF;
END $$;

-- 2. Tabela de logs de uso de IA (ai_usage_logs)
CREATE TABLE IF NOT EXISTS ai_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    ministry_id UUID,
    task_type TEXT NOT NULL,
    model_used TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'success',  -- 'success' | 'error' | 'fallback'
    duration_ms INTEGER,
    error_message TEXT,
    tokens_prompt INTEGER,
    tokens_completion INTEGER
);

-- Índices para consultas de telemetria e cotas semanais
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at ON ai_usage_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_org_created ON ai_usage_logs (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_task_type ON ai_usage_logs (task_type);

-- RLS
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins podem ver ai_usage_logs" ON ai_usage_logs;
CREATE POLICY "Super admins podem ver ai_usage_logs"
ON ai_usage_logs FOR SELECT
TO authenticated
USING ( is_super_admin() = true );

DROP POLICY IF EXISTS "Admins podem ver ai_usage_logs de sua org" ON ai_usage_logs;
CREATE POLICY "Admins podem ver ai_usage_logs de sua org"
ON ai_usage_logs FOR SELECT
TO authenticated
USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Usuarios autenticados podem inserir ai_usage_logs" ON ai_usage_logs;
CREATE POLICY "Usuarios autenticados podem inserir ai_usage_logs"
ON ai_usage_logs FOR INSERT
TO authenticated
WITH CHECK ( true );

NOTIFY pgrst, 'reload schema';
