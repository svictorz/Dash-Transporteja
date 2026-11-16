-- Executar em uma transação após a migração do piso comercial.
DO $$
DECLARE
  fleet jsonb := '[{"name":"Truck","payloadKg":14000,"volumeM3":48,"pricePerKm":8.50,"active":true}]';
  result jsonb;
BEGIN
  result := public.erp_calculate_fractional_truck_v2(
    '{"pesoKg":1000,"cubagemM3":2,"valorNota":1000,"marginPercent":25}'::jsonb,
    100, fleet, 18, 0.2);
  IF (result #>> '{scenario,total}')::numeric <> 1500
     OR (result #>> '{scenario,minimum}')::numeric <> 1500 THEN
    RAISE EXCEPTION 'Piso de R$ 1.500 não aplicado: %', result;
  END IF;

  result := public.erp_calculate_fractional_truck_v2(
    '{"pesoKg":7000,"cubagemM3":10,"valorNota":10000,"marginPercent":25}'::jsonb,
    1000, fleet, 18, 0.2);
  IF (result #>> '{scenario,total}')::numeric <> 6298.25
     OR (result #>> '{scenario,minimum}')::numeric <> 1500 THEN
    RAISE EXCEPTION 'Preço acima do piso foi alterado: %', result;
  END IF;

  BEGIN
    PERFORM public.erp_calculate_fractional_truck_v2(
      '{"pesoKg":1000,"valorNota":1000,"marginPercent":25}'::jsonb,
      100, fleet, 18, 0.2);
    RAISE EXCEPTION 'Cubagem ausente foi aceita';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'INVALID_VOLUME' THEN RAISE; END IF;
  END;
END $$;

-- Exercita também a RPC completa com uma cotação temporariamente ajustada.
DO $$
DECLARE
  quote_id uuid;
  quote_owner uuid;
  result public.erp_quote_analyses;
BEGIN
  SELECT id, owner_id INTO quote_id, quote_owner FROM public.erp_quotes LIMIT 1;
  IF quote_id IS NULL THEN
    RAISE NOTICE 'Sem cotação existente para teste da RPC';
    RETURN;
  END IF;
  PERFORM set_config('request.jwt.claim.sub',quote_owner::text,true);
  UPDATE public.erp_quotes SET
    draft = (draft - 'selectedVehicleName') ||
      '{"pesoKg":1000,"cubagemM3":2,"valorNota":1000,"marginPercent":25}'::jsonb,
    distance_km = 100
    WHERE id = quote_id;
  SELECT * INTO result FROM public.erp_analyze_quote(quote_id);
  IF (result.result #>> '{fracionado,total}')::numeric <> 1500
     OR (result.result #>> '{dedicado,total}')::numeric <> 1500
     OR (result.result #>> '{fracionado,minimum}')::numeric <> 1500
     OR (result.result #>> '{dedicado,minimum}')::numeric <> 1500 THEN
    RAISE EXCEPTION 'Piso não aplicado nas duas modalidades: %', result.result;
  END IF;

  UPDATE public.erp_quotes SET draft = jsonb_set(draft,'{cubagemM3}','null'::jsonb)
    WHERE id = quote_id;
  BEGIN
    PERFORM public.erp_analyze_quote(quote_id);
    RAISE EXCEPTION 'RPC aceitou cubagem ausente';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'INVALID_VOLUME' THEN RAISE; END IF;
  END;
END $$;
