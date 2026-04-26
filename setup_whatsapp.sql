-- SETUP WHATSAPP NOTIFICATIONS

-- 1. Create whatsapp_settings table
CREATE TABLE IF NOT EXISTS public.whatsapp_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT true,
    send_days_before INTEGER DEFAULT 0,
    send_time TIME DEFAULT '09:00:00',
    ministry_settings JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT whatsapp_settings_org_id_key UNIQUE (org_id)
);

-- 2. Add RLS Policies
ALTER TABLE public.whatsapp_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users in same org" ON public.whatsapp_settings
    FOR SELECT
    TO authenticated
    USING (org_id IN (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Enable update/insert for admins" ON public.whatsapp_settings
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND organization_id = org_id 
            AND (is_admin = true OR is_super_admin = true)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND organization_id = org_id 
            AND (is_admin = true OR is_super_admin = true)
        )
    );

-- 3. Adjust the cron job to run every hour
SELECT cron.unschedule('ministral-whatsapp-reminders');

SELECT cron.schedule(
    'ministral-whatsapp-reminders',
    '0 * * * *', -- Every hour
    $$
    SELECT net.http_post(
        url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/whatsapp-reminders',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
    $$
);
