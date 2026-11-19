-- Todos os cargos do painel podem editar somente os textos compartilhados da cotação.
-- As políticas de tributos e frota permanecem restritas ao administrador.
DROP POLICY IF EXISTS erp_message_settings_insert ON public.erp_message_settings;
DROP POLICY IF EXISTS erp_message_settings_update ON public.erp_message_settings;

CREATE POLICY erp_message_settings_insert ON public.erp_message_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    updated_by = (SELECT auth.uid())
    AND (SELECT public.current_user_has_any_role(
      ARRAY['admin', 'comercial', 'financeiro', 'fiscal', 'supervisor', 'operacional']::text[]
    ))
  );

CREATE POLICY erp_message_settings_update ON public.erp_message_settings
  FOR UPDATE TO authenticated
  USING ((SELECT public.current_user_has_any_role(
    ARRAY['admin', 'comercial', 'financeiro', 'fiscal', 'supervisor', 'operacional']::text[]
  )))
  WITH CHECK (
    updated_by = (SELECT auth.uid())
    AND (SELECT public.current_user_has_any_role(
      ARRAY['admin', 'comercial', 'financeiro', 'fiscal', 'supervisor', 'operacional']::text[]
    ))
  );

NOTIFY pgrst, 'reload schema';
