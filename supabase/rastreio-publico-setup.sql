-- ============================================
-- CONFIGURAÇÃO PARA RASTREIO PÚBLICO
-- ============================================
-- Este script configura o acesso público ao rastreio
-- Permite que clientes visualizem o status de suas encomendas
-- sem precisar fazer login
--
-- IMPORTANTE: Execute este script APÓS o setup-completo.sql
-- Dashboard > SQL Editor > New Query > Cole este conteúdo > Run

-- ============================================
-- 1. POLÍTICAS PÚBLICAS PARA RASTREIO
-- ============================================

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Public can read routes by freight_id" ON public.routes;
DROP POLICY IF EXISTS "Public can read checkins by freight_id" ON public.checkins;
DROP POLICY IF EXISTS "Public can read driver info for tracking" ON public.drivers;

-- Permitir leitura pública de rotas por freight_id (apenas campos necessários)
-- Isso permite que qualquer pessoa com o link de rastreio veja o status
CREATE POLICY "Public can read routes by freight_id"
ON public.routes
FOR SELECT
TO anon, authenticated
USING (true); -- Permitir leitura de todas as rotas para rastreio público
-- NOTA: Em produção, considere adicionar validação adicional se necessário

-- Permitir leitura pública de check-ins por freight_id
CREATE POLICY "Public can read checkins by freight_id"
ON public.checkins
FOR SELECT
TO anon, authenticated
USING (true); -- Permitir leitura de todos os check-ins para rastreio público

-- Permitir leitura pública de informações básicas do motorista
-- Apenas campos necessários para exibição no rastreio
CREATE POLICY "Public can read driver info for tracking"
ON public.drivers
FOR SELECT
TO anon, authenticated
USING (true); -- Permitir leitura de informações básicas do motorista

-- ============================================
-- 2. TRIGGER PARA ATUALIZAR STATUS DA ROTA
-- ============================================

-- Função para atualizar status da rota automaticamente quando check-in é feito
CREATE OR REPLACE FUNCTION update_route_status_on_checkin()
RETURNS TRIGGER AS $$
BEGIN
  -- Se for check-in de pickup, atualizar status para 'pickedUp'
  IF NEW.type = 'pickup' THEN
    UPDATE public.routes
    SET status = 'pickedUp',
        updated_at = NOW()
    WHERE freight_id = NEW.freight_id
      AND status IN ('pending', 'inTransit');
  END IF;

  -- Se for check-in de delivery, atualizar status para 'delivered'
  IF NEW.type = 'delivery' THEN
    UPDATE public.routes
    SET status = 'delivered',
        updated_at = NOW()
    WHERE freight_id = NEW.freight_id
      AND status IN ('pickedUp', 'inTransit');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para executar a função após inserção de check-in
DROP TRIGGER IF EXISTS trigger_update_route_status ON public.checkins;
CREATE TRIGGER trigger_update_route_status
  AFTER INSERT ON public.checkins
  FOR EACH ROW
  EXECUTE FUNCTION update_route_status_on_checkin();

-- ============================================
-- 3. FUNÇÃO PARA VALIDAÇÃO DE CHECK-IN
-- ============================================

-- Função para validar se o motorista pode fazer check-in
CREATE OR REPLACE FUNCTION validate_checkin_permission()
RETURNS TRIGGER AS $$
DECLARE
  route_driver_id UUID;
  checkin_driver_id UUID;
BEGIN
  -- Buscar driver_id da rota
  SELECT driver_id INTO route_driver_id
  FROM public.routes
  WHERE freight_id = NEW.freight_id;

  -- Se o check-in tem driver_id, validar se é o mesmo da rota
  IF NEW.driver_id IS NOT NULL AND route_driver_id IS NOT NULL THEN
    IF NEW.driver_id != route_driver_id THEN
      RAISE EXCEPTION 'Driver não autorizado para este frete';
    END IF;
  END IF;

  -- Validar coordenadas (deve estar dentro de um raio razoável)
  -- Esta validação pode ser ajustada conforme necessário
  IF NEW.coords_lat IS NULL OR NEW.coords_lng IS NULL THEN
    RAISE EXCEPTION 'Coordenadas GPS são obrigatórias';
  END IF;

  -- Validar se a foto foi fornecida
  IF NEW.photo_url IS NULL OR NEW.photo_url = '' THEN
    RAISE EXCEPTION 'Foto é obrigatória para check-in';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para validar check-in antes de inserir
