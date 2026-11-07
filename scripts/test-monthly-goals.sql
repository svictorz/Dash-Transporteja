-- Execute after the candidate migration inside BEGIN/ROLLBACK, never as persisted fixtures.
CREATE TEMP TABLE goal_actors(role text, id uuid DEFAULT gen_random_uuid());
INSERT INTO goal_actors(role) VALUES ('admin'),('financeiro'),('fiscal'),('operacional'),('comercial'),('supervisor');
INSERT INTO auth.users(id,email) SELECT id,id||'@monthly-goals-test.invalid' FROM goal_actors;
INSERT INTO public.users(id,email,role) SELECT id,id||'@monthly-goals-test.invalid',role FROM goal_actors
  ON CONFLICT(id) DO UPDATE SET role=excluded.role;
GRANT SELECT ON goal_actors TO authenticated;
INSERT INTO public.monthly_sales_goals(user_id,month,amount)
  SELECT id,'2026-11-01',10000 FROM goal_actors;
SET LOCAL ROLE authenticated;
DO $$
DECLARE actor record; visible_count int; affected int; blocked boolean; target uuid;
BEGIN
  SELECT id INTO target FROM goal_actors WHERE role='comercial';
  FOR actor IN SELECT * FROM goal_actors LOOP
    PERFORM set_config('request.jwt.claim.sub',actor.id::text,true);
    PERFORM set_config('request.jwt.claims',json_build_object('sub',actor.id,'role','authenticated')::text,true);
    SELECT count(*) INTO visible_count FROM public.monthly_sales_goals WHERE user_id IN (SELECT id FROM goal_actors);
    IF visible_count <> (CASE WHEN actor.role='admin' THEN 6 ELSE 1 END) THEN RAISE EXCEPTION 'FAIL: goal visibility for %',actor.role; END IF;
    UPDATE public.monthly_sales_goals SET amount=20000 WHERE user_id=actor.id AND month='2026-11-01';
    GET DIAGNOSTICS affected=ROW_COUNT;
    IF affected <> (CASE WHEN actor.role='admin' THEN 1 ELSE 0 END) THEN RAISE EXCEPTION 'FAIL: own goal write for %',actor.role; END IF;
    UPDATE public.monthly_sales_goals SET amount=30000 WHERE user_id=target AND month='2026-11-01';
    GET DIAGNOSTICS affected=ROW_COUNT;
    IF affected <> (CASE WHEN actor.role='admin' THEN 1 ELSE 0 END) THEN RAISE EXCEPTION 'FAIL: foreign goal write for %',actor.role; END IF;
    blocked:=false;
    BEGIN
      INSERT INTO public.monthly_sales_goals(user_id,month,amount) VALUES(actor.id,'2026-12-01',15000);
    EXCEPTION WHEN insufficient_privilege THEN blocked:=true;
    END;
    IF blocked IS DISTINCT FROM (actor.role<>'admin') THEN RAISE EXCEPTION 'FAIL: goal insert for %',actor.role; END IF;
  END LOOP;
END $$;
RESET ROLE;
DO $$
DECLARE target uuid; blocked boolean;
BEGIN
  SELECT id INTO target FROM goal_actors WHERE role='comercial';
  blocked:=false;
  BEGIN INSERT INTO public.monthly_sales_goals VALUES(target,'2027-01-02',10000); EXCEPTION WHEN check_violation THEN blocked:=true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'FAIL: non-month date accepted'; END IF;
  blocked:=false;
  BEGIN INSERT INTO public.monthly_sales_goals VALUES(target,'2027-01-01',0); EXCEPTION WHEN check_violation THEN blocked:=true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'FAIL: zero target accepted'; END IF;
  blocked:=false;
  BEGIN INSERT INTO public.monthly_sales_goals VALUES(target,'2027-01-01','NaN'::numeric); EXCEPTION WHEN check_violation THEN blocked:=true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'FAIL: NaN target accepted'; END IF;
  IF has_table_privilege('anon','public.monthly_sales_goals','SELECT') OR has_table_privilege('anon','public.monthly_sales_goals','INSERT') THEN RAISE EXCEPTION 'FAIL: anonymous goal access'; END IF;
END $$;
SELECT 'PASS: only admin manages monthly goals; each other role reads only its own; invalid targets and anonymous access rejected' AS result;
