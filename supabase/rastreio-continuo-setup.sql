-- ============================================
-- RASTREIO CONTÍNUO - SETUP
-- ============================================
-- Este script cria a estrutura necessária para
-- rastreamento contínuo de localização durante o trajeto
-- ============================================

-- ============================================
-- 1. TABELA DE ATUALIZAÇÕES DE LOCALIZAÇÃO
-- ============================================

CREATE TABLE IF NOT EXISTS public.location_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  freight_id BIGINT REFERENCES public.routes(freight_id) ON DELETE CASCADE,
  coords_lat DOUBLE PRECISION NOT NULL,
  coords_lng DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_location_updates_route_id ON public.location_updates(route_id);
CREATE INDEX IF NOT EXISTS idx_location_updates_freight_id ON public.location_updates(freight_id);
CREATE INDEX IF NOT EXISTS idx_location_updates_driver_id ON public.location_updates(driver_id);
CREATE INDEX IF NOT EXISTS idx_location_updates_timestamp ON public.location_updates("timestamp");
CREATE INDEX IF NOT EXISTS idx_location_updates_route_timestamp ON public.location_updates(route_id, "timestamp");

-- ============================================
-- 2. ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE public.location_updates ENABLE ROW LEVEL SECURITY;

-- Política: Motoristas podem inserir suas próprias localizações
DROP POLICY IF EXISTS "Drivers can insert own location updates" ON public.location_updates;
CREATE POLICY "Drivers can insert own location updates" ON public.location_updates
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.drivers d
      WHERE d.id = driver_id 
      AND d.user_id = auth.uid()
    )
  );

-- Política: Usuários autenticados podem ler localizações de rotas que têm acesso
DROP POLICY IF EXISTS "Authenticated users can read location updates" ON public.location_updates;
CREATE POLICY "Authenticated users can read location updates" ON public.location_updates
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.routes r
      WHERE r.id = route_id
      AND (
        -- Admin ou operador pode ver tudo
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = auth.uid() 
          AND u.role IN ('admin', 'operator')
        )
        OR
        -- Motorista pode ver suas próprias localizações
        EXISTS (
          SELECT 1 FROM public.drivers d
          WHERE d.id = driver_id
          AND d.user_id = auth.uid()
        )
      )
    )
  );

-- Política: Acesso público para rastreio (apenas leitura)
DROP POLICY IF EXISTS "Public can read location updates for tracking" ON public.location_updates;
CREATE POLICY "Public can read location updates for tracking" ON public.location_updates
  FOR SELECT TO anon, authenticated
  USING (true); -- Permitir acesso público para rastreio

-- Política: Motoristas podem deletar suas próprias localizações (limpeza)
DROP POLICY IF EXISTS "Drivers can delete own location updates" ON public.location_updates;
CREATE POLICY "Drivers can delete own location updates" ON public.location_updates
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.drivers d
      WHERE d.id = driver_id 
      AND d.user_id = auth.uid()
    )
  );

-- ============================================
-- 3. FUNÇÃO PARA LIMPAR LOCALIZAÇÕES ANTIGAS
-- ============================================

CREATE OR REPLACE FUNCTION public.cleanup_old_location_updates()
RETURNS void AS $$
BEGIN
  -- Deletar localizações com mais de 30 dias
  DELETE FROM public.location_updates
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. VIEW PARA ÚLTIMA LOCALIZAÇÃO DE CADA ROTA
-- ============================================

CREATE OR REPLACE VIEW public.last_route_location AS
SELECT DISTINCT ON (route_id)
  route_id,
  freight_id,
  driver_id,
  coords_lat,
  coords_lng,
  accuracy,
  speed,
  heading,
  "timestamp"
FROM public.location_updates
ORDER BY route_id, "timestamp" DESC;

-- Política para acesso público à view
GRANT SELECT ON public.last_route_location TO anon, authenticated;

-- ============================================
-- 5. FUNÇÃO PARA BUSCAR TRAJETO DE UMA ROTA
-- ============================================

CREATE OR REPLACE FUNCTION public.get_route_track(p_freight_id BIGINT)
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
  ORDER BY lu."timestamp" ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permitir acesso público à função
GRANT EXECUTE ON FUNCTION public.get_route_track(BIGINT) TO anon, authenticated;

-- ============================================
-- FIM DO SETUP
-- ============================================
-- Execute este script no SQL Editor do Supabase
-- para habilitar rastreamento contínuo

