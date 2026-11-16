-- Regra V2 aprovada: Truck, capacidade de 14.000 kg e 48 m3, R$ 8,50/km.
-- Somente análises futuras usam esta revisão; resultados anteriores não são alterados.
CREATE FUNCTION public.erp_validate_fractional_truck_v2(fleet jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp AS $$
DECLARE truck jsonb;
BEGIN
  IF fleet IS NULL OR jsonb_typeof(fleet) <> 'array' THEN
    RAISE EXCEPTION 'TRUCK_CONFIG_NOT_FOUND';
  END IF;
  SELECT item.value INTO truck FROM jsonb_array_elements(fleet) item(value)
    WHERE item.value->>'name' = 'Truck' LIMIT 1;
  IF truck IS NULL OR truck->>'active' = 'false' THEN
    RAISE EXCEPTION 'TRUCK_CONFIG_NOT_FOUND';
  END IF;
  IF COALESCE((truck->>'payloadKg')::numeric,0) <= 0
     OR COALESCE((truck->>'volumeM3')::numeric,0) <= 0
     OR COALESCE((truck->>'pricePerKm')::numeric,0) <= 0 THEN
    RAISE EXCEPTION 'INVALID_TRUCK_CAPACITY';
  END IF;
  RETURN truck;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
  RAISE EXCEPTION 'INVALID_TRUCK_CAPACITY';
END $$;
REVOKE ALL ON FUNCTION public.erp_validate_fractional_truck_v2(jsonb) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.erp_calculate_fractional_truck_v2(
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
      'minimum',round(minimum_value,2),'total',final_value),
    'memoria_interna',memory);
END $$;
REVOKE ALL ON FUNCTION public.erp_calculate_fractional_truck_v2(jsonb,numeric,jsonb,numeric,numeric)
  FROM PUBLIC, anon, authenticated;

-- Alterações futuras na frota criam uma revisão imutável do Truck.
CREATE OR REPLACE FUNCTION public.erp_revise_fractional_truck_after_fleet() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE prior_config jsonb; truck jsonb; revision uuid;
BEGIN
  SELECT r.config INTO prior_config FROM public.erp_fractional_truck_active a
    JOIN public.erp_fractional_truck_revisions r ON r.id = a.revision_id WHERE a.id = 1;
  IF prior_config IS NULL THEN RETURN NEW; END IF;
  IF prior_config->>'rule_id' = 'FRACIONADO_JCN_V2' THEN
    truck := public.erp_validate_fractional_truck_v2(NEW.vehicles);
  ELSE
    truck := public.erp_validate_fractional_truck_config(prior_config, NEW.vehicles);
  END IF;
  INSERT INTO public.erp_fractional_truck_revisions(config,fleet,created_by)
    VALUES (prior_config, jsonb_build_array(jsonb_build_object('name','Truck',
      'payloadKg',truck->'payloadKg','volumeM3',truck->'volumeM3',
      'pricePerKm',truck->'pricePerKm','active',COALESCE(truck->'active','true'::jsonb))),
      NEW.updated_by) RETURNING id INTO revision;
  UPDATE public.erp_fractional_truck_active SET revision_id = revision WHERE id = 1;
  RETURN NEW;
END $$;

-- A tarifa vale para o dedicado também quando Truck for selecionado.
DO $$
DECLARE
  current_fleet jsonb;
  revised_fleet jsonb;
  truck jsonb;
  author_id uuid;
  revision uuid;
