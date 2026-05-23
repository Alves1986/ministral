-- Migração para habilitar o controle do WhatsApp por ministério
-- Adicionar coluna 'whatsapp_enabled' na tabela 'organization_ministries'

ALTER TABLE public.organization_ministries 
ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN DEFAULT TRUE;

-- Atualizar registros existentes para TRUE, para não quebrar configurações anteriores
UPDATE public.organization_ministries 
SET whatsapp_enabled = TRUE 
WHERE whatsapp_enabled IS NULL;
