-- A janela de apontamentos precisa guardar data e hora.
-- Em instalações antigas essas colunas podem ter sido criadas como DATE,
-- o que descartava a hora e fazia o formulário voltar para 00:00.
ALTER TABLE public.organization_ministries
  ALTER COLUMN availability_start TYPE timestamptz
    USING availability_start::timestamptz,
  ALTER COLUMN availability_end TYPE timestamptz
    USING availability_end::timestamptz;
