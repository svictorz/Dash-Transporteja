-- Permite frete sem motorista (driver_id NULL). Idempotente se a 007 já tiver sido aplicada.
ALTER TABLE public.routes
  ALTER COLUMN driver_id DROP NOT NULL;
