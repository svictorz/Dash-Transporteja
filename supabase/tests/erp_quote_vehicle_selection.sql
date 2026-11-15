-- Executar com psql -v ON_ERROR_STOP=1. Toda cotação criada aqui é revertida.
BEGIN;
DO $$
DECLARE
  quote_owner uuid;
  new_quote uuid;
  chosen public.erp_quote_analyses;
  automatic public.erp_quote_analyses;
BEGIN
  SELECT owner_id INTO quote_owner FROM public.erp_quotes LIMIT 1;
  IF quote_owner IS NULL THEN RAISE EXCEPTION 'Teste requer um usuário com cotação'; END IF;
  PERFORM set_config('request.jwt.claim.sub', quote_owner::text, true);

  INSERT INTO public.erp_quotes(owner_id, draft, distance_km, distance_source)
  VALUES (quote_owner,
    '{"origem":"São Paulo/SP","destino":"Alvorada/TO","pesoKg":3585,"cubagemM3":2.81,"valorNota":14916.47,"marginPercent":20,"selectedVehicleName":"Truck"}'::jsonb,
    1284.8, 'manual') RETURNING id INTO new_quote;
  chosen := public.erp_analyze_quote(new_quote);
  IF chosen.snapshot #>> '{rules,selected_vehicle}' <> 'Truck' THEN
    RAISE EXCEPTION 'Veículo escolhido não foi usado na análise';
  END IF;

  UPDATE public.erp_quotes SET draft = draft - 'selectedVehicleName' WHERE id = new_quote;
  automatic := public.erp_analyze_quote(new_quote);
  IF automatic.snapshot #>> '{rules,selected_vehicle}' <> '3/4' THEN
    RAISE EXCEPTION 'Seleção automática deixou de escolher o menor veículo compatível';
  END IF;
  IF (chosen.result #>> '{fracionado,total}')::numeric <= (automatic.result #>> '{fracionado,total}')::numeric THEN
    RAISE EXCEPTION 'Troca de veículo não alterou o preço calculado';
  END IF;

  UPDATE public.erp_quotes
  SET draft = jsonb_set(draft, '{selectedVehicleName}', '"Fiorino / Kangoo"'::jsonb)
  WHERE id = new_quote;
  BEGIN
    PERFORM public.erp_analyze_quote(new_quote);
    RAISE EXCEPTION 'Veículo incompatível foi aceito';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Veículo selecionado indisponível ou incompatível com a carga' THEN RAISE; END IF;
  END;
END $$;
ROLLBACK;
