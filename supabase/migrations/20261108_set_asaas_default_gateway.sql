-- Novas organizações devem iniciar no gateway Asaas.
-- Não altera organizações existentes nem assinaturas legadas.
ALTER TABLE public.organizations
  ALTER COLUMN payment_gateway SET DEFAULT 'asaas';
