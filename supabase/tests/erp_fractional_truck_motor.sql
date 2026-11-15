-- Execute em banco de desenvolvimento após 20261115120000_fractional_truck_motor.sql.
DO $$
DECLARE
  config jsonb := '{"linear_capacity_m":10,"volumetric_factor_kg_m3":50,"fixed_trip_cost":100,"additional_trip_cost":50,"minimum_freight":0}'::jsonb;
  fleet jsonb := '[{"name":"Truck","payloadKg":1000,"volumeM3":10,"pricePerKm":2,"active":true}]'::jsonb;
  result jsonb;
  changed jsonb;
BEGIN
  -- Peso domina: custo viagem 350; custo rateado 210; seguro 10; impostos 22; markup 20%.
  result := public.erp_calculate_fractional_truck(
    '{"pesoKg":600,"cubagemM3":1,"valorNota":1000,"marginPercent":20}'::jsonb,
    100,config,fleet,10,1);
  IF result->>'status' <> 'CALCULADO' OR (result->>'preco_final')::numeric <> 290.40
     OR (result #>> '{memoria_interna,ocupacao_aplicada}')::numeric <> 0.6 THEN
    RAISE EXCEPTION 'Cenário peso falhou: %',result;
  END IF;

  -- Volume operacional 5,5 m³ domina; cubagem declarada permanece 5 m³.
  result := public.erp_calculate_fractional_truck(
    '{"pesoKg":100,"cubagemM3":5,"valorNota":1000,"marginPercent":0}'::jsonb,
    100,config,fleet,0,0);
  IF (result #>> '{memoria_interna,cubagem_operacional_m3}')::numeric <> 5.5
     OR (result #>> '{memoria_interna,ocupacao_aplicada}')::numeric <> 0.55
     OR (result #>> '{memoria_interna,cubagem_informada_m3}')::numeric <> 5 THEN
    RAISE EXCEPTION 'Cenário volume falhou: %',result;
  END IF;

  -- Linear domina; seguro só entra depois do rateio.
  result := public.erp_calculate_fractional_truck(
    '{"pesoKg":100,"cubagemM3":1,"linearMeters":8,"valorNota":1000,"marginPercent":0}'::jsonb,
    100,config,fleet,0,1);
  IF (result #>> '{memoria_interna,ocupacao_aplicada}')::numeric <> 0.8
     OR (result #>> '{memoria_interna,custo_rateado}')::numeric <> 280
     OR (result #>> '{memoria_interna,custo_remessa}')::numeric <> 10 THEN
    RAISE EXCEPTION 'Cenário linear falhou: %',result;
  END IF;

  -- Peso cubado supera o real e passa a ocupar o Truck.
  changed := jsonb_set(config,'{volumetric_factor_kg_m3}','200'::jsonb);
  changed := jsonb_set(changed,'{minimum_freight}','500'::jsonb);
  result := public.erp_calculate_fractional_truck(
    '{"pesoKg":100,"cubagemM3":2,"valorNota":1000,"marginPercent":0}'::jsonb,
    100,changed,fleet,0,0);
  IF (result #>> '{memoria_interna,peso_tarifavel_kg}')::numeric <> 440
     OR (result #>> '{scenario,total}')::numeric <> 500
     OR (result #>> '{memoria_interna,frete_minimo_aplicado}')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Cenário cubagem/mínimo falhou: %',result;
  END IF;

  -- Excesso de capacidade nunca é limitado silenciosamente a 100%.
  result := public.erp_calculate_fractional_truck(
    '{"pesoKg":100,"cubagemM3":10,"valorNota":1000,"marginPercent":0}'::jsonb,
    100,config,fleet,0,0);
  IF result->>'status' <> 'NOT_ELIGIBLE_FRACTIONAL' OR result->'preco_final' <> 'null'::jsonb
     OR (result #>> '{memoria_interna,ocupacao_aplicada}')::numeric <= 1 THEN
    RAISE EXCEPTION 'Cenário não elegível falhou: %',result;
  END IF;

  -- Mesmos dados e mesma configuração devem produzir exatamente o mesmo JSON.
  IF result IS DISTINCT FROM public.erp_calculate_fractional_truck(
    '{"pesoKg":100,"cubagemM3":10,"valorNota":1000,"marginPercent":0}'::jsonb,
    100,config,fleet,0,0) THEN RAISE EXCEPTION 'Cálculo não determinístico'; END IF;
END $$;
