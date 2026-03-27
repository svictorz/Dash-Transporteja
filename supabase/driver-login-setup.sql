-- ============================================
-- LOGIN DO MOTORISTA (Placa + Código de Transporte)
-- ============================================
-- Permite que o app mobile do motorista faça login
-- usando placa do veículo + código do frete.
-- A placa é normalizada (remove espaços, hífens, pontos)
-- para evitar erros de formatação.
--
-- Execute no SQL Editor do Supabase:
-- Dashboard > SQL Editor > New Query > Cole > Run
-- ============================================

-- Função para normalizar placa (remove hífens, espaços, pontos e converte para maiúscula)
CREATE OR REPLACE FUNCTION public.normalize_plate(p_plate TEXT)
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
  RETURN UPPER(TRIM(REGEXP_REPLACE(p_plate, '[\s\-\.]', '', 'g')));
END;
$$;

-- Função RPC para validar login do motorista
-- Recebe placa + freight_id e retorna dados da rota + motorista
CREATE OR REPLACE FUNCTION public.driver_login(p_plate TEXT, p_freight_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_route RECORD;
  v_driver RECORD;
  v_normalized_plate TEXT;
  v_result JSONB;
BEGIN
  v_normalized_plate := normalize_plate(p_plate);

  SELECT * INTO v_route
  FROM public.routes
  WHERE freight_id = p_freight_id
    AND normalize_plate(plate) = v_normalized_plate
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Placa ou código inválidos');
  END IF;

  SELECT id, name, phone, email, cnh, vehicle, plate, user_id
  INTO v_driver
  FROM public.drivers
  WHERE id = v_route.driver_id;

  v_result := jsonb_build_object(
    'success', true,
    'route', jsonb_build_object(
      'id', v_route.id,
      'freight_id', v_route.freight_id,
      'origin', v_route.origin,
      'origin_state', v_route.origin_state,
      'destination', v_route.destination,
      'destination_state', v_route.destination_state,
      'vehicle', v_route.vehicle,
      'plate', v_route.plate,
      'weight', v_route.weight,
      'estimated_delivery', v_route.estimated_delivery,
      'pickup_date', v_route.pickup_date,
      'status', v_route.status,
      'company_name', v_route.company_name
    ),
    'driver', CASE
      WHEN v_driver.id IS NOT NULL THEN jsonb_build_object(
        'id', v_driver.id,
        'name', v_driver.name,
        'phone', v_driver.phone,
        'email', v_driver.email,
        'cnh', v_driver.cnh,
        'vehicle', v_driver.vehicle,
        'plate', v_driver.plate
      )
      ELSE NULL
    END
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.driver_login(TEXT, BIGINT) IS
'Login do motorista via placa + código de frete. Normaliza a placa removendo hífens/espaços. Retorna dados da rota e motorista.';

-- Permitir acesso público (o app mobile usa anon key)
GRANT EXECUTE ON FUNCTION public.driver_login(TEXT, BIGINT) TO anon, authenticated;

-- ============================================
-- COMO USAR NO APP MOBILE (Supabase JS/Flutter/etc.)
-- ============================================
-- const { data, error } = await supabase
--   .rpc('driver_login', {
--     p_plate: 'ABC1234',
--     p_freight_id: 930682391
--   })
--
-- if (data?.success) {
--   // Login OK: data.route, data.driver
-- } else {
--   // Erro: data?.error ou 'Placa ou código inválidos'
-- }
-- ============================================
