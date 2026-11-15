-- Títulos editáveis das mensagens; preserva todos os corpos já salvos.
ALTER TABLE public.erp_message_settings
  ADD COLUMN titles jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.erp_message_settings
  ADD CONSTRAINT erp_message_settings_titles_object CHECK (jsonb_typeof(titles) = 'object');

NOTIFY pgrst, 'reload schema';
