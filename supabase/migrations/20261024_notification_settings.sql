ALTER TABLE public.organization_ministries
  ADD COLUMN IF NOT EXISTS notification_settings jsonb DEFAULT '{}'::jsonb;
