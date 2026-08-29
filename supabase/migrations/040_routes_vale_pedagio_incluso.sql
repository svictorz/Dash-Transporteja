-- 040 - Vale pedagio incluso
-- Marca se o valor de vale pedagio informado ja esta incluso na negociacao do frete.

ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS vale_pedagio_incluso BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.routes.vale_pedagio_incluso IS 'Indica se o vale pedagio esta incluso na negociacao do frete.';
