-- ============================================================
-- 018 - Remover infra do app de motorista
-- ============================================================
-- O sistema agora é puramente interno (controle operacional pelo
-- dashboard). Removemos o que pertencia ao app mobile do motorista
-- e ao rastreio público:
--   - Tabela `public.checkins` (fotos/GPS de coleta e entrega)
--   - Tabela `public.location_updates` (rastreio contínuo via app)
--   - Função/trigger `validate_plate` (validava placa em routes)
--
-- O cadastro de motoristas (`public.drivers`) e os campos de motorista
-- nas rotas (`driver_*`, `plate`, `vehicle`) são mantidos — continuam
-- sendo úteis para registrar quem fez cada frete.

-- ------------------------------------------------------------
-- 1) Tabela checkins
-- ------------------------------------------------------------
DROP TABLE IF EXISTS public.checkins CASCADE;

-- ------------------------------------------------------------
-- 2) Tabela location_updates (rastreio contínuo do app)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS public.location_updates CASCADE;

-- ------------------------------------------------------------
-- 3) Triggers/funções de validação de placa
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS validate_plate_trigger ON public.routes;
DROP TRIGGER IF EXISTS routes_validate_plate ON public.routes;
DROP TRIGGER IF EXISTS validate_route_plate ON public.routes;
DROP FUNCTION IF EXISTS public.validate_plate() CASCADE;
DROP FUNCTION IF EXISTS public.validate_route_plate() CASCADE;

-- ------------------------------------------------------------
-- 4) Limpeza de buckets de storage não usados (se existirem)
-- ------------------------------------------------------------
-- Mantemos `checkin-photos` (usado pelo upload de docs do frete: NF, CT-e).
-- Removemos `transport-photos` que era exclusivo do app mobile.
DELETE FROM storage.objects WHERE bucket_id = 'transport-photos';
DELETE FROM storage.buckets WHERE id = 'transport-photos';
