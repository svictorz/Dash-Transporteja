-- Executar em transação de teste após a migração V2.
DO $$
DECLARE
  fleet jsonb := '[{"name":"Truck","payloadKg":14000,"volumeM3":48,"pricePerKm":8.50,"active":true}]';
  result jsonb;
BEGIN
  result := public.erp_calculate_fractional_truck_v2(
    '{"pesoKg":7000,"cubagemM3":10,"valorNota":10000,"marginPercent":25}'::jsonb,
    1000, fleet, 18, 0.2);
  IF result->>'status' <> 'CALCULADO'
     OR (result->>'preco_final')::numeric <> 6298.25
     OR (result #>> '{scenario,minimum}')::numeric <> 5038.60
     OR (result #>> '{memoria_interna,ocupacao_aplicada}')::numeric <> 0.5 THEN
    RAISE EXCEPTION 'Rateio por peso e composição falharam: %', result;
  END IF;

  result := public.erp_calculate_fractional_truck_v2(
    '{"pesoKg":1000,"cubagemM3":24,"linearMeters":100,"valorNota":0,"marginPercent":0}'::jsonb,
    1000, fleet, 0, 0);
  IF (result #>> '{memoria_interna,ocupacao_aplicada}')::numeric <> 0.55
     OR (result->>'preco_final')::numeric <> 4675 THEN
    RAISE EXCEPTION 'Rateio por volume falhou: %', result;
  END IF;

  result := public.erp_calculate_fractional_truck_v2(
    '{"pesoKg":1000,"cubagemM3":48,"valorNota":0,"marginPercent":0}'::jsonb,
    1000, fleet, 0, 0);
  IF result->>'status' <> 'NOT_ELIGIBLE_FRACTIONAL'
     OR result->'preco_final' <> 'null'::jsonb THEN
    RAISE EXCEPTION 'Excesso de cubagem deveria bloquear fracionado: %', result;
  END IF;

  BEGIN
    PERFORM public.erp_calculate_fractional_truck_v2(
      '{"pesoKg":1000,"valorNota":0,"marginPercent":0}'::jsonb,
      1000, fleet, 0, 0);
    RAISE EXCEPTION 'Cubagem ausente foi aceita';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'INVALID_VOLUME' THEN RAISE; END IF;
  END;
END $$;
