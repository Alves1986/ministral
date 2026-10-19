-- Criação da tabela de mensagens do chat do evento
CREATE TABLE IF NOT EXISTS event_messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    ministry_id UUID NOT NULL REFERENCES organization_ministries(id) ON DELETE CASCADE,
    event_iso TEXT NOT NULL,
    sender_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content_type TEXT NOT NULL CHECK (content_type IN ('text', 'audio')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE event_messages ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança
CREATE POLICY "Membros da org podem ver mensagens" ON event_messages
FOR SELECT USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Membros da org podem inserir mensagens" ON event_messages
FOR INSERT WITH CHECK (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
);

-- Criação do bucket de storage para áudios (se usar Storage do Supabase)
-- OBS: Esta parte pode precisar ser feita manualmente no painel do Supabase se der erro,
-- pois a tabela 'storage.buckets' pertence ao esquema de storage.
INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat_audio', 'chat_audio', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas do Storage para chat_audio
CREATE POLICY "Acesso público aos áudios" ON storage.objects
FOR SELECT USING ( bucket_id = 'chat_audio' );

CREATE POLICY "Upload autenticado para áudios" ON storage.objects
FOR INSERT WITH CHECK ( bucket_id = 'chat_audio' AND auth.role() = 'authenticated' );

-- Habilitar Realtime para event_messages
BEGIN;
  -- Remove se já existir e recria para garantir
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;
ALTER PUBLICATION supabase_realtime ADD TABLE event_messages;
