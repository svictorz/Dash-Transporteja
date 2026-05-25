-- ============================================================
-- 026 - ROUTES: RESTAURA ESCOPO ADMIN/FINANCEIRO (VISÃO GLOBAL)
-- ============================================================
-- Correção:
--   Reverte a policy "owner-only" da migration 025 para o comportamento
--   esperado na performance:
--     - admin / financeiro: veem e modificam todos os fretes
--     - comercial: vê e modifica apenas os próprios fretes
--     - motorista: mantém leitura via vínculo no driver

-- Limpa policies antigas de routes
DROP POLICY IF EXISTS "Authenticated users can read routes" ON public.routes;
DROP POLICY IF EXISTS "Admins and operators can modify routes" ON public.routes;
DROP POLICY IF EXISTS "Admins and operators can insert routes" ON public.routes;
DROP POLICY IF EXISTS "Admins and operators can update routes" ON public.routes;
DROP POLICY IF EXISTS "Admins and operators can delete routes" ON public.routes;
DROP POLICY IF EXISTS "Drivers can read own routes" ON public.routes;
DROP POLICY IF EXISTS "Routes - select owner-only" ON public.routes;
DROP POLICY IF EXISTS "Routes - insert owner-only" ON public.routes;
DROP POLICY IF EXISTS "Routes - update owner-only" ON public.routes;
DROP POLICY IF EXISTS "Routes - delete owner-only" ON public.routes;
DROP POLICY IF EXISTS "Routes - select scoped" ON public.routes;
DROP POLICY IF EXISTS "Routes - insert scoped" ON public.routes;
DROP POLICY IF EXISTS "Routes - update scoped" ON public.routes;
DROP POLICY IF EXISTS "Routes - delete scoped" ON public.routes;

-- SELECT: admin/financeiro veem tudo; comercial vê só os próprios.
-- Motorista mantém leitura por vínculo no driver.
CREATE POLICY "Routes - select scoped" ON public.routes
  FOR SELECT
  USING (
    public.is_admin_or_financeiro()
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

-- INSERT: admin/financeiro qualquer; comercial só com ele mesmo como dono.
CREATE POLICY "Routes - insert scoped" ON public.routes
  FOR INSERT
  WITH CHECK (
    public.is_admin_or_financeiro()
    OR (
      public.is_comercial()
      AND (created_by_user_id IS NULL OR created_by_user_id = auth.uid())
    )
  );

-- UPDATE: admin/financeiro qualquer; comercial só os próprios.
CREATE POLICY "Routes - update scoped" ON public.routes
  FOR UPDATE
  USING (
    public.is_admin_or_financeiro()
    OR (public.is_comercial() AND created_by_user_id = auth.uid())
  )
  WITH CHECK (
    public.is_admin_or_financeiro()
    OR (public.is_comercial() AND created_by_user_id = auth.uid())
  );

-- DELETE: admin/financeiro qualquer; comercial só os próprios.
CREATE POLICY "Routes - delete scoped" ON public.routes
  FOR DELETE
  USING (
    public.is_admin_or_financeiro()
    OR (public.is_comercial() AND created_by_user_id = auth.uid())
  );

