-- ============================================================
-- Migração: Corrige RLS de UPDATE em swap_requests
-- Problema: membros que assumem uma escala (takenBy) não conseguem
-- atualizar o status do pedido de troca para 'completed' porque
-- a policy de UPDATE só permitia o requester_id fazer isso.
-- ============================================================

-- 1. Remove políticas antigas de UPDATE na swap_requests se existirem
DROP POLICY IF EXISTS "swap_requests_update" ON swap_requests;
DROP POLICY IF EXISTS "Users can update their own swap requests" ON swap_requests;
DROP POLICY IF EXISTS "Members can update swap requests in their org" ON swap_requests;
DROP POLICY IF EXISTS "Members can update swap requests" ON swap_requests;

-- 2. Cria nova policy permissiva para UPDATE:
--    Permite que QUALQUER membro autenticado da mesma organização atualize
--    swap_requests (tanto quem criou quanto quem vai assumir a escala)
CREATE POLICY "Members can update swap requests in their org"
ON swap_requests
FOR UPDATE
USING (
  auth.uid() IS NOT NULL
  AND organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
);

-- 3. Garante também que schedule_assignments pode ser atualizado por membros
--    (provavelmente já existe, mas garantindo)
DO $$
DECLARE
  policy_exists boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'schedule_assignments' 
    AND policyname = 'Members can update schedule assignments in their org'
  ) INTO policy_exists;
  
  IF NOT policy_exists THEN
    EXECUTE '
      CREATE POLICY "Members can update schedule assignments in their org"
      ON schedule_assignments
      FOR UPDATE
      USING (
        auth.uid() IS NOT NULL
        AND organization_id IN (
          SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
      )
      WITH CHECK (
        auth.uid() IS NOT NULL
        AND organization_id IN (
          SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
      )
    ';
    RAISE NOTICE 'Policy criada para schedule_assignments';
  ELSE
    RAISE NOTICE 'Policy de schedule_assignments já existe, pulando';
  END IF;
END $$;
