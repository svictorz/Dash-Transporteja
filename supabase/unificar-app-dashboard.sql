-- ============================================
-- UNIFICAR APP MOTORISTA E DASHBOARD
-- ============================================
-- Objetivo: app (JaAPP) e dashboard usam as MESMAS tabelas
-- (routes, checkins, drivers, location_updates).
--
-- O app chama estes RPCs em vez de escrever direto em
-- transports/locations. Execute também rastreio-continuo-setup.sql
-- se ainda não tiver a tabela location_updates.
-- ============================================

-- Remover versões antigas dos RPCs (evita erro de mudança de tipo de retorno)
DROP FUNCTION IF EXISTS public.validate_driver_login(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.confirm_pickup(UUID, UUID, TEXT, DOUBLE PRECISION, DOUBLE PRECISION);
DROP FUNCTION IF EXISTS public.confirm_delivery(UUID, UUID, TEXT, DOUBLE PRECISION, DOUBLE PRECISION);
DROP FUNCTION IF EXISTS public.insert_location_update(UUID, UUID, BIGINT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION);
DROP FUNCTION IF EXISTS public.start_route_tracking(UUID, UUID);

-- 1) RPC: Login do motorista (placa + código do frete)
--    Retorna dados da rota para o app exibir e usar nas próximas chamadas.
--    Código = freight_id (número do frete).
CREATE OR REPLACE FUNCTION public.validate_driver_login(p_plate TEXT, p_code TEXT)
RETURNS TABLE (
  transport_id UUID,
  vehicle_id UUID,
  driver_name TEXT,
  origin TEXT,
  destination TEXT,
  status TEXT,
  code TEXT,
  route_id UUID,
  driver_id UUID,
  freight_id BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plate TEXT := upper(regexp_replace(p_plate, '[^A-Z0-9]', '', 'gi'));
  v_freight_id BIGINT;
BEGIN
  v_freight_id := nullif(trim(p_code), '')::bigint;
  IF v_freight_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    r.id AS transport_id,
    d.id AS vehicle_id,
    d.name AS driver_name,
    (r.origin || ', ' || r.origin_state) AS origin,
    (r.destination || ', ' || r.destination_state) AS destination,
    CASE r.status
      WHEN 'inTransit' THEN 'in_transit'
      WHEN 'pickedUp' THEN 'pickup_confirmed'
      ELSE r.status
    END::TEXT AS status,
    r.freight_id::TEXT AS code,
    r.id AS route_id,
    d.id AS driver_id,
    r.freight_id AS freight_id
  FROM public.routes r
  JOIN public.drivers d ON d.id = r.driver_id
  WHERE upper(regexp_replace(d.plate, '[^A-Z0-9]', '', 'gi')) = v_plate
    AND r.freight_id = v_freight_id
    AND r.status <> 'cancelled'
  LIMIT 1;
END;
$$;

-- 2) RPC: Confirmar coleta (pickup) – insere check-in e atualiza rota
CREATE OR REPLACE FUNCTION public.confirm_pickup(
  p_route_id UUID,
  p_driver_id UUID,
  p_photo_url TEXT,
  p_coords_lat DOUBLE PRECISION,
  p_coords_lng DOUBLE PRECISION
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_freight_id BIGINT;
BEGIN
  SELECT r.freight_id INTO v_freight_id
  FROM public.routes r
  WHERE r.id = p_route_id AND r.driver_id = p_driver_id;
  IF v_freight_id IS NULL THEN
    RAISE EXCEPTION 'Rota ou motorista inválido';
  END IF;

  INSERT INTO public.checkins (type, photo_url, coords_lat, coords_lng, freight_id, driver_id, route_id)
  VALUES ('pickup', p_photo_url, p_coords_lat, p_coords_lng, v_freight_id, p_driver_id, p_route_id);

  UPDATE public.routes
  SET status = 'pickedUp', updated_at = now()
  WHERE id = p_route_id;
END;
$$;

-- 3) RPC: Confirmar entrega (delivery)
CREATE OR REPLACE FUNCTION public.confirm_delivery(
  p_route_id UUID,
  p_driver_id UUID,
  p_photo_url TEXT,
  p_coords_lat DOUBLE PRECISION,
  p_coords_lng DOUBLE PRECISION
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_freight_id BIGINT;
BEGIN
  SELECT r.freight_id INTO v_freight_id
  FROM public.routes r
  WHERE r.id = p_route_id AND r.driver_id = p_driver_id;
  IF v_freight_id IS NULL THEN
    RAISE EXCEPTION 'Rota ou motorista inválido';
  END IF;

  INSERT INTO public.checkins (type, photo_url, coords_lat, coords_lng, freight_id, driver_id, route_id)
  VALUES ('delivery', p_photo_url, p_coords_lat, p_coords_lng, v_freight_id, p_driver_id, p_route_id);

  UPDATE public.routes
  SET status = 'delivered', updated_at = now()
  WHERE id = p_route_id;
END;
$$;

-- 4) RPC: Inserir atualização de localização (rastreio contínuo)
--    Requer tabela location_updates (execute rastreio-continuo-setup.sql antes).
CREATE OR REPLACE FUNCTION public.insert_location_update(
  p_route_id UUID,
  p_driver_id UUID,
  p_freight_id BIGINT,
  p_coords_lat DOUBLE PRECISION,
  p_coords_lng DOUBLE PRECISION,
  p_accuracy DOUBLE PRECISION DEFAULT NULL,
  p_speed DOUBLE PRECISION DEFAULT NULL,
  p_heading DOUBLE PRECISION DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.routes r
    WHERE r.id = p_route_id AND r.driver_id = p_driver_id AND r.freight_id = p_freight_id
  ) THEN
    RAISE EXCEPTION 'Rota inválida';
  END IF;

  INSERT INTO public.location_updates (route_id, driver_id, freight_id, coords_lat, coords_lng, accuracy, speed, heading)
  VALUES (p_route_id, p_driver_id, p_freight_id, p_coords_lat, p_coords_lng, p_accuracy, p_speed, p_heading);
END;
$$;

-- 5) RPC: Atualizar status da rota para “em trânsito” (início do rastreio)
CREATE OR REPLACE FUNCTION public.start_route_tracking(p_route_id UUID, p_driver_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.routes
  SET status = 'inTransit', updated_at = now()
  WHERE id = p_route_id AND driver_id = p_driver_id;
END;
$$;

-- Permissão para anon/authenticated chamar os RPCs
GRANT EXECUTE ON FUNCTION public.validate_driver_login(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_pickup(UUID, UUID, TEXT, DOUBLE PRECISION, DOUBLE PRECISION) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_delivery(UUID, UUID, TEXT, DOUBLE PRECISION, DOUBLE PRECISION) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.insert_location_update(UUID, UUID, BIGINT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_route_tracking(UUID, UUID) TO anon, authenticated;
