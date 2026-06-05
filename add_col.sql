ALTER TABLE public.whatsapp_usage_logs ADD COLUMN IF NOT EXISTS instance_name text; NOTIFY pgrst, 'reload schema';  
