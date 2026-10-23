ALTER TABLE public.organization_ministries ADD COLUMN IF NOT EXISTS reminder_hour integer DEFAULT 8;
