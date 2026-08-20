-- Harden support ticket policies for the three application scopes.
-- Keep organization isolation and explicit superadmin override only.

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Remove legacy policies that broaden access through OR semantics.
DROP POLICY IF EXISTS "Author or super admin can update tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Org members can view their org tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Super admin can delete tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users can insert tickets for their org" ON public.support_tickets;

-- Recreate the canonical policies so this migration is self-contained.
DROP POLICY IF EXISTS "Membros podem ler tickets da sua org" ON public.support_tickets;
CREATE POLICY "Membros podem ler tickets da sua org"
ON public.support_tickets FOR SELECT TO authenticated
USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Membros podem abrir tickets da sua org" ON public.support_tickets;
CREATE POLICY "Membros podem abrir tickets da sua org"
ON public.support_tickets FOR INSERT TO authenticated
WITH CHECK (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    AND author_id = auth.uid()
);

DROP POLICY IF EXISTS "Admin da org pode atualizar tickets" ON public.support_tickets;
CREATE POLICY "Admin da org pode atualizar tickets"
ON public.support_tickets FOR UPDATE TO authenticated
USING (
    (
        organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND is_admin = true AND is_super_admin = false
        )
    )
    OR public.is_super_admin()
)
WITH CHECK (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Admin da org pode deletar tickets" ON public.support_tickets;
CREATE POLICY "Admin da org pode deletar tickets"
ON public.support_tickets FOR DELETE TO authenticated
USING (
    (
        organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND is_admin = true AND is_super_admin = false
        )
    )
    OR public.is_super_admin()
);

NOTIFY pgrst, 'reload schema';
