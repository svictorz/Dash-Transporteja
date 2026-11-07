-- Run inside a transaction and always ROLLBACK (including the candidate migration).
CREATE TEMP TABLE test_actors(role text PRIMARY KEY, id uuid DEFAULT gen_random_uuid());
INSERT INTO test_actors(role) VALUES ('admin'),('financeiro'),('fiscal'),('supervisor'),('comercial'),('driver'),('operacional');
INSERT INTO auth.users(id,email) SELECT id, id || '@operacional-test.invalid' FROM test_actors;
INSERT INTO public.users(id,email,role,commission_rate)
SELECT id,id || '@operacional-test.invalid',role,25 FROM test_actors
ON CONFLICT(id) DO UPDATE SET role=excluded.role, commission_rate=excluded.commission_rate;
CREATE TEMP TABLE test_freights(id uuid PRIMARY KEY);
WITH added AS (
 INSERT INTO public.routes(freight_id,origin,origin_state,destination,destination_state,vehicle,plate,weight,estimated_delivery,pickup_date,created_by_user_id,freight_value,nf_value,driver_value,taxes_percent,seguro_percent)
 SELECT -900000000000 - row_number() OVER (), 'Teste','SP','Teste','RJ','Teste','TEST000','1','2026-11-08','2026-11-07',id,21000,50000,11500,18,0.2
 FROM test_actors WHERE role IN ('comercial','supervisor') RETURNING id
) INSERT INTO test_freights SELECT id FROM added;
GRANT SELECT ON test_actors,test_freights TO authenticated;

CREATE FUNCTION pg_temp.check_true(ok boolean, message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',message; END IF; END $$;
CREATE FUNCTION pg_temp.denied(statement text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 BEGIN EXECUTE statement;
 EXCEPTION WHEN insufficient_privilege THEN RETURN;
 WHEN raise_exception THEN
  IF SQLERRM='Apenas admin, financeiro ou fiscal podem alterar o status de pagamento da comissao.' THEN RETURN; END IF;
  RAISE;
 END;
 RAISE EXCEPTION 'FAIL: statement was not denied: %',statement;
END $$;

SET LOCAL ROLE authenticated;
DO $$
DECLARE actor record; n int;
BEGIN
 FOR actor IN SELECT * FROM test_actors LOOP
  PERFORM set_config('request.jwt.claim.sub',actor.id::text,true);
  PERFORM set_config('request.jwt.claims',json_build_object('sub',actor.id,'role','authenticated')::text,true);
  PERFORM pg_temp.check_true(public.is_admin_or_financeiro() = (actor.role IN ('admin','financeiro','fiscal')),actor.role || ': financial rights unchanged');
  SELECT count(*) INTO n FROM public.routes WHERE id IN (SELECT id FROM test_freights);
  PERFORM pg_temp.check_true(n = CASE WHEN actor.role IN ('admin','financeiro','fiscal','supervisor','operacional') THEN 2 WHEN actor.role='comercial' THEN 1 ELSE 0 END,actor.role || ': visibility');
  UPDATE public.routes SET driver_name='Teste' WHERE id IN (SELECT id FROM test_freights);
  GET DIAGNOSTICS n=ROW_COUNT;
  PERFORM pg_temp.check_true(n = CASE WHEN actor.role IN ('admin','financeiro','fiscal','operacional') THEN 2 WHEN actor.role IN ('supervisor','comercial') THEN 1 ELSE 0 END,actor.role || ': update scope');
 END LOOP;
END $$;
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM test_actors WHERE role='operacional'),true);
SELECT set_config('request.jwt.claims',json_build_object('sub',(SELECT id FROM test_actors WHERE role='operacional'),'role','authenticated')::text,true);

-- Both sections can update another owner's rows.
UPDATE public.routes SET cte_value=21000,vale_pedagio=1121.58,vale_pedagio_incluso=false,
 driver_value=11500,taxes_percent=18,seguro_percent=0.2,driver_name='ANTONIO',
 driver_phone='+55 47 9748-5655',driver_payment_status='Pendente',driver_payment_type='PIX',
 vehicle='Carreta',plate='ABC1D23' WHERE id IN (SELECT id FROM test_freights);
SELECT pg_temp.check_true(count(*)=2,'calculation excluding toll and seller commission')
 FROM public.routes WHERE id IN (SELECT id FROM test_freights)
 AND taxes_value=3780 AND seguro_value=100 AND net_freight_value=5620 AND commission_value=1405;
UPDATE public.routes SET vale_pedagio_incluso=true WHERE id IN (SELECT id FROM test_freights);
SELECT pg_temp.check_true(count(*)=2,'calculation including toll') FROM public.routes
 WHERE id IN (SELECT id FROM test_freights) AND net_freight_value=4498.42 AND commission_value=1124.61;

SELECT pg_temp.denied('UPDATE public.routes SET status=''delivered'' WHERE id IN (SELECT id FROM test_freights)');
SELECT pg_temp.denied('UPDATE public.routes SET observation=''x'' WHERE id IN (SELECT id FROM test_freights)');
SELECT pg_temp.denied('UPDATE public.routes SET freight_value=1 WHERE id IN (SELECT id FROM test_freights)');
SELECT pg_temp.denied('UPDATE public.routes SET origin=''x'' WHERE id IN (SELECT id FROM test_freights)');
SELECT pg_temp.denied('UPDATE public.routes SET created_by_user_id=auth.uid() WHERE id IN (SELECT id FROM test_freights)');
SELECT pg_temp.denied('UPDATE public.routes SET commission_paid=true WHERE id IN (SELECT id FROM test_freights)');
SELECT pg_temp.denied('UPDATE public.routes SET commission_value=999999 WHERE id IN (SELECT id FROM test_freights)');
SELECT pg_temp.denied('UPDATE public.routes SET taxes_percent=12 WHERE id IN (SELECT id FROM test_freights)');
SELECT pg_temp.denied('UPDATE public.routes SET driver_value=-1 WHERE id IN (SELECT id FROM test_freights)');
SELECT pg_temp.denied('SELECT public.update_route_observation((SELECT id FROM test_freights LIMIT 1),''x'')');
SELECT pg_temp.denied('UPDATE public.users SET role=''admin'' WHERE id=auth.uid()');
SELECT pg_temp.denied('UPDATE public.users SET commission_rate=100 WHERE id=auth.uid()');
SELECT pg_temp.denied('UPDATE public.users SET email=''outra@operacional-test.invalid'' WHERE id=auth.uid()');
SELECT pg_temp.denied('INSERT INTO public.routes(freight_id,origin,origin_state,destination,destination_state,vehicle,plate,weight,estimated_delivery,pickup_date) VALUES (-900000000099,''Teste'',''SP'',''Teste'',''RJ'',''Teste'',''TEST000'',''1'',''2026-11-08'',''2026-11-07'')');
DO $$ DECLARE n int; BEGIN
 DELETE FROM public.routes WHERE id IN (SELECT id FROM test_freights); GET DIAGNOSTICS n=ROW_COUNT;
 PERFORM pg_temp.check_true(n=0,'no route delete');
END $$;
RESET ROLE;
SELECT 'PASS: operational RLS, whitelist, calculations, profile protection and old role matrix' AS result;
