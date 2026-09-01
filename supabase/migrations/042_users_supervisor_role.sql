-- 042 - Perfil supervisor somente leitura na Performance
-- Supervisor acessa o painel e enxerga Performance global com filtros,
-- mas nao herda permissoes de escrita nem acesso ao Controle Financeiro.

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'comercial', 'financeiro', 'fiscal', 'supervisor', 'driver'));

CREATE OR REPLACE FUNCTION public.is_global_performance_viewer()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
STABLE
AS $$
  SELECT public.current_user_has_any_role(ARRAY['admin', 'financeiro', 'fiscal', 'supervisor']::text[]);
$$;

REVOKE ALL ON FUNCTION public.is_global_performance_viewer() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_global_performance_viewer() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_global_performance_viewer() TO service_role;

DROP POLICY IF EXISTS "Routes - select scoped" ON public.routes;
CREATE POLICY "Routes - select scoped" ON public.routes
  FOR SELECT
  USING (
    public.is_global_performance_viewer()
    OR (
      public.is_comercial()
      AND created_by_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.drivers d
      WHERE d.id = public.routes.driver_id
        AND d.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users - select self or admin" ON public.users;
CREATE POLICY "Users - select self or admin" ON public.users
  FOR SELECT
  USING (
    auth.uid() = id
    OR public.is_global_performance_viewer()
    OR public.current_user_has_any_role(ARRAY['admin']::text[])
  );
