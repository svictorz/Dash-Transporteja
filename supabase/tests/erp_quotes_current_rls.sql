-- Verifica o acesso atual da Cotação; nada persiste após ROLLBACK.
BEGIN;

DO $$
DECLARE
  seller_one uuid;
  seller_two uuid;
  administrator uuid;
  quote_id uuid;
  visible_count integer;
  rejected boolean;
BEGIN
  SELECT id INTO seller_one FROM public.users WHERE role = 'comercial' ORDER BY id LIMIT 1;
  SELECT id INTO seller_two FROM public.users WHERE role = 'comercial' AND id <> seller_one ORDER BY id LIMIT 1;
  SELECT id INTO administrator FROM public.users WHERE role = 'admin' ORDER BY id LIMIT 1;
  IF seller_one IS NULL OR seller_two IS NULL OR administrator IS NULL THEN
    RAISE EXCEPTION 'O teste exige dois comerciais e um administrador';
  END IF;

  INSERT INTO public.erp_quotes(owner_id, draft, distance_km, distance_source)
  VALUES (seller_one,
    '{"origem":"São Paulo/SP","destino":"Alvorada/TO","pesoKg":3585,"cubagemM3":2.81,"valorNota":14916.47,"marginPercent":20}'::jsonb,
    1284.8, 'manual') RETURNING id INTO quote_id;

  PERFORM set_config('request.jwt.claim.sub', seller_one::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO visible_count FROM public.erp_quotes WHERE id = quote_id;
  IF visible_count <> 1 THEN RAISE EXCEPTION 'Autor não consegue ler sua cotação'; END IF;

  PERFORM set_config('request.jwt.claim.sub', seller_two::text, true);
  SELECT count(*) INTO visible_count FROM public.erp_quotes WHERE id = quote_id;
  IF visible_count <> 0 THEN RAISE EXCEPTION 'Outro comercial consegue ler a cotação'; END IF;
  rejected := false;
  BEGIN
    PERFORM public.erp_analyze_quote(quote_id);
  EXCEPTION WHEN OTHERS THEN
    rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Outro comercial conseguiu analisar a cotação'; END IF;

  SELECT count(*) INTO visible_count FROM public.erp_quote_settings;
  IF visible_count <> 1 THEN RAISE EXCEPTION 'Usuário autenticado não consegue ler os parâmetros'; END IF;
  UPDATE public.erp_quote_settings SET tax_percent = 99 WHERE id = 1;
  IF FOUND THEN RAISE EXCEPTION 'Comercial conseguiu editar os parâmetros'; END IF;

  PERFORM set_config('request.jwt.claim.sub', administrator::text, true);
  SELECT count(*) INTO visible_count FROM public.erp_quotes WHERE id = quote_id;
  IF visible_count <> 1 THEN RAISE EXCEPTION 'Administrador não consegue consultar a cotação'; END IF;
END $$;

RESET ROLE;
DO $$
BEGIN
  IF has_table_privilege('anon', 'public.erp_quotes', 'SELECT')
     OR has_table_privilege('anon', 'public.erp_quote_settings', 'SELECT')
     OR has_table_privilege('anon', 'public.erp_fleet_settings', 'SELECT')
     OR has_table_privilege('authenticated', 'public.erp_quote_analyses', 'INSERT') THEN
    RAISE EXCEPTION 'Permissão indevida em tabelas da Cotação';
  END IF;
END $$;

ROLLBACK;
