-- Usar somente em transação que termina com ROLLBACK.
DO $$
DECLARE
  quote_id uuid;
  quote_owner uuid;
  result public.erp_quote_analyses;
BEGIN
  SELECT q.id, q.owner_id INTO quote_id, quote_owner
    FROM public.erp_quotes q
    WHERE q.distance_km > 0
      AND NULLIF(q.draft->>'pesoKg','')::numeric BETWEEN 0.01 AND 14000
      AND NULLIF(q.draft->>'cubagemM3','')::numeric BETWEEN 0.01 AND 43
      AND NULLIF(q.draft->>'marginPercent','')::numeric BETWEEN 0 AND 100
    LIMIT 1;
  IF quote_id IS NULL THEN
    RAISE NOTICE 'Sem cotação existente adequada ao teste de integração';
    RETURN;
  END IF;
  PERFORM set_config('request.jwt.claim.sub',quote_owner::text,true);
  SELECT * INTO result FROM public.erp_analyze_quote(quote_id);
  IF result.result #>> '{fracionado,regra_id}' <> 'FRACIONADO_JCN_V2'
     OR result.snapshot #>> '{rules,fractional_vehicle}' <> 'Truck'
     OR (result.result #>> '{fracionado,total}')::numeric <= 0
     OR (SELECT (v.value->>'pricePerKm')::numeric
           FROM jsonb_array_elements(result.snapshot #> '{rules,vehicles}') v(value)
           WHERE v.value->>'name' = 'Truck') <> 8.50
     OR (result.result #>> '{dedicado,total}')::numeric <= 0 THEN
    RAISE EXCEPTION 'Integração fracionado/dedicado falhou: %',result.result;
  END IF;
END $$;
