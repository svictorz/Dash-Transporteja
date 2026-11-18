-- Motor fracionado JCN V1. Sem backfill: análises existentes permanecem intactas.
CREATE TABLE public.erp_fractional_truck_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config jsonb NOT NULL,
  fleet jsonb NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.erp_fractional_truck_active (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  revision_id uuid NOT NULL REFERENCES public.erp_fractional_truck_revisions(id)
);
ALTER TABLE public.erp_fractional_truck_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_fractional_truck_active ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.erp_fractional_truck_revisions, public.erp_fractional_truck_active FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.erp_fractional_truck_revisions, public.erp_fractional_truck_active TO authenticated;
CREATE POLICY erp_fractional_revisions_admin_read ON public.erp_fractional_truck_revisions
  FOR SELECT TO authenticated USING ((SELECT public.current_user_has_any_role(ARRAY['admin']::text[])));
CREATE POLICY erp_fractional_active_admin_read ON public.erp_fractional_truck_active
  FOR SELECT TO authenticated USING ((SELECT public.current_user_has_any_role(ARRAY['admin']::text[])));

CREATE FUNCTION public.erp_fractional_revisions_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'Revisão do Truck é imutável';
END $$;
CREATE TRIGGER erp_fractional_revisions_immutable BEFORE UPDATE OR DELETE
  ON public.erp_fractional_truck_revisions FOR EACH ROW EXECUTE FUNCTION public.erp_fractional_revisions_immutable();

