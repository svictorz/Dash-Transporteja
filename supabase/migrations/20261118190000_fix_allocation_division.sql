-- Fix: allocated_cost must divide trip_cost by occupancy, not multiply.
-- trip_cost is the cost per client (already rateado). Dividing gives the full trip cost,
-- then that full cost flows through insurance, taxes and margin correctly.
-- This applies to both V1 (erp_calculate_fractional_truck) and V2 (erp_calculate_fractional_truck_v2).

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
  allocated_cost := trip_cost / nullif(occupancy, 0);
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
      'minimum',round(minimum_value,2),'total',final_value),
    'memoria_interna',memory);
END $$;

-- Also fix V1 function
CREATE OR REPLACE FUNCTION public.erp_calculate_fractional_truck(
  quote_draft jsonb, distance_km numeric, config jsonb, fleet jsonb,
  tax_percent numeric, insurance_percent numeric
) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp AS $$
DECLARE
  truck jsonb;
  weight_kg numeric;
  volume_m3 numeric;
  linear_m numeric;
  invoice numeric;
  margin_percent numeric;
  operational_volume numeric;
  cubed_weight numeric;
  chargeable_weight numeric;
  occupancy_weight numeric;
  occupancy_volume numeric;
  occupancy_linear numeric;
  occupancy numeric;
  trip_cost numeric;
  allocated_cost numeric;
  shipment_extras numeric;
  insurance_cost numeric;
  shipment_cost numeric;
  base_cost numeric;
  taxes numeric;
  before_minimum numeric;
  minimum_value numeric;
  memory jsonb;
BEGIN
  IF distance_km IS NULL OR distance_km <= 0 THEN RAISE EXCEPTION 'INVALID_DISTANCE'; END IF;
  weight_kg := NULLIF(quote_draft->>'pesoKg','')::numeric;
  volume_m3 := NULLIF(quote_draft->>'cubagemM3','')::numeric;
  linear_m := COALESCE(NULLIF(quote_draft->>'linearMeters','')::numeric, 0);
  invoice := COALESCE(NULLIF(quote_draft->>'valorNota','')::numeric, 0);
  margin_percent := NULLIF(quote_draft->>'marginPercent','')::numeric;
  IF weight_kg IS NULL OR weight_kg <= 0 THEN RAISE EXCEPTION 'INVALID_WEIGHT'; END IF;
  IF volume_m3 IS NULL OR volume_m3 <= 0 THEN RAISE EXCEPTION 'INVALID_VOLUME'; END IF;
  IF linear_m < 0 OR invoice < 0 OR margin_percent IS NULL OR margin_percent < 0 OR margin_percent > 100
     OR tax_percent IS NULL OR tax_percent < 0 OR tax_percent > 100
     OR insurance_percent IS NULL OR insurance_percent < 0 OR insurance_percent > 100 THEN
    RAISE EXCEPTION 'COST_CONFIG_NOT_FOUND';
  END IF;
  truck := public.erp_validate_fractional_truck_config(config, fleet);
  operational_volume := volume_m3 * 1.10;
  cubed_weight := operational_volume * (config->>'volumetric_factor_kg_m3')::numeric;
  chargeable_weight := greatest(weight_kg, cubed_weight);
  occupancy_weight := chargeable_weight / (truck->>'payloadKg')::numeric;
  occupancy_volume := operational_volume / (truck->>'volumeM3')::numeric;
  occupancy_linear := linear_m / (config->>'linear_capacity_m')::numeric;
  occupancy := greatest(occupancy_weight, occupancy_volume, occupancy_linear);
  memory := jsonb_build_object('cubagem_informada_m3',volume_m3,'cubagem_operacional_m3',operational_volume,
    'peso_real_kg',weight_kg,'peso_cubado_kg',cubed_weight,'peso_tarifavel_kg',chargeable_weight,
    'ocupacao_peso',occupancy_weight,'ocupacao_volume',occupancy_volume,'ocupacao_linear',occupancy_linear,
    'ocupacao_aplicada',occupancy);
  IF occupancy > 1 THEN
    RETURN jsonb_build_object('status','NOT_ELIGIBLE_FRACTIONAL','modalidade','FRACIONADO',
      'veiculo_referencia','TRUCK','regra_id','FRACIONADO_JCN_V1','preco_final',NULL,
      'memoria_interna',memory,'motivo_rejeicao','Capacidade do Truck excedida');
  END IF;
  trip_cost := (config->>'fixed_trip_cost')::numeric + distance_km * (truck->>'pricePerKm')::numeric
    + (config->>'additional_trip_cost')::numeric;
  allocated_cost := trip_cost / nullif(occupancy, 0);
  IF COALESCE(NULLIF(quote_draft->>'collectionCost','')::numeric,0) < 0
     OR COALESCE(NULLIF(quote_draft->>'deliveryCost','')::numeric,0) < 0
     OR COALESCE(NULLIF(quote_draft->>'handlingCost','')::numeric,0) < 0
     OR COALESCE(NULLIF(quote_draft->>'otherShipmentCost','')::numeric,0) < 0 THEN
    RAISE EXCEPTION 'COST_CONFIG_NOT_FOUND';
  END IF;
  shipment_extras := COALESCE(NULLIF(quote_draft->>'collectionCost','')::numeric,0)
    + COALESCE(NULLIF(quote_draft->>'deliveryCost','')::numeric,0)
    + COALESCE(NULLIF(quote_draft->>'handlingCost','')::numeric,0)
    + COALESCE(NULLIF(quote_draft->>'otherShipmentCost','')::numeric,0);
  IF shipment_extras < 0 THEN RAISE EXCEPTION 'COST_CONFIG_NOT_FOUND'; END IF;
  insurance_cost := invoice * insurance_percent / 100;
  shipment_cost := shipment_extras + insurance_cost;
  base_cost := allocated_cost + shipment_extras;
  taxes := (base_cost + insurance_cost) * tax_percent / 100;
  before_minimum := (base_cost + insurance_cost + taxes) * (1 + margin_percent / 100);
  minimum_value := (config->>'minimum_freight')::numeric;
  memory := memory || jsonb_build_object('custo_viagem_truck',trip_cost,'custo_rateado',allocated_cost,
    'custo_remessa',shipment_cost,'preco_antes_minimo',before_minimum,
    'frete_minimo_aplicado',before_minimum < minimum_value);
  RETURN jsonb_build_object('status','CALCULADO','modalidade','FRACIONADO',
    'veiculo_referencia','TRUCK','regra_id','FRACIONADO_JCN_V1',
    'preco_final',round(greatest(before_minimum,minimum_value),2),
    'scenario',jsonb_build_object('floor',base_cost,'taxes',taxes,'insurance',insurance_cost,
    'pgr',0,'tolls',0,'collection',0,
      'minimum',minimum_value,'total',round(greatest(before_minimum,minimum_value),2)),
    'memoria_interna',memory);
END $$;

REVOKE ALL ON FUNCTION public.erp_calculate_fractional_truck_v2(jsonb,numeric,jsonb,numeric,numeric)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.erp_calculate_fractional_truck_v2(jsonb,numeric,jsonb,numeric,numeric)
  TO authenticated;

REVOKE ALL ON FUNCTION public.erp_calculate_fractional_truck(jsonb,numeric,jsonb,jsonb,numeric,numeric)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.erp_calculate_fractional_truck(jsonb,numeric,jsonb,jsonb,numeric,numeric)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
