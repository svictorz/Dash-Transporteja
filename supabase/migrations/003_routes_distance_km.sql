-- Distância rodoviária estimada (km), preenchida automaticamente no dashboard
ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS distance_km DOUBLE PRECISION;

COMMENT ON COLUMN public.routes.distance_km IS 'Quilometragem estimada origem→destino (OSRM/OpenStreetMap)';
