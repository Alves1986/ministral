-- ============================================================
-- Migration: Padronizar org_id → organization_id nas tabelas WhatsApp
-- Data: 2026-05-23
-- Contexto: Audit fix #3 — org_id diverge do padrão organization_id
-- ATENÇÃO: Execute no Supabase SQL Editor em STAGING primeiro
-- ============================================================

-- 1. whatsapp_scheduled_notifications
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_scheduled_notifications' AND column_name = 'org_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_scheduled_notifications' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE whatsapp_scheduled_notifications 
      RENAME COLUMN org_id TO organization_id;
    RAISE NOTICE 'whatsapp_scheduled_notifications: org_id → organization_id renomeado.';
  ELSE
    RAISE NOTICE 'whatsapp_scheduled_notifications: coluna já existe ou org_id não encontrado — nenhuma alteração feita.';
  END IF;
END $$;

-- 2. whatsapp_usage_logs
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_usage_logs' AND column_name = 'org_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_usage_logs' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE whatsapp_usage_logs 
      RENAME COLUMN org_id TO organization_id;
    RAISE NOTICE 'whatsapp_usage_logs: org_id → organization_id renomeado.';
  ELSE
    RAISE NOTICE 'whatsapp_usage_logs: coluna já existe ou org_id não encontrado — nenhuma alteração feita.';
  END IF;
END $$;

-- 3. ministry_whatsapp — verificar se usa org_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ministry_whatsapp' AND column_name = 'org_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ministry_whatsapp' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE ministry_whatsapp 
      RENAME COLUMN org_id TO organization_id;
    RAISE NOTICE 'ministry_whatsapp: org_id → organization_id renomeado.';
  ELSE
    RAISE NOTICE 'ministry_whatsapp: nenhuma alteração necessária.';
  END IF;
END $$;

-- 4. Recriar RLS policies se necessário
-- (Execute apenas se as policies existentes usam org_id como filtro)
-- Exemplo:
-- DROP POLICY IF EXISTS "whatsapp_scheduled_by_org" ON whatsapp_scheduled_notifications;
-- CREATE POLICY "whatsapp_scheduled_by_org" ON whatsapp_scheduled_notifications
--   USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- Verificação final
SELECT 
  table_name, 
  column_name, 
  data_type
FROM information_schema.columns
WHERE table_name IN ('whatsapp_scheduled_notifications', 'whatsapp_usage_logs', 'ministry_whatsapp')
  AND column_name IN ('org_id', 'organization_id')
ORDER BY table_name, column_name;
