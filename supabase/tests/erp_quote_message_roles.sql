-- Executar com psql após a migração; a alteração de teste é revertida.
BEGIN;
SELECT id AS message_test_user FROM public.users WHERE role = 'comercial' LIMIT 1 \gset
SELECT set_config('request.jwt.claim.sub', :'message_test_user', true) \gset
SELECT set_config('request.jwt.claim.role', 'authenticated', true) \gset
SET LOCAL ROLE authenticated;
DO $$
DECLARE changed_rows integer;
BEGIN
  INSERT INTO public.erp_message_settings (id, templates, titles, updated_by)
  VALUES (1, '{}'::jsonb, '{}'::jsonb, auth.uid())
  ON CONFLICT (id) DO UPDATE SET
    templates = EXCLUDED.templates,
    titles = EXCLUDED.titles,
    updated_by = EXCLUDED.updated_by;
  GET DIAGNOSTICS changed_rows = ROW_COUNT;
  IF changed_rows <> 1 THEN
    RAISE EXCEPTION 'Comercial não conseguiu salvar as mensagens';
  END IF;
END $$;
ROLLBACK;
