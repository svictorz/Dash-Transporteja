-- Run after the short-distance migration inside a transaction that rolls back.
DO $$
DECLARE
  fleet jsonb := '[{"name":"Truck","payloadKg":14000,"volumeM3":48,"pricePerKm":8.50,"active":true}]';
  draft jsonb := '{"pesoKg":3500,"cubagemM3":1,"valorNota":0}';
  result jsonb;
BEGIN
  -- Up to 300 km, charge the greater of entered cubic volume and weight / 300
  -- at R$ 350/m3, then add insurance, taxes and margin.
  result := public.erp_calculate_fractional_truck_v3(
    '{"pesoKg":1000,"cubagemM3":10,"valorNota":17892.21}',
    98.9, fleet, 18, 0.2, 25);
  IF (result->>'preco_final')::numeric <> 5215.28
     OR (result #>> '{scenario,floor}')::numeric <> 3500
     OR (result #>> '{memoria_interna,volume_cobravel_m3}')::numeric <> 10
     OR (result #>> '{memoria_interna,tarifa_cubagem_m3}')::numeric <> 350
     OR round((result #>> '{memoria_interna,ocupacao_aplicada}')::numeric * 100, 1) <> 22.9 THEN
    RAISE EXCEPTION '98.9 km / 10 m3 quote did not use R$350/m3: %', result;
  END IF;

  result := public.erp_calculate_fractional_truck_v3(draft, 50, fleet, 18, 0.2, 25);
  IF (result->>'preco_final')::numeric <> 6022.91
     OR (result #>> '{scenario,floor}')::numeric <> 4083.33
     OR (result #>> '{memoria_interna,volume_cobravel_m3}')::numeric <> 11.6666666666666667
     OR result->>'regra_id' <> 'FRACIONADO_JCN_V3_SHORT'
     OR result #> '{memoria_interna,piso_antt}' IS NOT NULL THEN
    RAISE EXCEPTION '50 km/weight cubed at 300 kg per m3: %', result;
  END IF;

  result := public.erp_calculate_fractional_truck_v3(draft, 150, fleet, 18, 0.2, 25);
  IF (result->>'preco_final')::numeric <> 6022.91 THEN
    RAISE EXCEPTION '150 km uses the same R$350/m3 short-distance tariff: %', result;
  END IF;

  result := public.erp_calculate_fractional_truck_v3(draft, 300, fleet, 18, 0.2, 25);
  IF (result->>'preco_final')::numeric <> 6022.91 THEN
    RAISE EXCEPTION '300 km must still use the R$350/m3 tariff: %', result;
  END IF;

  result := public.erp_calculate_fractional_truck_v3(draft, 301, fleet, 18, 0.2, 25);
  IF (result->>'preco_final')::numeric <> 2440.31 THEN
    RAISE EXCEPTION '301 km must keep the existing Truck km and occupancy rule: %', result;
  END IF;

  result := public.erp_calculate_fractional_truck_v3(draft, 1703, fleet, 18, 0.2, 25);
  IF (result->>'preco_final')::numeric < (result #>> '{scenario,minimum}')::numeric
     OR (result #>> '{scenario,minimum}')::numeric <> 2440.31
     OR (result->>'preco_final')::numeric <> 5337.84 THEN
    RAISE EXCEPTION 'Long distance must use full internal trip cost: %', result;
  END IF;

  result := public.erp_calculate_fractional_truck_v3(draft, 150,
    '[{"name":"Truck","payloadKg":14000,"volumeM3":48,"pricePerKm":9.50,"active":true}]',
    18, 0.2, 25);
  IF (result->>'preco_final')::numeric <> 6022.91 THEN
    RAISE EXCEPTION 'Short-distance cubic rate should not depend on the Truck km tariff: %', result;
  END IF;

  result := public.erp_calculate_fractional_truck_v3(draft, 1000,
    '[{"name":"Truck","payloadKg":14000,"volumeM3":48,"pricePerKm":9.50,"active":true}]',
    18, 0.2, 25);
  IF (result->>'preco_final')::numeric <> 3503.13 THEN
    RAISE EXCEPTION 'Long-distance calculation must continue using the edited Truck km tariff: %', result;
  END IF;

  result := public.erp_calculate_fractional_truck_v3(
    '{"pesoKg":7000,"cubagemM3":1,"valorNota":0}', 150, fleet, 18, 0.2, 25);
  IF (result->>'preco_final')::numeric <> 12045.84 THEN
    RAISE EXCEPTION 'Higher occupancy must raise the price: %', result;
  END IF;
END $$;
