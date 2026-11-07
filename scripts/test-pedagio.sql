-- Candidate migration and this test run within a single rolled-back transaction.
CREATE FUNCTION pg_temp.toll_assert(ok boolean,msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',msg; END IF; END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM toll_actor),true);
SELECT set_config('request.jwt.claims',json_build_object('sub',(SELECT id FROM toll_actor),'role','authenticated')::text,true);
SELECT pg_temp.toll_assert(net_freight_value=700 AND commission_value=175 AND financial_calculation_version=1,'legacy monetary values preserved') FROM public.routes WHERE id IN (SELECT id FROM toll_legacy);
UPDATE public.routes SET observation='Only a note' WHERE id IN (SELECT id FROM toll_legacy);
SELECT pg_temp.toll_assert(net_freight_value=700 AND commission_value=175 AND financial_calculation_version=1,'non-financial edit preserves history') FROM public.routes WHERE id IN (SELECT id FROM toll_legacy);
UPDATE public.routes SET driver_value=driver_value WHERE id IN (SELECT id FROM toll_legacy);
SELECT pg_temp.toll_assert(driver_value=300 AND net_freight_value=650 AND commission_value=162.5 AND financial_calculation_version=2,'financial save switches to new rule') FROM public.routes WHERE id IN (SELECT id FROM toll_legacy);
UPDATE public.routes SET driver_value=driver_value WHERE id IN (SELECT id FROM toll_legacy);
SELECT pg_temp.toll_assert(driver_value=300 AND net_freight_value=650,'repeat save never doubles toll') FROM public.routes WHERE id IN (SELECT id FROM toll_legacy);
UPDATE public.routes SET vale_pedagio_incluso=true WHERE id IN (SELECT id FROM toll_legacy);
SELECT pg_temp.toll_assert(net_freight_value=700 AND commission_value=175,'included toll has no financial effect') FROM public.routes WHERE id IN (SELECT id FROM toll_legacy);
UPDATE public.routes SET taxes_value=100,seguro_value=2,vale_pedagio_incluso=false WHERE id IN (SELECT id FROM toll_legacy);
SELECT pg_temp.toll_assert(net_freight_value=548 AND commission_value=137,'manual tax and insurance preserved') FROM public.routes WHERE id IN (SELECT id FROM toll_legacy);
DO $$ DECLARE r public.routes; BEGIN
 INSERT INTO public.routes(freight_id,origin,origin_state,destination,destination_state,vehicle,plate,weight,estimated_delivery,pickup_date,
  freight_value,driver_value,taxes_percent,seguro_percent,vale_pedagio,vale_pedagio_incluso)
 VALUES(-900000000198,'Teste','SP','Teste','RJ','Teste','TEST000','1','','',1000,300,0,0,50,false) RETURNING * INTO r;
 PERFORM pg_temp.toll_assert(r.net_freight_value=650 AND r.driver_value=300 AND r.financial_calculation_version=2,'new freight uses rule without changing driver base');
END $$;
RESET ROLE;
SELECT 'PASS: historical preservation, financial/non-financial edits, included/non-included, repeated saves, manual overrides and inserts' AS result;
