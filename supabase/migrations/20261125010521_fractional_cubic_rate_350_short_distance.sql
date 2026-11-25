-- Para rotas curtas, cobra pelo maior entre cubagem informada e peso cubado
-- (300 kg/m³), a R$ 350/m³. Mantém capacidade e fórmula de longa distância.
CREATE OR REPLACE FUNCTION public.erp_calculate_fractional_truck_v3(
  quote_draft jsonb, distance_km numeric, fleet jsonb,
  tax_percent numeric, insurance_percent numeric, margin_percent numeric
) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp AS $$
DECLARE
  truck jsonb;
  weight_kg numeric;
  volume_m3 numeric;
  invoice numeric;
  operational_volume numeric;
  occupancy numeric;
  trip_cost numeric;
  allocated_cost numeric;
  insurance_cost numeric;
  tax_cost numeric;
  short_minimum numeric;
  final_value numeric;
  chargeable_m3 numeric;
  short_base numeric;
  memory jsonb;
BEGIN
  IF distance_km IS NULL OR distance_km <= 0 THEN RAISE EXCEPTION 'INVALID_DISTANCE'; END IF;
  weight_kg := NULLIF(quote_draft->>'pesoKg','')::numeric;
  volume_m3 := NULLIF(quote_draft->>'cubagemM3','')::numeric;
  invoice := COALESCE(NULLIF(quote_draft->>'valorNota','')::numeric,0);
  IF weight_kg IS NULL OR weight_kg <= 0 THEN RAISE EXCEPTION 'INVALID_WEIGHT'; END IF;
  IF volume_m3 IS NULL OR volume_m3 <= 0 THEN RAISE EXCEPTION 'INVALID_VOLUME'; END IF;
  IF tax_percent IS NULL OR tax_percent < 0 OR tax_percent > 100
     OR insurance_percent IS NULL OR insurance_percent < 0 OR insurance_percent > 100
     OR margin_percent IS NULL OR margin_percent < 0 THEN
    RAISE EXCEPTION 'COST_CONFIG_NOT_FOUND';
  END IF;
  truck := public.erp_validate_fractional_truck_v2(fleet);
  operational_volume := volume_m3 * 1.10;
  occupancy := greatest(weight_kg / (truck->>'payloadKg')::numeric,
    operational_volume / (truck->>'volumeM3')::numeric);
  IF occupancy > 1 THEN
    RETURN jsonb_build_object('status','NOT_ELIGIBLE_FRACTIONAL',
      'modalidade','FRACIONADO','veiculo_referencia','Truck',
      'regra_id','FRACIONADO_JCN_V3_SHORT','preco_final',NULL,
      'memoria_interna',jsonb_build_object('ocupacao_aplicada',occupancy));
  END IF;

  insurance_cost := invoice * insurance_percent / 100;
  IF distance_km <= 300 THEN
    chargeable_m3 := greatest(volume_m3, weight_kg / 300);
    short_base := greatest(1500, round(chargeable_m3 * 350, 2));
    tax_cost := (short_base + insurance_cost) * tax_percent / 100;
    final_value := greatest(1500,
      round((short_base + insurance_cost + tax_cost) * (1 + margin_percent / 100), 2));
    short_minimum := greatest(1500,
      round((short_base + insurance_cost + tax_cost) * (1 + margin_percent / 100), 2));
    trip_cost := distance_km * (truck->>'pricePerKm')::numeric;
    allocated_cost := short_base;
  ELSE
    trip_cost := distance_km * (truck->>'pricePerKm')::numeric;
    allocated_cost := trip_cost * occupancy;
    tax_cost := (allocated_cost + insurance_cost) * tax_percent / 100;
    short_minimum := round(1500 + (300 * (truck->>'pricePerKm')::numeric * occupancy + insurance_cost) *
      (1 + tax_percent / 100) * (1 + margin_percent / 100), 2);
    final_value := greatest(short_minimum,
      round((allocated_cost + insurance_cost + tax_cost) * (1 + margin_percent / 100), 2));
    chargeable_m3 := greatest(volume_m3, weight_kg / 300);
  END IF;

  memory := jsonb_build_object('peso_real_kg',weight_kg,'cubagem_informada_m3',volume_m3,
    'cubagem_operacional_m3',operational_volume,'cubagem_peso_kg_m3',weight_kg / 300,
    'volume_cobravel_m3',chargeable_m3,'tarifa_cubagem_m3',CASE WHEN distance_km <= 300 THEN 350 ELSE NULL END,
    'ocupacao_peso',weight_kg / (truck->>'payloadKg')::numeric,'ocupacao_volume',
    operational_volume / (truck->>'volumeM3')::numeric,'ocupacao_aplicada',occupancy,
    'custo_viagem_truck',trip_cost,'custo_rateado',allocated_cost,
    'seguro_remessa',insurance_cost,'tributos',tax_cost,
    'preco_antes_margem',allocated_cost + insurance_cost + tax_cost,
    'piso_curta_distancia',short_minimum);
  RETURN jsonb_build_object('status','CALCULADO','modalidade','FRACIONADO',
    'veiculo_referencia','Truck','regra_id','FRACIONADO_JCN_V3_SHORT',
    'preco_final',final_value,
    'scenario',jsonb_build_object('floor',allocated_cost,'taxes',tax_cost,
      'insurance',insurance_cost,'pgr',0,'tolls',0,'collection',0,
      'minimum',short_minimum,'total',final_value),
    'memoria_interna',memory);
END $$;
REVOKE ALL ON FUNCTION public.erp_calculate_fractional_truck_v3(jsonb,numeric,jsonb,numeric,numeric,numeric)
  FROM PUBLIC, anon, authenticated;
NOTIFY pgrst, 'reload schema';
