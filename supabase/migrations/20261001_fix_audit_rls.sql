-- Script para corrigir a visualização dos logs de auditoria para todos os administradores.
-- Copie este código e execute no SQL Editor do seu painel do Supabase.

DROP POLICY IF EXISTS "Admins podem ver logs de auditoria da sua org" ON ministry_audit_logs;

CREATE POLICY "Admins podem ver logs de auditoria da sua org"
ON ministry_audit_logs FOR SELECT TO authenticated
USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (is_admin = true OR is_super_admin = true))
        OR
        EXISTS (SELECT 1 FROM ministry_members WHERE profile_id = auth.uid() AND (role = 'admin' OR role = 'leader' OR role = 'lider'))
    )
);

-- Garantir que a policy de inserção também não barre outros administradores
DROP POLICY IF EXISTS "Admins podem inserir logs de auditoria" ON ministry_audit_logs;

CREATE POLICY "Admins podem inserir logs de auditoria"
ON ministry_audit_logs FOR INSERT TO authenticated
WITH CHECK (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (is_admin = true OR is_super_admin = true))
        OR
        EXISTS (SELECT 1 FROM ministry_members WHERE profile_id = auth.uid() AND (role = 'admin' OR role = 'leader' OR role = 'lider'))
    )
);
