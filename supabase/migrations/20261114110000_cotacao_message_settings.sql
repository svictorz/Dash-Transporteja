-- Configuração compartilhada das mensagens. Não altera cotações nem análises existentes.
CREATE TABLE public.erp_message_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  templates jsonb NOT NULL,
  updated_by uuid NOT NULL REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(templates) = 'object')
);

ALTER TABLE public.erp_message_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.erp_message_settings FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.erp_message_settings TO authenticated;
CREATE POLICY erp_message_settings_read ON public.erp_message_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY erp_message_settings_insert ON public.erp_message_settings FOR INSERT TO authenticated
  WITH CHECK (updated_by = (SELECT auth.uid()) AND (SELECT public.current_user_has_any_role(ARRAY['admin']::text[])));
CREATE POLICY erp_message_settings_update ON public.erp_message_settings FOR UPDATE TO authenticated
  USING ((SELECT public.current_user_has_any_role(ARRAY['admin']::text[])))
  WITH CHECK (updated_by = (SELECT auth.uid()) AND (SELECT public.current_user_has_any_role(ARRAY['admin']::text[])));

NOTIFY pgrst, 'reload schema';
