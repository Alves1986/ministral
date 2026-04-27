-- SETUP MINISTRY WHATSAPP
CREATE TABLE IF NOT EXISTS public.ministry_whatsapp (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    ministry_id TEXT NOT NULL REFERENCES public.organization_ministries(id) ON DELETE CASCADE,
    instance_name TEXT NOT NULL,
    phone_number TEXT,
    connected BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT ministry_whatsapp_unique UNIQUE (ministry_id)
);

ALTER TABLE public.ministry_whatsapp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users in org" ON public.ministry_whatsapp
    FOR SELECT
    TO authenticated
    USING (org_id IN (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Enable updates for admins" ON public.ministry_whatsapp
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND organization_id = org_id AND (is_admin = true OR is_super_admin = true)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND organization_id = org_id AND (is_admin = true OR is_super_admin = true)
        )
    );
