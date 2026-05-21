-- Valor de vale pedágio, preenchido manualmente no painel (opcional).
ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS vale_pedagio NUMERIC(14,2);

COMMENT ON COLUMN public.routes.vale_pedagio IS 'Valor de vale pedágio informado manualmente no cadastro do frete.';