-- A configuração é deliberadamente obrigatória; não há números substitutos no motor.
CREATE FUNCTION public.erp_validate_fractional_truck_config(config jsonb, fleet jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp AS $$
DECLARE truck jsonb;
BEGIN
  IF config IS NULL OR jsonb_typeof(config) <> 'object'
     OR NOT (config ?& ARRAY['linear_capacity_m','volumetric_factor_kg_m3','fixed_trip_cost','additional_trip_cost','minimum_freight']) THEN
    RAISE EXCEPTION 'COST_CONFIG_NOT_FOUND';
  END IF;
  IF fleet IS NULL OR jsonb_typeof(fleet) <> 'array' THEN RAISE EXCEPTION 'TRUCK_CONFIG_NOT_FOUND'; END IF;
  SELECT item.value INTO truck FROM jsonb_array_elements(fleet) item(value)
    WHERE item.value->>'name' = 'Truck' LIMIT 1;
  IF truck IS NULL OR truck->>'active' = 'false' THEN RAISE EXCEPTION 'TRUCK_CONFIG_NOT_FOUND'; END IF;
  IF truck->>'payloadKg' IS NULL OR truck->>'volumeM3' IS NULL OR truck->>'pricePerKm' IS NULL
     OR EXISTS (SELECT 1 FROM jsonb_each(config) item WHERE item.key = ANY(ARRAY[
       'linear_capacity_m','volumetric_factor_kg_m3','fixed_trip_cost','additional_trip_cost','minimum_freight'])
       AND jsonb_typeof(item.value) <> 'number') THEN
    RAISE EXCEPTION 'COST_CONFIG_NOT_FOUND';
  END IF;
  IF (truck->>'payloadKg')::numeric <= 0 OR (truck->>'volumeM3')::numeric <= 0
     OR (config->>'linear_capacity_m')::numeric <= 0 OR (config->>'volumetric_factor_kg_m3')::numeric <= 0 THEN
    RAISE EXCEPTION 'INVALID_TRUCK_CAPACITY';
  END IF;
  IF (truck->>'pricePerKm')::numeric <= 0 OR (config->>'fixed_trip_cost')::numeric < 0
     OR (config->>'additional_trip_cost')::numeric < 0 OR (config->>'minimum_freight')::numeric < 0 THEN
    RAISE EXCEPTION 'COST_CONFIG_NOT_FOUND';
  END IF;
  RETURN truck;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
  RAISE EXCEPTION 'COST_CONFIG_NOT_FOUND';
END $$;
REVOKE ALL ON FUNCTION public.erp_validate_fractional_truck_config(jsonb,jsonb) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.erp_publish_fractional_truck(config jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE fleet jsonb; truck jsonb; revision uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_has_any_role(ARRAY['admin']::text[]) THEN
    RAISE EXCEPTION 'Administrador obrigatório';
  END IF;
  SELECT vehicles INTO fleet FROM public.erp_fleet_settings WHERE id = 1 FOR UPDATE;
  truck := public.erp_validate_fractional_truck_config(config, fleet);
  fleet := jsonb_build_array(jsonb_build_object('name','Truck','payloadKg',truck->'payloadKg',
    'volumeM3',truck->'volumeM3','pricePerKm',truck->'pricePerKm','active',
    COALESCE(truck->'active','true'::jsonb)));
  INSERT INTO public.erp_fractional_truck_revisions(config,fleet,created_by)
    VALUES (config,fleet,auth.uid()) RETURNING id INTO revision;
  INSERT INTO public.erp_fractional_truck_active(id,revision_id) VALUES (1,revision)
    ON CONFLICT (id) DO UPDATE SET revision_id = EXCLUDED.revision_id;
  RETURN revision;
END $$;
REVOKE ALL ON FUNCTION public.erp_publish_fractional_truck(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.erp_publish_fractional_truck(jsonb) TO authenticated;

-- A publicação de alterações na frota gera nova revisão com os mesmos parâmetros.
CREATE FUNCTION public.erp_revise_fractional_truck_after_fleet() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE prior_config jsonb; truck jsonb; revision uuid;
BEGIN
  SELECT r.config INTO prior_config FROM public.erp_fractional_truck_active a
    JOIN public.erp_fractional_truck_revisions r ON r.id = a.revision_id WHERE a.id = 1;
  IF prior_config IS NULL THEN RETURN NEW; END IF;
  truck := public.erp_validate_fractional_truck_config(prior_config, NEW.vehicles);
  INSERT INTO public.erp_fractional_truck_revisions(config,fleet,created_by)
    VALUES (prior_config, jsonb_build_array(jsonb_build_object('name','Truck',
      'payloadKg',truck->'payloadKg','volumeM3',truck->'volumeM3',
      'pricePerKm',truck->'pricePerKm','active',COALESCE(truck->'active','true'::jsonb))),
      NEW.updated_by) RETURNING id INTO revision;
  UPDATE public.erp_fractional_truck_active SET revision_id = revision WHERE id = 1;
  RETURN NEW;
END $$;
CREATE TRIGGER erp_revise_fractional_truck_after_fleet AFTER UPDATE OF vehicles
  ON public.erp_fleet_settings FOR EACH ROW
  WHEN (OLD.vehicles IS DISTINCT FROM NEW.vehicles)
  EXECUTE FUNCTION public.erp_revise_fractional_truck_after_fleet();

CREATE FUNCTION public.erp_calculate_fractional_truck(
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
REVOKE ALL ON FUNCTION public.erp_calculate_fractional_truck(jsonb,numeric,jsonb,jsonb,numeric,numeric)
  FROM PUBLIC, anon, authenticated;

-- Mantém o dedicado e o caminho legado até a primeira publicação da revisão V1.
CREATE OR REPLACE FUNCTION public.erp_analyze_quote(target_quote uuid)
RETURNS public.erp_quote_analyses
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  q public.erp_quotes;
  settings public.erp_quote_settings;
  fleet jsonb;
  selected_vehicle jsonb;
  requested_vehicle_name text;
  fractional_revision public.erp_fractional_truck_revisions;
  fractional_output jsonb;
  fractional_scenario jsonb;
  dedicated_scenario jsonb;
  result public.erp_quote_analyses;
  km numeric;
  invoice numeric;
  weight_kg numeric;
  volume_m3 numeric;
  margin_rate numeric;
  base_value numeric;
  tax_value numeric;
  insurance_value numeric;
  rules jsonb;
  snapshot jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão obrigatória'; END IF;
  SELECT * INTO q FROM public.erp_quotes WHERE id = target_quote;
  IF NOT FOUND OR q.owner_id <> auth.uid() OR q.distance_km IS NULL THEN
    RAISE EXCEPTION 'Cotação ou distância indisponível';
  END IF;
  SELECT * INTO settings FROM public.erp_quote_settings WHERE id = 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Configure tributos e seguro antes de analisar'; END IF;
  SELECT vehicles INTO fleet FROM public.erp_fleet_settings WHERE id = 1;
  IF fleet IS NULL THEN RAISE EXCEPTION 'Configure a frota antes de analisar'; END IF;

  km := q.distance_km;
  invoice := COALESCE(NULLIF(q.draft->>'valorNota','')::numeric,0);
  weight_kg := COALESCE(NULLIF(q.draft->>'pesoKg','')::numeric,0);
  volume_m3 := COALESCE(NULLIF(q.draft->>'cubagemM3','')::numeric,0);
  margin_rate := NULLIF(q.draft->>'marginPercent','')::numeric;
  requested_vehicle_name := NULLIF(btrim(q.draft->>'selectedVehicleName'),'');
  IF invoice < 0 OR weight_kg < 0 OR volume_m3 < 0 OR margin_rate IS NULL
     OR margin_rate < 0 OR margin_rate > 100 THEN
    RAISE EXCEPTION 'Confira nota fiscal, carga e margem de lucro (0 a 100%%)';
  END IF;
  SELECT v.value INTO selected_vehicle FROM jsonb_array_elements(fleet) v(value)
    WHERE (v.value->>'payloadKg')::numeric >= weight_kg
      AND (v.value->>'volumeM3')::numeric >= volume_m3
      AND (requested_vehicle_name IS NULL OR v.value->>'name' = requested_vehicle_name)
    ORDER BY (v.value->>'payloadKg')::numeric, (v.value->>'volumeM3')::numeric LIMIT 1;
  IF selected_vehicle IS NULL THEN
    RAISE EXCEPTION 'Nenhum veículo comporta o peso e a cubagem';
  END IF;
  IF (selected_vehicle->>'pricePerKm')::numeric <= 0 THEN
    RAISE EXCEPTION 'Valor por km do veículo inválido';
  END IF;

  base_value := round(km * (selected_vehicle->>'pricePerKm')::numeric,2);
  tax_value := round(base_value * settings.tax_percent / 100,2);
  insurance_value := round(invoice * settings.insurance_percent / 100,2);
  dedicated_scenario := jsonb_build_object('floor',base_value,'taxes',tax_value,
    'insurance',insurance_value,'pgr',0,'tolls',0,'collection',0,
    'total',round((base_value + tax_value + insurance_value) * (1 + margin_rate / 100),2));
  rules := jsonb_build_object('vehicles',fleet,'tax_percent',settings.tax_percent,
    'insurance_percent',settings.insurance_percent,'driver_max_percent',settings.driver_max_percent,
    'margin_percent',margin_rate,'selected_vehicle',selected_vehicle->>'name');
  snapshot := jsonb_build_object('rules',rules,'draft',q.draft,'distance_km',km,
    'distance_source',q.distance_source);

  SELECT r.* INTO fractional_revision FROM public.erp_fractional_truck_active a
    JOIN public.erp_fractional_truck_revisions r ON r.id = a.revision_id WHERE a.id = 1;
  IF FOUND THEN
    IF volume_m3 <= 0 THEN
      fractional_output := jsonb_build_object('status','INVALID_VOLUME','memoria_interna',NULL);
    ELSE
      fractional_output := public.erp_calculate_fractional_truck(q.draft,km,
        fractional_revision.config,fractional_revision.fleet,settings.tax_percent,settings.insurance_percent);
    END IF;
    fractional_scenario := COALESCE(fractional_output->'scenario',
      jsonb_build_object('status',fractional_output->>'status','total',NULL,'floor',NULL,
        'taxes',NULL,'insurance',NULL,'pgr',0,'tolls',0,'collection',0,'minimum',NULL));
    fractional_scenario := fractional_scenario || jsonb_build_object(
      'status',fractional_output->>'status','modalidade','FRACIONADO',
      'regra_id','FRACIONADO_JCN_V1','configuracao_id',fractional_revision.id);
    snapshot := jsonb_set(snapshot,'{rules}',rules || jsonb_build_object(
      'fractional_config_id',fractional_revision.id,'fractional_rule_id','FRACIONADO_JCN_V1',
      'fractional_vehicle','Truck')) || jsonb_build_object('fractional_internal',
      fractional_output->'memoria_interna','fractional_status',fractional_output->>'status');
  ELSE
    fractional_scenario := dedicated_scenario;
  END IF;

  INSERT INTO public.erp_quote_analyses(quote_id,created_by,pricing_revision_id,snapshot,result)
  VALUES (q.id,auth.uid(),NULL,snapshot,
    jsonb_build_object('fracionado',fractional_scenario,'dedicado',dedicated_scenario))
  RETURNING * INTO result;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.erp_analyze_quote(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.erp_analyze_quote(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.erp_revise_fractional_truck_after_fleet() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.erp_fractional_revisions_immutable() FROM PUBLIC, anon, authenticated;
NOTIFY pgrst, 'reload schema';
