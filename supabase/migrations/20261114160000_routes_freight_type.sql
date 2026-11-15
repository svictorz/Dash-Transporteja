-- Classificação opcional dos fretes. Registros existentes permanecem sem tipo.
ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS freight_type text;

ALTER TABLE public.routes
  ADD CONSTRAINT routes_freight_type_check
  CHECK (freight_type IS NULL OR freight_type IN ('Dedicado', 'Fracionado'));

NOTIFY pgrst, 'reload schema';
