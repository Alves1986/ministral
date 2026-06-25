-- ============================================================
-- Migração: Habilita replicação Realtime para swap_requests
-- Garante que mudanças de status são propagadas em tempo real
-- para todos os membros conectados (invalidação automática do cache)
-- ============================================================

-- Habilitar replicação para swap_requests (necessário para Supabase Realtime)
ALTER TABLE swap_requests REPLICA IDENTITY FULL;

-- Adicionar à publicação do realtime (se ainda não estiver)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'swap_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE swap_requests;
    RAISE NOTICE 'swap_requests adicionada à publicação supabase_realtime';
  ELSE
    RAISE NOTICE 'swap_requests já está na publicação supabase_realtime';
  END IF;
END $$;

-- Habilitar replicação para schedule_assignments também (para atualização da escala em tempo real)
ALTER TABLE schedule_assignments REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'schedule_assignments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE schedule_assignments;
    RAISE NOTICE 'schedule_assignments adicionada à publicação supabase_realtime';
  ELSE
    RAISE NOTICE 'schedule_assignments já está na publicação supabase_realtime';
  END IF;
END $$;
