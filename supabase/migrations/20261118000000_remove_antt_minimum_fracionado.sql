-- Remove ANTT minimum clamping from fractional scenario.
-- The ANTT minimum is a regulatory floor for DEDICADO transport.
-- For FRACIONADO, the calculation already includes its own minimum
-- (trip_cost + insurance + taxes), which is the correct floor.

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
  IF volume_m3 <= 0 THEN RAISE EXCEPTION 'INVALID_VOLUME'; END IF;
  IF invoice < 0 OR weight_kg < 0 OR margin_rate IS NULL
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
    'minimum',public.erp_quote_antt_minimum(fleet, selected_vehicle->>'name', km, settings.tax_percent, margin_rate),'total',greatest(public.erp_quote_antt_minimum(fleet, selected_vehicle->>'name', km, settings.tax_percent, margin_rate),round((base_value + tax_value + insurance_value) * (1 + margin_rate / 100),2)));
  rules := jsonb_build_object('vehicles',fleet,'tax_percent',settings.tax_percent,
    'insurance_percent',settings.insurance_percent,'driver_max_percent',settings.driver_max_percent,
    'margin_percent',margin_rate,'minimum_freight',1500,'selected_vehicle',selected_vehicle->>'name');
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
  -- No ANTT minimum clamp for fractional: the fractional calculation
  -- already has its own minimum (trip_cost + insurance + tax_cost).
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
