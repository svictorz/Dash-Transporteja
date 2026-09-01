-- 043 - Vale pedagio incluso como padrao
-- X/Incluso passa a ser o padrao para novos fretes e registros antigos.

ALTER TABLE public.routes
  ALTER COLUMN vale_pedagio_incluso SET DEFAULT true;

UPDATE public.routes
SET vale_pedagio_incluso = true
WHERE vale_pedagio_incluso IS DISTINCT FROM true;
