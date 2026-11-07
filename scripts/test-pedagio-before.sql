CREATE TEMP TABLE toll_actor(id uuid DEFAULT gen_random_uuid());
INSERT INTO toll_actor DEFAULT VALUES;
INSERT INTO auth.users(id,email) SELECT id,id||'@toll-test.invalid' FROM toll_actor;
INSERT INTO public.users(id,email,role,commission_rate) SELECT id,id||'@toll-test.invalid','admin',25 FROM toll_actor
 ON CONFLICT(id) DO UPDATE SET role='admin',commission_rate=25;
CREATE TEMP TABLE toll_legacy(id uuid);
WITH added AS (INSERT INTO public.routes(freight_id,origin,origin_state,destination,destination_state,
 vehicle,plate,weight,estimated_delivery,pickup_date,created_by_user_id,freight_value,nf_value,
 driver_value,taxes_percent,taxes_value,seguro_percent,seguro_value,vale_pedagio,vale_pedagio_incluso,
 net_freight_value,commission_value)
 SELECT -900000000199,'Teste','SP','Teste','RJ','Teste','TEST000','1','','',id,
 1000,1000,300,0,0,0,0,50,false,700,175 FROM toll_actor RETURNING id)
 INSERT INTO toll_legacy SELECT id FROM added;
GRANT SELECT ON toll_actor,toll_legacy TO authenticated;
