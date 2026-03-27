-- ============================================
-- RLS: APERTAR SEGURANÇA EM location_updates
-- ============================================
-- Remove leitura pública ampla (USING true) e expõe
-- dados de rastreio apenas via funções por freight_id.
-- Execute no SQL Editor do Supabase após rastreio-continuo-setup.sql
-- ============================================

-- 1. Remover política que permitia anon ler TODAS as localizações
DROP POLICY IF EXISTS "Public can read location updates for tracking" ON public.location_updates;

-- 2. Função: última localização de um frete (para rastreio público)
CREATE OR REPLACE FUNCTION public.get_last_route_location(p_freight_id BIGINT)
RETURNS TABLE (
  coords_lat DOUBLE PRECISION,
  coords_lng DOUBLE PRECISION,
  accuracy DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  "timestamp" TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    lu.coords_lat,
    lu.coords_lng,
    lu.accuracy,
    lu.speed,
    lu.heading,
    lu."timestamp"
  FROM public.location_updates lu
  WHERE lu.freight_id = p_freight_id
  ORDER BY lu."timestamp" DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_last_route_location(BIGINT) IS
'Retorna a última localização conhecida de um frete. Uso: rastreio público por freight_id.';

GRANT EXECUTE ON FUNCTION public.get_last_route_location(BIGINT) TO anon, authenticated;

-- ============================================
-- Resultado
-- ============================================
-- Anon não pode mais fazer SELECT direto em location_updates.
-- Rastreio público usa apenas:
--   - get_route_track(p_freight_id)  → trajeto completo
--   - get_last_route_location(p_freight_id) → última posição
-- Usuários autenticados continuam com a política
-- "Authenticated users can read location updates" (por rota/admin/driver).
