-- ============================================================
-- Migração: Cria tabela whatsapp_usage_logs e adiciona RLS
-- Problema: A telemetria de WhatsApp aparecia zerada para super admins.
-- Causa: A tabela não existia ou não tinha RLS permitindo SELECT para o Super Admin.
-- ============================================================

-- 1. Cria a tabela (caso ainda não exista)
CREATE TABLE IF NOT EXISTS whatsapp_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    ministry_id UUID,
    instance_name TEXT
);

-- 2. Habilita RLS
ALTER TABLE whatsapp_usage_logs ENABLE ROW LEVEL SECURITY;

-- 3. Permite leitura apenas para super admins
DROP POLICY IF EXISTS "Super admins podem ver os logs de uso do whatsapp" ON whatsapp_usage_logs;
CREATE POLICY "Super admins podem ver os logs de uso do whatsapp"
ON whatsapp_usage_logs
FOR SELECT
TO authenticated
USING (
    is_super_admin() = true
);

-- Atualiza cache do PostgREST
NOTIFY pgrst, 'reload schema';