BEGIN
  SELECT vehicles, updated_by INTO current_fleet, author_id
    FROM public.erp_fleet_settings WHERE id = 1 FOR UPDATE;
  IF current_fleet IS NULL OR author_id IS NULL THEN
    RAISE EXCEPTION 'Frota cadastrada com responsável é obrigatória';
  END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(current_fleet) v(value)
      WHERE v.value->>'name' = 'Truck') <> 1 THEN
    RAISE EXCEPTION 'Frota deve conter exatamente um Truck';
  END IF;
  SELECT jsonb_agg(
    CASE WHEN v.value->>'name' = 'Truck'
      THEN jsonb_set(jsonb_set(jsonb_set(v.value,'{payloadKg}','14000'::jsonb),
        '{volumeM3}','48'::jsonb),'{pricePerKm}','8.50'::jsonb)
      ELSE v.value END ORDER BY v.ordinality)
    INTO revised_fleet FROM jsonb_array_elements(current_fleet) WITH ORDINALITY v(value, ordinality);
  truck := public.erp_validate_fractional_truck_v2(revised_fleet);
  UPDATE public.erp_fleet_settings SET vehicles = revised_fleet,
    updated_at = now() WHERE id = 1;
  INSERT INTO public.erp_fractional_truck_revisions(config,fleet,created_by)
    VALUES ('{"rule_id":"FRACIONADO_JCN_V2"}'::jsonb,
      jsonb_build_array(jsonb_build_object('name','Truck',
        'payloadKg',truck->'payloadKg','volumeM3',truck->'volumeM3',
        'pricePerKm',truck->'pricePerKm','active',COALESCE(truck->'active','true'::jsonb))),
      author_id) RETURNING id INTO revision;
  INSERT INTO public.erp_fractional_truck_active(id,revision_id) VALUES (1,revision)
    ON CONFLICT (id) DO UPDATE SET revision_id = EXCLUDED.revision_id;
END $$;

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
  IF selected_vehicle IS NULL THEN RAISE EXCEPTION 'Nenhum veículo comporta o peso e a cubagem'; END IF;
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
  IF NOT FOUND THEN RAISE EXCEPTION 'TRUCK_CONFIG_NOT_FOUND'; END IF;
  IF fractional_revision.config->>'rule_id' = 'FRACIONADO_JCN_V2' THEN
    IF volume_m3 <= 0 THEN
      fractional_output := jsonb_build_object('status','INVALID_VOLUME','memoria_interna',NULL);
    ELSE
      fractional_output := public.erp_calculate_fractional_truck_v2(q.draft,km,
        fractional_revision.fleet,settings.tax_percent,settings.insurance_percent);
    END IF;
    rules := rules || jsonb_build_object('fractional_rule_id','FRACIONADO_JCN_V2');
  ELSE
    IF volume_m3 <= 0 THEN
      fractional_output := jsonb_build_object('status','INVALID_VOLUME','memoria_interna',NULL);
    ELSE
      fractional_output := public.erp_calculate_fractional_truck(q.draft,km,
        fractional_revision.config,fractional_revision.fleet,
        settings.tax_percent,settings.insurance_percent);
    END IF;
    rules := rules || jsonb_build_object('fractional_rule_id','FRACIONADO_JCN_V1');
  END IF;
  fractional_scenario := COALESCE(fractional_output->'scenario',
    jsonb_build_object('status',fractional_output->>'status','total',NULL,'floor',NULL,
      'taxes',NULL,'insurance',NULL,'pgr',0,'tolls',0,'collection',0,'minimum',NULL));
  fractional_scenario := fractional_scenario || jsonb_build_object(
    'status',fractional_output->>'status','modalidade','FRACIONADO',
    'regra_id',rules->>'fractional_rule_id','configuracao_id',fractional_revision.id);
  snapshot := jsonb_set(snapshot,'{rules}',rules || jsonb_build_object(
    'fractional_config_id',fractional_revision.id,'fractional_vehicle','Truck'))
    || jsonb_build_object('fractional_internal',fractional_output->'memoria_interna',
      'fractional_status',fractional_output->>'status');
  INSERT INTO public.erp_quote_analyses(quote_id,created_by,pricing_revision_id,snapshot,result)
  VALUES (q.id,auth.uid(),NULL,snapshot,
    jsonb_build_object('fracionado',fractional_scenario,'dedicado',dedicated_scenario))
  RETURNING * INTO result;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.erp_analyze_quote(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.erp_analyze_quote(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
