-- Cotação independente de routes; nenhuma regra de preço é ativada por padrão.
CREATE TABLE public.erp_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  draft jsonb NOT NULL DEFAULT '{}'::jsonb,
  distance_km numeric(10,1) CHECK (distance_km IS NULL OR distance_km > 0),
  distance_source text CHECK (distance_source IN ('route-api', 'manual')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX erp_quotes_owner_created_idx ON public.erp_quotes(owner_id, created_at DESC);

CREATE TABLE public.erp_pricing_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_uf text NOT NULL CHECK (origin_uf ~ '^[A-Z]{2}$'),
  destination_uf text NOT NULL CHECK (destination_uf ~ '^[A-Z]{2}$'),
  effective_from date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'retired')),
  rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  CHECK ((status <> 'approved') OR (approved_by IS NOT NULL AND approved_at IS NOT NULL))
);
CREATE INDEX erp_pricing_effective_idx ON public.erp_pricing_revisions(origin_uf, destination_uf, effective_from DESC) WHERE status = 'approved';

CREATE FUNCTION public.erp_lock_approved_revision() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF OLD.status = 'approved' THEN RAISE EXCEPTION 'Revisão aprovada é imutável; crie uma nova revisão'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER erp_lock_approved_revision BEFORE UPDATE OR DELETE ON public.erp_pricing_revisions
FOR EACH ROW EXECUTE FUNCTION public.erp_lock_approved_revision();

CREATE TABLE public.erp_quote_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.erp_quotes(id),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  pricing_revision_id uuid NOT NULL REFERENCES public.erp_pricing_revisions(id),
  snapshot jsonb NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX erp_analyses_quote_created_idx ON public.erp_quote_analyses(quote_id, created_at DESC);

ALTER TABLE public.erp_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_pricing_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_quote_analyses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.erp_quotes, public.erp_pricing_revisions, public.erp_quote_analyses FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.erp_quotes TO authenticated;
GRANT SELECT ON public.erp_quote_analyses TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.erp_pricing_revisions TO authenticated;

CREATE POLICY erp_quotes_read ON public.erp_quotes FOR SELECT TO authenticated
  USING (owner_id = (SELECT auth.uid()) OR (SELECT public.current_user_has_any_role(ARRAY['admin']::text[])));
CREATE POLICY erp_quotes_insert ON public.erp_quotes FOR INSERT TO authenticated
  WITH CHECK (owner_id = (SELECT auth.uid()));
CREATE POLICY erp_quotes_update ON public.erp_quotes FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid())) WITH CHECK (owner_id = (SELECT auth.uid()));
CREATE POLICY erp_pricing_read ON public.erp_pricing_revisions FOR SELECT TO authenticated
  USING (status = 'approved' OR (SELECT public.current_user_has_any_role(ARRAY['admin']::text[])));
CREATE POLICY erp_pricing_insert ON public.erp_pricing_revisions FOR INSERT TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()) AND (SELECT public.current_user_has_any_role(ARRAY['admin']::text[])));
CREATE POLICY erp_pricing_update ON public.erp_pricing_revisions FOR UPDATE TO authenticated
  USING ((SELECT public.current_user_has_any_role(ARRAY['admin']::text[])))
  WITH CHECK ((SELECT public.current_user_has_any_role(ARRAY['admin']::text[])));
CREATE POLICY erp_analyses_read ON public.erp_quote_analyses FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.erp_quotes q WHERE q.id = quote_id));
-- Analyses are inserted by the validated RPC below, never directly through the Data API.

