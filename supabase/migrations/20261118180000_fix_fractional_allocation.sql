-- Fix: fractional truck calculation must use allocated_cost (fractionated),
-- not trip_cost (full trip). The occupancy reduction was being computed but
-- never applied to the final price, so fracionado was charging the full trip.

CREATE OR REPLACE FUNCTION public.erp_calculate_fractional_truck_v2(
  quote_draft jsonb, distance_km numeric, fleet jsonb,
  tax_percent numeric, insurance_percent numeric
) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp AS $$
DECLARE
  truck jsonb;
  weight_kg numeric;
  volume_m3 numeric;
  invoice numeric;
  margin_percent numeric;
  operational_volume numeric;
  occupancy numeric;
  trip_cost numeric;
  allocated_cost numeric;
  insurance_cost numeric;
  tax_cost numeric;
  minimum_value numeric;
  final_value numeric;
  memory jsonb;
BEGIN
  IF distance_km IS NULL OR distance_km <= 0 THEN RAISE EXCEPTION 'INVALID_DISTANCE'; END IF;
  weight_kg := NULLIF(quote_draft->>'pesoKg','')::numeric;
  volume_m3 := NULLIF(quote_draft->>'cubagemM3','')::numeric;
  invoice := COALESCE(NULLIF(quote_draft->>'valorNota','')::numeric,0);
  margin_percent := NULLIF(quote_draft->>'marginPercent','')::numeric;
  IF weight_kg IS NULL OR weight_kg <= 0 THEN RAISE EXCEPTION 'INVALID_WEIGHT'; END IF;
  IF volume_m3 IS NULL OR volume_m3 <= 0 THEN RAISE EXCEPTION 'INVALID_VOLUME'; END IF;
  IF invoice < 0 OR margin_percent IS NULL OR margin_percent < 0 OR margin_percent > 100
     OR tax_percent IS NULL OR tax_percent < 0 OR tax_percent > 100
     OR insurance_percent IS NULL OR insurance_percent < 0 OR insurance_percent > 100 THEN
    RAISE EXCEPTION 'COST_CONFIG_NOT_FOUND';
  END IF;
  truck := public.erp_validate_fractional_truck_v2(fleet);
  operational_volume := volume_m3 * 1.10;
  occupancy := greatest(weight_kg / (truck->>'payloadKg')::numeric,
    operational_volume / (truck->>'volumeM3')::numeric);
  memory := jsonb_build_object('peso_real_kg',weight_kg,'cubagem_informada_m3',volume_m3,
    'cubagem_operacional_m3',operational_volume,'ocupacao_peso',
    weight_kg / (truck->>'payloadKg')::numeric,'ocupacao_volume',
    operational_volume / (truck->>'volumeM3')::numeric,'ocupacao_aplicada',occupancy);
  IF occupancy > 1 THEN
    RETURN jsonb_build_object('status','NOT_ELIGIBLE_FRACTIONAL',
      'modalidade','FRACIONADO','veiculo_referencia','Truck',
      'regra_id','FRACIONADO_JCN_V2','preco_final',NULL,
      'memoria_interna',memory);
  END IF;
  trip_cost := distance_km * (truck->>'pricePerKm')::numeric;
  allocated_cost := trip_cost * occupancy;
  insurance_cost := invoice * insurance_percent / 100;
  tax_cost := (allocated_cost + insurance_cost) * tax_percent / 100;
  minimum_value := allocated_cost + insurance_cost + tax_cost;
  final_value := round(minimum_value * (1 + margin_percent / 100),2);
  memory := memory || jsonb_build_object('custo_viagem_truck',trip_cost,
    'custo_rateado',allocated_cost,'seguro_remessa',insurance_cost,
    'tributos',tax_cost,'preco_antes_margem',minimum_value);
  RETURN jsonb_build_object('status','CALCULADO','modalidade','FRACIONADO',
    'veiculo_referencia','Truck','regra_id','FRACIONADO_JCN_V2',
    'preco_final',final_value,
    'scenario',jsonb_build_object('floor',allocated_cost,'taxes',tax_cost,
      'insurance',insurance_cost,'pgr',0,'tolls',0,'collection',0,
      'minimum',round(minimum_value,2),'total',final_value,
      'occupancy_pct',round(occupancy * 100, 1)),
    'memoria_interna',memory);
END $$;
REVOKE ALL ON FUNCTION public.erp_calculate_fractional_truck_v2(jsonb,numeric,jsonb,numeric,numeric)
  FROM PUBLIC, anon, authenticated;
NOTIFY pgrst, 'reload schema';
