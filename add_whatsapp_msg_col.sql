-- Adiciona coluna de mensagem customizada de WhatsApp por ministério
ALTER TABLE public.ministry_settings
  ADD COLUMN IF NOT EXISTS whatsapp_custom_message text;

NOTIFY pgrst, 'reload schema';