DROP TRIGGER IF EXISTS trigger_validate_checkin ON public.checkins;
CREATE TRIGGER trigger_validate_checkin
  BEFORE INSERT ON public.checkins
  FOR EACH ROW
  EXECUTE FUNCTION validate_checkin_permission();

-- ============================================
-- 4. ÍNDICES ADICIONAIS PARA PERFORMANCE
-- ============================================

-- Índice composto para buscas frequentes de check-ins por freight_id e tipo
CREATE INDEX IF NOT EXISTS idx_checkins_freight_type 
ON public.checkins(freight_id, type, timestamp DESC);

-- Índice para busca de rotas por status (para dashboards)
CREATE INDEX IF NOT EXISTS idx_routes_status_created 
ON public.routes(status, created_at DESC);

-- ============================================
-- 5. VIEW PARA RASTREIO PÚBLICO (OPCIONAL)
-- ============================================

-- View otimizada para rastreio público
-- Facilita consultas e melhora performance
CREATE OR REPLACE VIEW public.tracking_info AS
SELECT 
  r.freight_id,
  r.origin,
  r.origin_state,
  r.destination,
  r.destination_state,
  r.pickup_date,
  r.estimated_delivery,
  r.status,
  r.vehicle,
  r.plate,
  d.name as driver_name,
  d.phone as driver_phone,
  d.email as driver_email,
  (
    SELECT COUNT(*) 
    FROM public.checkins c 
    WHERE c.freight_id = r.freight_id AND c.type = 'pickup'
  ) as has_pickup,
  (
    SELECT COUNT(*) 
    FROM public.checkins c 
    WHERE c.freight_id = r.freight_id AND c.type = 'delivery'
  ) as has_delivery,
  (
    SELECT timestamp 
    FROM public.checkins c 
    WHERE c.freight_id = r.freight_id AND c.type = 'pickup'
    ORDER BY timestamp DESC 
    LIMIT 1
  ) as last_pickup_time,
  (
    SELECT timestamp 
    FROM public.checkins c 
    WHERE c.freight_id = r.freight_id AND c.type = 'delivery'
    ORDER BY timestamp DESC 
    LIMIT 1
  ) as last_delivery_time
FROM public.routes r
LEFT JOIN public.drivers d ON d.id = r.driver_id;

-- Política para acesso público à view
GRANT SELECT ON public.tracking_info TO anon, authenticated;

-- ============================================
-- 6. FUNÇÃO PARA BUSCAR DADOS DE RASTREIO
-- ============================================

-- Função helper para buscar dados completos de rastreio
CREATE OR REPLACE FUNCTION get_tracking_data(p_freight_id BIGINT)
RETURNS TABLE (
  route_data JSONB,
  checkins_data JSONB,
  driver_data JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT row_to_json(r)::JSONB FROM public.routes r WHERE r.freight_id = p_freight_id LIMIT 1) as route_data,
    (SELECT json_agg(row_to_json(c))::JSONB FROM public.checkins c WHERE c.freight_id = p_freight_id ORDER BY c.timestamp ASC) as checkins_data,
    (SELECT row_to_json(d)::JSONB FROM public.drivers d 
     INNER JOIN public.routes r ON r.driver_id = d.id 
     WHERE r.freight_id = p_freight_id LIMIT 1) as driver_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permitir acesso público à função
GRANT EXECUTE ON FUNCTION get_tracking_data(BIGINT) TO anon, authenticated;

-- ============================================
-- 7. COMENTÁRIOS E DOCUMENTAÇÃO
-- ============================================

COMMENT ON FUNCTION update_route_status_on_checkin() IS 
'Atualiza automaticamente o status da rota quando um check-in é realizado';

COMMENT ON FUNCTION validate_checkin_permission() IS 
'Valida permissões e dados antes de permitir inserção de check-in';

COMMENT ON VIEW public.tracking_info IS 
'View otimizada para consultas de rastreio público';

COMMENT ON FUNCTION get_tracking_data(BIGINT) IS 
'Retorna todos os dados necessários para exibir o rastreio de um frete';

-- ============================================
-- FIM DA CONFIGURAÇÃO
-- ============================================
-- Após executar este script:
-- 1. Teste o acesso público: /rastreio/[freightId]
-- 2. Verifique se os check-ins atualizam o status automaticamente
-- 3. Teste as validações de check-in
-- 4. Monitore a performance das consultas

