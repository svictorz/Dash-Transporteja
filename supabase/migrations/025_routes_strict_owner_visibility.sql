-- ============================================================
-- 025 - ROUTES: VISIBILIDADE E EDIÇÃO APENAS DO CRIADOR
-- ============================================================
-- Objetivo:
--   Garantir que qualquer usuário do painel (admin, financeiro, comercial)
--   veja/edite/exclua apenas rotas com created_by_user_id = auth.uid().
--   Motoristas continuam lendo somente rotas vinculadas ao próprio driver.
--
-- Observação:
--   Esta migração endurece o RLS da tabela public.routes.
--   Se houver necessidade de visão global em relatórios, use consultas
--   server-side com papel de serviço (não via cliente autenticado comum).

-- ------------------------------------------------------------
-- Limpa políticas antigas da tabela routes
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read routes" ON public.routes;
DROP POLICY IF EXISTS "Admins and operators can modify routes" ON public.routes;
DROP POLICY IF EXISTS "Admins and operators can insert routes" ON public.routes;
DROP POLICY IF EXISTS "Admins and operators can update routes" ON public.routes;
DROP POLICY IF EXISTS "Admins and operators can delete routes" ON public.routes;
DROP POLICY IF EXISTS "Drivers can read own routes" ON public.routes;
DROP POLICY IF EXISTS "Routes - select scoped" ON public.routes;
DROP POLICY IF EXISTS "Routes - insert scoped" ON public.routes;
DROP POLICY IF EXISTS "Routes - update scoped" ON public.routes;
DROP POLICY IF EXISTS "Routes - delete scoped" ON public.routes;
DROP POLICY IF EXISTS "Routes - select owner-only" ON public.routes;
DROP POLICY IF EXISTS "Routes - insert owner-only" ON public.routes;
DROP POLICY IF EXISTS "Routes - update owner-only" ON public.routes;
DROP POLICY IF EXISTS "Routes - delete owner-only" ON public.routes;

-- ------------------------------------------------------------
-- SELECT: usuário do painel vê apenas os próprios fretes
-- ------------------------------------------------------------
CREATE POLICY "Routes - select owner-only" ON public.routes
  FOR SELECT
  USING (
    (
      public.current_user_has_any_role(
        ARRAY['admin', 'financeiro', 'comercial']::text[]
      )
      AND created_by_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.drivers d
      WHERE d.id = public.routes.driver_id
        AND d.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- INSERT: apenas criando como próprio usuário
-- ------------------------------------------------------------
CREATE POLICY "Routes - insert owner-only" ON public.routes
  FOR INSERT
  WITH CHECK (
    public.current_user_has_any_role(
      ARRAY['admin', 'financeiro', 'comercial']::text[]
    )
    AND (created_by_user_id IS NULL OR created_by_user_id = auth.uid())
  );

-- ------------------------------------------------------------
-- UPDATE: apenas o próprio criador
-- ------------------------------------------------------------
CREATE POLICY "Routes - update owner-only" ON public.routes
  FOR UPDATE
  USING (
    public.current_user_has_any_role(
      ARRAY['admin', 'financeiro', 'comercial']::text[]
    )
    AND created_by_user_id = auth.uid()
  )
  WITH CHECK (
    public.current_user_has_any_role(
      ARRAY['admin', 'financeiro', 'comercial']::text[]
    )
    AND created_by_user_id = auth.uid()
  );

-- ------------------------------------------------------------
-- DELETE: apenas o próprio criador
-- ------------------------------------------------------------
CREATE POLICY "Routes - delete owner-only" ON public.routes
  FOR DELETE
  USING (
    public.current_user_has_any_role(
      ARRAY['admin', 'financeiro', 'comercial']::text[]
    )
    AND created_by_user_id = auth.uid()
  );