CREATE OR REPLACE FUNCTION public.erp_analyze_quote(target_quote uuid)
RETURNS public.erp_quote_analyses
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE q public.erp_quotes; r public.erp_pricing_revisions; result public.erp_quote_analyses;
  km numeric; invoice numeric; tax_rate numeric; insurance_rate numeric; margin_rate numeric;
  fractional_floor numeric; dedicated_floor numeric; insurance_value numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão obrigatória'; END IF;
  SELECT * INTO q FROM public.erp_quotes WHERE id = target_quote;
  IF NOT FOUND OR q.owner_id <> auth.uid() OR q.distance_km IS NULL THEN
    RAISE EXCEPTION 'Cotação ou distância indisponível';
  END IF;
  SELECT * INTO r FROM public.erp_pricing_revisions
    WHERE status = 'approved' AND effective_from <= CURRENT_DATE
      AND origin_uf = upper(right(q.draft->>'origem', 2))
      AND destination_uf = upper(right(q.draft->>'destino', 2))
    ORDER BY effective_from DESC, approved_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Regras de preço ainda não aprovadas'; END IF;
  IF NOT (r.rules ?& ARRAY['fractional_ccd','fractional_fixed','dedicated_ccd','dedicated_fixed','tax_percent','insurance_percent','margin_percent','fractional_operational','dedicated_operational','pgr_value','tolls_value','collection_value','vehicles'])
     OR jsonb_typeof(r.rules->'vehicles') <> 'array' OR jsonb_array_length(r.rules->'vehicles') = 0 THEN
    RAISE EXCEPTION 'Regras de preço incompletas';
  END IF;
  km := q.distance_km;
  invoice := COALESCE((q.draft->>'valorNota')::numeric, 0);
  tax_rate := (r.rules->>'tax_percent')::numeric;
  insurance_rate := (r.rules->>'insurance_percent')::numeric;
  margin_rate := (r.rules->>'margin_percent')::numeric;
  IF invoice < 0 OR tax_rate < 0 OR tax_rate > 100 OR insurance_rate < 0 OR insurance_rate > 100 OR margin_rate < 0 OR margin_rate > 100
     OR EXISTS (SELECT 1 FROM jsonb_each_text(r.rules - 'vehicles') AS entry WHERE entry.key IN ('fractional_ccd','fractional_fixed','dedicated_ccd','dedicated_fixed','fractional_operational','dedicated_operational','pgr_value','tolls_value','collection_value') AND entry.value::numeric < 0)
  THEN RAISE EXCEPTION 'Parâmetros inválidos'; END IF;
  fractional_floor := GREATEST(ROUND(km * (r.rules->>'fractional_ccd')::numeric + (r.rules->>'fractional_fixed')::numeric, 2), (r.rules->>'fractional_operational')::numeric);
  dedicated_floor := GREATEST(ROUND(km * (r.rules->>'dedicated_ccd')::numeric + (r.rules->>'dedicated_fixed')::numeric, 2), (r.rules->>'dedicated_operational')::numeric);
  IF fractional_floor <= 0 OR dedicated_floor <= 0 THEN RAISE EXCEPTION 'Coeficientes inválidos'; END IF;
  insurance_value := ROUND(invoice * insurance_rate / 100, 2);
  INSERT INTO public.erp_quote_analyses(quote_id, created_by, pricing_revision_id, snapshot, result)
  VALUES (q.id, auth.uid(), r.id, jsonb_build_object('rules', r.rules, 'draft', q.draft, 'distance_km', q.distance_km, 'distance_source', q.distance_source),
    jsonb_build_object(
      'fracionado', jsonb_build_object('floor', fractional_floor, 'taxes', ROUND(fractional_floor * tax_rate / 100, 2), 'insurance', insurance_value, 'pgr', (r.rules->>'pgr_value')::numeric, 'tolls', (r.rules->>'tolls_value')::numeric, 'collection', (r.rules->>'collection_value')::numeric, 'total', ROUND((fractional_floor + ROUND(fractional_floor * tax_rate / 100, 2) + insurance_value + (r.rules->>'pgr_value')::numeric + (r.rules->>'tolls_value')::numeric + (r.rules->>'collection_value')::numeric) * (1 + margin_rate / 100), 2)),
      'dedicado', jsonb_build_object('floor', dedicated_floor, 'taxes', ROUND(dedicated_floor * tax_rate / 100, 2), 'insurance', insurance_value, 'pgr', (r.rules->>'pgr_value')::numeric, 'tolls', (r.rules->>'tolls_value')::numeric, 'collection', (r.rules->>'collection_value')::numeric, 'total', ROUND((dedicated_floor + ROUND(dedicated_floor * tax_rate / 100, 2) + insurance_value + (r.rules->>'pgr_value')::numeric + (r.rules->>'tolls_value')::numeric + (r.rules->>'collection_value')::numeric) * (1 + margin_rate / 100), 2))))
  RETURNING * INTO result;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.erp_analyze_quote(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.erp_analyze_quote(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
