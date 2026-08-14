-- ============================================================
-- 027 - TRANSFERIR ROTAS ENTRE USUÁRIOS (POR E-MAIL)
-- ============================================================
-- Origem:  agape.jcnlog@gmail.com
-- Destino: joaovictorpaiva89@gmail.com
-- Tarefa:  transferir ownership das rotas (created_by_user_id)

DO $$
DECLARE
  source_user_id uuid;
  target_user_id uuid;
  updated_count bigint;
BEGIN
  SELECT id
    INTO source_user_id
    FROM public.users
   WHERE lower(trim(email)) = lower('agape.jcnlog@gmail.com')
   LIMIT 1;

  SELECT id
    INTO target_user_id
    FROM public.users
   WHERE lower(trim(email)) = lower('joaovictorpaiva89@gmail.com')
   LIMIT 1;

  IF source_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário de origem não encontrado: %', 'agape.jcnlog@gmail.com';
  END IF;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário de destino não encontrado: %', 'joaovictorpaiva89@gmail.com';
  END IF;

  IF source_user_id = target_user_id THEN
    RAISE EXCEPTION 'Origem e destino são o mesmo usuário (%). Operação cancelada.', source_user_id;
  END IF;

  UPDATE public.routes
     SET created_by_user_id = target_user_id
   WHERE created_by_user_id = source_user_id;

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  RAISE NOTICE 'Rotas transferidas de % para %: % registro(s).',
    'agape.jcnlog@gmail.com',
    'joaovictorpaiva89@gmail.com',
    updated_count;
END $$;

