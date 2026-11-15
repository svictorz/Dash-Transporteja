-- Dados descritivos opcionais da carga; fretes existentes permanecem intactos.
ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS cubage_m3 numeric(12,3),
  ADD COLUMN IF NOT EXISTS material_type text;

ALTER TABLE public.routes
  ADD CONSTRAINT routes_cubage_m3_nonnegative CHECK (cubage_m3 IS NULL OR cubage_m3 >= 0);

NOTIFY pgrst, 'reload schema';
