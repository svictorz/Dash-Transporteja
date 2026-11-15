-- Configuração única de frota. Não modifica revisões de preço nem análises anteriores.
CREATE TABLE public.erp_fleet_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  vehicles jsonb NOT NULL CHECK (jsonb_typeof(vehicles) = 'array' AND jsonb_array_length(vehicles) > 0),
  updated_by uuid NOT NULL REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.erp_fleet_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.erp_fleet_settings FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.erp_fleet_settings TO authenticated;
CREATE POLICY erp_fleet_settings_read ON public.erp_fleet_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY erp_fleet_settings_insert ON public.erp_fleet_settings FOR INSERT TO authenticated
  WITH CHECK (updated_by = (SELECT auth.uid()) AND (SELECT public.current_user_has_any_role(ARRAY['admin']::text[])));
CREATE POLICY erp_fleet_settings_update ON public.erp_fleet_settings FOR UPDATE TO authenticated
  USING ((SELECT public.current_user_has_any_role(ARRAY['admin']::text[])))
  WITH CHECK (updated_by = (SELECT auth.uid()) AND (SELECT public.current_user_has_any_role(ARRAY['admin']::text[])));

NOTIFY pgrst, 'reload schema';
