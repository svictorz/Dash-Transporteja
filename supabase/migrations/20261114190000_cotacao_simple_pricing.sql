-- Configuração global de percentuais. Revisões e análises antigas ficam intactas.
CREATE TABLE public.erp_quote_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  tax_percent numeric NOT NULL CHECK (tax_percent BETWEEN 0 AND 100),
  insurance_percent numeric NOT NULL CHECK (insurance_percent BETWEEN 0 AND 100),
  driver_max_percent numeric NOT NULL CHECK (driver_max_percent BETWEEN 0 AND 100),
  updated_by uuid NOT NULL REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.erp_quote_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.erp_quote_settings FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.erp_quote_settings TO authenticated;
CREATE POLICY erp_quote_settings_read ON public.erp_quote_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY erp_quote_settings_insert ON public.erp_quote_settings FOR INSERT TO authenticated
  WITH CHECK (updated_by = (SELECT auth.uid()) AND (SELECT public.current_user_has_any_role(ARRAY['admin']::text[])));
CREATE POLICY erp_quote_settings_update ON public.erp_quote_settings FOR UPDATE TO authenticated
  USING ((SELECT public.current_user_has_any_role(ARRAY['admin']::text[])))
  WITH CHECK (updated_by = (SELECT auth.uid()) AND (SELECT public.current_user_has_any_role(ARRAY['admin']::text[])));

ALTER TABLE public.erp_quote_analyses ALTER COLUMN pricing_revision_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.erp_validate_analysis_cargo() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  weight_kg numeric;
  invoice_value numeric;
  volume_m3 numeric;
BEGIN
  weight_kg := NULLIF(NEW.snapshot #>> '{draft,pesoKg}', '')::numeric;
  invoice_value := NULLIF(NEW.snapshot #>> '{draft,valorNota}', '')::numeric;
  volume_m3 := COALESCE(NULLIF(NEW.snapshot #>> '{draft,cubagemM3}', '')::numeric, 0);
  IF weight_kg IS NULL OR weight_kg <= 0 OR invoice_value IS NULL OR invoice_value <= 0 OR volume_m3 < 0 THEN
    RAISE EXCEPTION 'Informe peso e valor da nota positivos e cubagem válida';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(NEW.snapshot #> '{rules,vehicles}') AS vehicle
    WHERE (vehicle->>'payloadKg')::numeric >= weight_kg
      AND (vehicle->>'volumeM3')::numeric >= volume_m3
  ) THEN
    RAISE EXCEPTION 'Carga acima da capacidade da frota';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.erp_analyze_quote(target_quote uuid)
RETURNS public.erp_quote_analyses
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  q public.erp_quotes;
  settings public.erp_quote_settings;
  fleet jsonb;
  selected_vehicle jsonb;
  result public.erp_quote_analyses;
  km numeric;
  invoice numeric;
  weight_kg numeric;
  volume_m3 numeric;
  margin_rate numeric;
  base_value numeric;
  tax_value numeric;
  insurance_value numeric;
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
  invoice := COALESCE(NULLIF(q.draft->>'valorNota', '')::numeric, 0);
  weight_kg := COALESCE(NULLIF(q.draft->>'pesoKg', '')::numeric, 0);
  volume_m3 := COALESCE(NULLIF(q.draft->>'cubagemM3', '')::numeric, 0);
  margin_rate := NULLIF(q.draft->>'marginPercent', '')::numeric;
  IF invoice < 0 OR weight_kg < 0 OR volume_m3 < 0 OR margin_rate IS NULL OR margin_rate < 0 OR margin_rate > 100 THEN
    RAISE EXCEPTION 'Confira nota fiscal, carga e margem de lucro (0 a 100%%)';
  END IF;

  SELECT v.value INTO selected_vehicle FROM jsonb_array_elements(fleet) AS v(value)
    WHERE (v.value->>'payloadKg')::numeric >= weight_kg
      AND (v.value->>'volumeM3')::numeric >= volume_m3
    ORDER BY (v.value->>'payloadKg')::numeric, (v.value->>'volumeM3')::numeric
    LIMIT 1;
  IF selected_vehicle IS NULL THEN
    RAISE EXCEPTION 'Nenhum veículo comporta o peso e a cubagem';
  END IF;
  IF (selected_vehicle->>'pricePerKm')::numeric <= 0 THEN
    RAISE EXCEPTION 'Valor por km do veículo inválido';
  END IF;

  base_value := round(km * (selected_vehicle->>'pricePerKm')::numeric, 2);
  tax_value := round(base_value * settings.tax_percent / 100, 2);
  insurance_value := round(invoice * settings.insurance_percent / 100, 2);

  INSERT INTO public.erp_quote_analyses(quote_id, created_by, pricing_revision_id, snapshot, result)
  VALUES (
    q.id, auth.uid(), NULL,
    jsonb_build_object('rules', jsonb_build_object('vehicles', fleet, 'tax_percent', settings.tax_percent,
      'insurance_percent', settings.insurance_percent, 'driver_max_percent', settings.driver_max_percent,
      'margin_percent', margin_rate, 'selected_vehicle', selected_vehicle->>'name'), 'draft', q.draft, 'distance_km', km, 'distance_source', q.distance_source),
    jsonb_build_object(
      'fracionado', jsonb_build_object('floor', base_value, 'taxes', tax_value,
        'insurance', insurance_value, 'pgr', 0, 'tolls', 0, 'collection', 0,
        'total', round((base_value + tax_value + insurance_value) * (1 + margin_rate / 100), 2)),
      'dedicado', jsonb_build_object('floor', base_value, 'taxes', tax_value,
        'insurance', insurance_value, 'pgr', 0, 'tolls', 0, 'collection', 0,
        'total', round((base_value + tax_value + insurance_value) * (1 + margin_rate / 100), 2))
    )
  ) RETURNING * INTO result;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.erp_analyze_quote(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.erp_analyze_quote(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
