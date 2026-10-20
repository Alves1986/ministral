-- ============================================================
-- Migração: Adiciona target_user_id e action_link à tabela notifications
-- ============================================================

-- 1. Adiciona coluna target_user_id (para notificações direcionadas) se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'notifications' 
        AND column_name = 'target_user_id'
    ) THEN
        ALTER TABLE public.notifications 
            ADD COLUMN target_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 2. Adiciona coluna action_link (para redirecionamento por clique) se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'notifications' 
        AND column_name = 'action_link'
    ) THEN
        ALTER TABLE public.notifications 
            ADD COLUMN action_link text;
    END IF;
END $$;

-- 3. Índices para performance das consultas por usuário e organização/ministério
CREATE INDEX IF NOT EXISTS idx_notifications_target_user_id 
    ON public.notifications(target_user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_org_ministry 
    ON public.notifications(organization_id, ministry_id);

-- 4. Notifica o PostgREST para recarregar o schema cache imediatamente
NOTIFY pgrst, 'reload schema';
