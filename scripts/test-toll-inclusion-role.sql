CREATE TEMP TABLE toll_role_actors(role text,id uuid DEFAULT gen_random_uuid());
INSERT INTO toll_role_actors(role) VALUES ('admin'),('financeiro'),('fiscal'),('operacional'),('comercial'),('supervisor');
INSERT INTO auth.users(id,email) SELECT id,id||'@toll-role-test.invalid' FROM toll_role_actors;
INSERT INTO public.users(id,email,role) SELECT id,id||'@toll-role-test.invalid',role FROM toll_role_actors
 ON CONFLICT(id) DO UPDATE SET role=excluded.role;
CREATE TEMP TABLE toll_role_routes AS SELECT gen_random_uuid() AS id,a.id AS owner,flag
 FROM toll_role_actors a CROSS JOIN (VALUES (true),(false),(NULL::boolean)) f(flag);
INSERT INTO public.routes(id,freight_id,origin,origin_state,destination,destination_state,vehicle,plate,weight,estimated_delivery,pickup_date,
 created_by_user_id,vale_pedagio_incluso,freight_value,driver_value,vale_pedagio,taxes_percent,seguro_percent)
 SELECT id,-900000001000-row_number() OVER (),'Teste','SP','Teste','RJ','Teste','TEST000','1','','',owner,flag,1000,300,50,0,0
 FROM toll_role_routes;
GRANT SELECT ON toll_role_actors,toll_role_routes TO authenticated;
SET LOCAL ROLE authenticated;
DO $$
DECLARE actor record; sample record; blocked boolean; n int; actor_number int:=0;
BEGIN
 FOR actor IN SELECT * FROM toll_role_actors LOOP
  actor_number:=actor_number+1;
  PERFORM set_config('request.jwt.claim.sub',actor.id::text,true);
  PERFORM set_config('request.jwt.claims',json_build_object('sub',actor.id,'role','authenticated')::text,true);
  FOR sample IN SELECT * FROM toll_role_routes WHERE owner=actor.id LOOP
   -- Unchanged false/null values must still allow the normal route save.
   UPDATE public.routes SET driver_name='Motorista',vale_pedagio_incluso=sample.flag WHERE id=sample.id;
   GET DIAGNOSTICS n=ROW_COUNT;
   IF n<>1 THEN RAISE EXCEPTION 'FAIL: unchanged indicator blocked for %',actor.role; END IF;
   blocked:=false;
   BEGIN
    UPDATE public.routes SET vale_pedagio_incluso=NOT coalesce(sample.flag,false) WHERE id=sample.id;
   EXCEPTION WHEN insufficient_privilege THEN blocked:=true;
   END;
   IF blocked IS DISTINCT FROM (actor.role IN ('comercial','supervisor')) THEN
    RAISE EXCEPTION 'FAIL: incorrect inclusion permission for %',actor.role;
   END IF;
  END LOOP;
  blocked:=false;
  BEGIN
   INSERT INTO public.routes(freight_id,origin,origin_state,destination,destination_state,vehicle,plate,weight,estimated_delivery,pickup_date,vale_pedagio_incluso)
   VALUES(-900000002000-actor_number,'Teste','SP','Teste','RJ','Teste','TEST000','1','','',false);
  EXCEPTION WHEN insufficient_privilege THEN blocked:=true;
  END;
  IF blocked IS DISTINCT FROM (actor.role IN ('comercial','supervisor')) THEN
   RAISE EXCEPTION 'FAIL: incorrect inclusion insert permission for %',actor.role;
  END IF;
 END LOOP;
END $$;
RESET ROLE;
SELECT 'PASS: Comercial/Supervisor blocked; Admin/Financeiro/Fiscal/Operacional allowed; unchanged false/null preserved' AS result;
