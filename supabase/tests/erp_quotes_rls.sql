-- Execute after the candidate migration in one BEGIN/ROLLBACK transaction.
DO $$
DECLARE first_seller uuid; second_seller uuid; admin_id uuid; quote_id uuid; visible_count integer;
BEGIN
  SELECT id INTO first_seller FROM public.users WHERE role = 'comercial' ORDER BY id LIMIT 1;
  SELECT id INTO second_seller FROM public.users WHERE role = 'comercial' AND id <> first_seller ORDER BY id LIMIT 1;
  SELECT id INTO admin_id FROM public.users WHERE role = 'admin' ORDER BY id LIMIT 1;
  IF first_seller IS NULL OR second_seller IS NULL OR admin_id IS NULL THEN
    RAISE EXCEPTION 'Need two commercial users and one admin for RLS test';
  END IF;
  INSERT INTO public.erp_quotes(owner_id, draft) VALUES(first_seller, '{"origem":"Teste/SC","destino":"Teste/SP"}') RETURNING id INTO quote_id;
  PERFORM set_config('request.jwt.claim.sub', first_seller::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', first_seller, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO visible_count FROM public.erp_quotes WHERE id = quote_id;
  IF visible_count <> 1 THEN RAISE EXCEPTION 'Owner cannot read own quote'; END IF;
  PERFORM set_config('request.jwt.claim.sub', second_seller::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', second_seller, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO visible_count FROM public.erp_quotes WHERE id = quote_id;
  IF visible_count <> 0 THEN RAISE EXCEPTION 'Other commercial user can read quote'; END IF;
  PERFORM set_config('request.jwt.claim.sub', admin_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO visible_count FROM public.erp_quotes WHERE id = quote_id;
  IF visible_count <> 1 THEN RAISE EXCEPTION 'Admin cannot read quote'; END IF;
END $$;
SELECT 'PASS: ERP quote owner isolation and administrator visibility' AS result;
DO $$ BEGIN
  IF has_table_privilege('anon', 'public.erp_quotes', 'SELECT') OR has_table_privilege('anon', 'public.erp_pricing_revisions', 'SELECT') THEN
    RAISE EXCEPTION 'Anonymous access to ERP tables';
  END IF;
  IF has_table_privilege('authenticated', 'public.erp_quote_analyses', 'INSERT') THEN
    RAISE EXCEPTION 'Direct analysis inserts are allowed';
  END IF;
END $$;
SELECT 'PASS: anonymous access and direct analysis inserts blocked' AS result;
DO $$
DECLARE seller uuid; quote_id uuid; rejected boolean := false;
BEGIN
  SELECT id INTO seller FROM public.users WHERE role = 'comercial' ORDER BY id LIMIT 1;
  PERFORM set_config('request.jwt.claim.sub', seller::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', seller, 'role', 'authenticated')::text, true);
  INSERT INTO public.erp_quotes(owner_id, draft, distance_km, distance_source)
  VALUES (seller, '{"origem":"A/SC","destino":"B/RS","valorNota":1000,"pesoKg":500}', 100, 'manual') RETURNING id INTO quote_id;
  BEGIN
    PERFORM public.erp_analyze_quote(quote_id);
  EXCEPTION WHEN OTHERS THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Pricing without approved rules was allowed'; END IF;
END $$;
SELECT 'PASS: final price blocked without approved rules' AS result;
RESET ROLE;
DO $$
DECLARE seller uuid; admin_id uuid; quote_id uuid; computed public.erp_quote_analyses;
BEGIN
  SELECT id INTO seller FROM public.users WHERE role = 'comercial' ORDER BY id LIMIT 1;
  SELECT id INTO admin_id FROM public.users WHERE role = 'admin' ORDER BY id LIMIT 1;
  PERFORM set_config('request.jwt.claim.sub', admin_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  INSERT INTO public.erp_pricing_revisions(origin_uf, destination_uf, effective_from, status, rules, created_by, approved_by, approved_at)
  VALUES ('SC', 'SP', CURRENT_DATE, 'approved', '{"fractional_ccd":4,"fractional_fixed":100,"dedicated_ccd":6,"dedicated_fixed":100,"tax_percent":10,"insurance_percent":1,"margin_percent":20,"fractional_operational":0,"dedicated_operational":0,"pgr_value":20,"tolls_value":30,"collection_value":40,"vehicles":[{"name":"Van","payloadKg":1500,"axles":2}]}', admin_id, admin_id, now());
  PERFORM set_config('request.jwt.claim.sub', seller::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', seller, 'role', 'authenticated')::text, true);
  INSERT INTO public.erp_quotes(owner_id, draft, distance_km, distance_source)
  VALUES (seller, '{"origem":"A/SC","destino":"B/SP","valorNota":1000,"pesoKg":500}', 100, 'manual') RETURNING id INTO quote_id;
  SELECT * INTO computed FROM public.erp_analyze_quote(quote_id);
  IF (computed.result #>> '{fracionado,total}')::numeric <> 780 OR (computed.result #>> '{dedicado,total}')::numeric <> 1044 THEN
    RAISE EXCEPTION 'Unexpected scenario totals: %', computed.result;
  END IF;
  IF computed.snapshot #>> '{draft,origem}' <> 'A/SC' THEN RAISE EXCEPTION 'Quote input not snapshotted'; END IF;
  BEGIN
    INSERT INTO public.erp_quotes(owner_id, draft, distance_km, distance_source)
    VALUES (seller, '{"origem":"A/SC","destino":"B/SP","valorNota":1000,"pesoKg":1600}', 100, 'manual') RETURNING id INTO quote_id;
    PERFORM public.erp_analyze_quote(quote_id);
    RAISE EXCEPTION 'Overweight cargo was priced';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Overweight cargo was priced' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.erp_quotes(owner_id, draft, distance_km, distance_source)
    VALUES (seller, '{"origem":"A/SC","destino":"B/RS","valorNota":1000,"pesoKg":500}', 100, 'manual') RETURNING id INTO quote_id;
    PERFORM public.erp_analyze_quote(quote_id);
    RAISE EXCEPTION 'Rule for SC-SP was applied to SC-RS';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Rule for SC-SP was applied to SC-RS' THEN RAISE; END IF;
  END;
END $$;
SELECT 'PASS: server calculation and immutable input snapshot' AS result;
