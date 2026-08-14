-- 029_transfer_selected_routes_clients_to_agapeadm.sql
-- Objetivo:
-- - Transferir ownership (created_by_user_id) das rotas de freight_id 25, 14, 13, 10
--   para o usuário agapetransportes.adm@gmail.com.
-- - Transferir também os clientes vinculados a essas rotas (match por company_name).

DO $$
DECLARE
  target_email TEXT := 'agapetransportes.adm@gmail.com';
  target_user_id UUID;
  selected_freight_ids INT[] := ARRAY[25, 14, 13, 10];
  moved_routes_count INT := 0;
  moved_clients_count INT := 0;
BEGIN
  SELECT u.id
    INTO target_user_id
  FROM public.users u
  WHERE lower(u.email) = lower(target_email)
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário destino não encontrado em public.users: %', target_email;
  END IF;

  WITH moved_routes AS (
    UPDATE public.routes r
       SET created_by_user_id = target_user_id
     WHERE r.freight_id = ANY(selected_freight_ids)
     RETURNING r.id
  )
  SELECT COUNT(*) INTO moved_routes_count
  FROM moved_routes;

  WITH selected_companies AS (
    SELECT DISTINCT trim(r.company_name) AS company_name
      FROM public.routes r
     WHERE r.freight_id = ANY(selected_freight_ids)
       AND r.company_name IS NOT NULL
       AND trim(r.company_name) <> ''
  ),
  moved_clients AS (
    UPDATE public.clients c
       SET created_by_user_id = target_user_id
     WHERE EXISTS (
       SELECT 1
         FROM selected_companies sc
        WHERE lower(trim(c.company_name)) = lower(sc.company_name)
     )
     RETURNING c.id
  )
  SELECT COUNT(*) INTO moved_clients_count
  FROM moved_clients;

  RAISE NOTICE 'Transferência concluída para %', target_email;
  RAISE NOTICE 'Rotas atualizadas: %', moved_routes_count;
  RAISE NOTICE 'Clientes atualizados: %', moved_clients_count;
END $$;

