-- Run after the short-distance migration inside a transaction that rolls back.
DO $$
DECLARE
  fleet jsonb := '[{"name":"Truck","payloadKg":14000,"volumeM3":48,"pricePerKm":8.50,"active":true}]';
  draft jsonb := '{"pesoKg":3500,"cubagemM3":1,"valorNota":0}';
  result jsonb;
BEGIN
  -- Reproduction of the 98.9 km, 10 m3 example from the quote screen.
  result := public.erp_calculate_fractional_truck_v3(
    '{"pesoKg":1000,"cubagemM3":10,"valorNota":17892.21}',
    98.9, fleet, 18, 0.2, 25);
  IF (result->>'preco_final')::numeric <> 1836.94
     OR round((result #>> '{memoria_interna,ocupacao_aplicada}')::numeric * 100, 1) <> 22.9 THEN
    RAISE EXCEPTION '98.9 km / 10 m3 quote still stuck at the minimum: %', result;
  END IF;

  result := public.erp_calculate_fractional_truck_v3(draft, 50, fleet, 18, 0.2, 25);
  IF (result->>'preco_final')::numeric <> 1656.72
     OR (result #>> '{scenario,minimum}')::numeric <> 1656.72
     OR result->>'regra_id' <> 'FRACIONADO_JCN_V3_SHORT'
     OR result #> '{memoria_interna,piso_antt}' IS NOT NULL THEN
    RAISE EXCEPTION '50 km/internal tariff: %', result;
  END IF;

  result := public.erp_calculate_fractional_truck_v3(draft, 150, fleet, 18, 0.2, 25);
  IF (result->>'preco_final')::numeric <> 1970.16 THEN
    RAISE EXCEPTION '150 km should vary with distance: %', result;
  END IF;

  result := public.erp_calculate_fractional_truck_v3(draft, 300, fleet, 18, 0.2, 25);
  IF (result->>'preco_final')::numeric <> 2440.31 THEN
    RAISE EXCEPTION '300 km: %', result;
  END IF;

  result := public.erp_calculate_fractional_truck_v3(draft, 301, fleet, 18, 0.2, 25);
  IF (result->>'preco_final')::numeric <> 2440.31 THEN
    RAISE EXCEPTION 'Price must not fall at 300 km boundary: %', result;
  END IF;

  result := public.erp_calculate_fractional_truck_v3(draft, 1703, fleet, 18, 0.2, 25);
  IF (result->>'preco_final')::numeric < (result #>> '{scenario,minimum}')::numeric
     OR (result #>> '{scenario,minimum}')::numeric <> 2440.31 THEN
    RAISE EXCEPTION 'Long distance must use full internal trip cost: %', result;
  END IF;

  result := public.erp_calculate_fractional_truck_v3(draft, 150,
    '[{"name":"Truck","payloadKg":14000,"volumeM3":48,"pricePerKm":9.50,"active":true}]',
    18, 0.2, 25);
  IF (result->>'preco_final')::numeric <> 2025.47 THEN
    RAISE EXCEPTION 'Edited fleet tariff was ignored: %', result;
  END IF;

  result := public.erp_calculate_fractional_truck_v3(
    '{"pesoKg":7000,"cubagemM3":1,"valorNota":0}', 150, fleet, 18, 0.2, 25);
  IF (result->>'preco_final')::numeric <> 2440.31 THEN
    RAISE EXCEPTION 'Higher occupancy must raise the price: %', result;
  END IF;
END $$;
