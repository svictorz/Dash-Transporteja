-- Executar em transação após 20261118210000_quote_dedicated_minimum_with_insurance.sql.
DO $$
DECLARE
  fleet jsonb := '[{"name":"Truck","axles":3}]'::jsonb;
  minimum_value numeric;
BEGIN
  minimum_value := public.erp_quote_antt_minimum_with_insurance(
    fleet, 'Truck', 100, 18, 25, 2);
  IF minimum_value <> 1571.35 THEN
    RAISE EXCEPTION 'Mínimo dedicado não inclui tributos, seguro e margem: %', minimum_value;
  END IF;

  minimum_value := public.erp_quote_antt_minimum_with_insurance(
    fleet, 'Truck', 1, 18, 25, 2);
  IF minimum_value <> 1500 THEN
    RAISE EXCEPTION 'Piso absoluto do dedicado foi alterado: %', minimum_value;
  END IF;
END $$;

DO $$
DECLARE
  quote_id uuid;
  quote_owner uuid;
  analysis public.erp_quote_analyses;
  expected_minimum numeric;
BEGIN
  SELECT id, owner_id INTO quote_id, quote_owner FROM public.erp_quotes LIMIT 1;
  IF quote_id IS NULL THEN
    RAISE NOTICE 'Sem cotação existente para teste integrado da RPC';
    RETURN;
  END IF;
  PERFORM set_config('request.jwt.claim.sub', quote_owner::text, true);
  UPDATE public.erp_quotes SET
    draft = (draft - 'selectedVehicleName') ||
      '{"pesoKg":1000,"cubagemM3":2,"valorNota":1000,"marginPercent":25}'::jsonb,
    distance_km = 100
    WHERE id = quote_id;
  SELECT * INTO analysis FROM public.erp_analyze_quote(quote_id);
  expected_minimum := public.erp_quote_antt_minimum_with_insurance(
    analysis.snapshot #> '{rules,vehicles}',
    analysis.snapshot #>> '{rules,selected_vehicle}',
    100,
    (analysis.snapshot #>> '{rules,tax_percent}')::numeric,
    25,
    round(1000 * (analysis.snapshot #>> '{rules,insurance_percent}')::numeric / 100, 2));
  IF (analysis.result #>> '{dedicado,minimum}')::numeric <> expected_minimum
     OR (analysis.result #>> '{dedicado,total}')::numeric < expected_minimum THEN
    RAISE EXCEPTION 'RPC não aplicou o mínimo completo ao dedicado: %', analysis.result;
  END IF;
END $$;
