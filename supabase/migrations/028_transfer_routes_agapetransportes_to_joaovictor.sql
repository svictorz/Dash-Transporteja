-- ============================================================
-- 028 - TRANSFERIR ROTAS (AGAPE TRANSPORTES -> JOAO VICTOR)
-- ============================================================
-- Corrige transferência considerando os e-mails de origem possíveis:
--   - agape.jcnlog@gmail.com
--   - agapetransportes.adm@gmail.com
-- Destino:
--   - joaovictorpaiva89@gmail.com

DO $$
DECLARE
  target_user_id uuid;
  updated_count bigint := 0;
  source_email text;
  source_user_id uuid;
  changed_rows bigint;
BEGIN
  SELECT id
    INTO target_user_id
    FROM public.users
   WHERE lower(trim(email)) = lower('joaovictorpaiva89@gmail.com')
   LIMIT 1;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário de destino não encontrado: %', 'joaovictorpaiva89@gmail.com';
  END IF;

  FOREACH source_email IN ARRAY ARRAY[
    'agape.jcnlog@gmail.com',
    'agapetransportes.adm@gmail.com'
  ]
  LOOP
    SELECT id
      INTO source_user_id
      FROM public.users
     WHERE lower(trim(email)) = lower(source_email)
     LIMIT 1;

    IF source_user_id IS NULL THEN
      RAISE NOTICE 'Origem não encontrada (ignorando): %', source_email;
      CONTINUE;
    END IF;

    IF source_user_id = target_user_id THEN
      RAISE NOTICE 'Origem igual ao destino (ignorando): %', source_email;
      CONTINUE;
    END IF;

    UPDATE public.routes
       SET created_by_user_id = target_user_id
     WHERE created_by_user_id = source_user_id;

    GET DIAGNOSTICS changed_rows = ROW_COUNT;
    updated_count := updated_count + changed_rows;

    RAISE NOTICE 'Transferidas % rota(s) de % para %.',
      changed_rows,
      source_email,
      'joaovictorpaiva89@gmail.com';
  END LOOP;

  RAISE NOTICE 'Total transferido: % rota(s).', updated_count;
END $$;

