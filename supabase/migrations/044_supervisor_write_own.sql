-- ============================================================
-- 044 - SUPERVISOR ESCREVE OS PRÓPRIOS REGISTROS
-- ============================================================
-- Contexto:
--   A migration 042 criou o perfil `supervisor` como somente leitura
--   ("nao herda permissoes de escrita") e liberou apenas o SELECT global
--   de routes. Depois, o app passou a dar ao supervisor acesso às telas
--   operacionais (Rotas, Clientes, Calendário), mas o banco continuou
--   recusando a escrita:
--
--     new row violates row-level security policy for table "routes"
--
-- Decisão:
--   Supervisor passa a criar e editar APENAS os próprios registros —
--   mesmo escopo do comercial. Ele continua enxergando a Performance
--   global (042), mas não ganha escrita sobre o frete dos outros.
--
--   Nenhum outro perfil muda de permissão nesta migration.
--
-- Idempotente: pode ser executado mais de uma vez sem efeito colateral.

-- ------------------------------------------------------------
-- 1) Helper: perfis cuja escrita é limitada ao próprio registro
-- ------------------------------------------------------------
-- Espelhado no app por `shouldScopeOperationalDataToOwner()`
-- em lib/utils/roles.ts. Ao mudar um, mude o outro.
CREATE OR REPLACE FUNCTION public.is_owner_scoped_writer()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
STABLE
AS $$
  SELECT public.current_user_has_any_role(ARRAY['comercial', 'supervisor']::text[]);
$$;

REVOKE ALL ON FUNCTION public.is_owner_scoped_writer() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_owner_scoped_writer() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_owner_scoped_writer() TO service_role;

-- ------------------------------------------------------------
-- 2) ROUTES — escrita (o SELECT continua o da 042, global)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Routes - insert scoped" ON public.routes;
CREATE POLICY "Routes - insert scoped" ON public.routes
  FOR INSERT
  WITH CHECK (
    public.is_admin_or_financeiro()
    OR (
      public.is_owner_scoped_writer()
      AND (created_by_user_id IS NULL OR created_by_user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Routes - update scoped" ON public.routes;
CREATE POLICY "Routes - update scoped" ON public.routes
  FOR UPDATE
  USING (
    public.is_admin_or_financeiro()
    OR (public.is_owner_scoped_writer() AND created_by_user_id = auth.uid())
  )
  WITH CHECK (
    public.is_admin_or_financeiro()
    OR (public.is_owner_scoped_writer() AND created_by_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Routes - delete scoped" ON public.routes;
CREATE POLICY "Routes - delete scoped" ON public.routes
  FOR DELETE
  USING (
    public.is_admin_or_financeiro()
    OR (public.is_owner_scoped_writer() AND created_by_user_id = auth.uid())
  );

-- ------------------------------------------------------------
-- 3) CLIENTS — necessário: criar frete chama ensureClientFromRoute
-- ------------------------------------------------------------
-- Mantém a regra da 023 (isolamento por dono, legados sem dono só para
-- admin/financeiro/fiscal) e acrescenta o supervisor ao ramo do dono.
-- `fiscal` continua sem criar cliente, como já era antes desta migration.
DROP POLICY IF EXISTS "Clients - select isolated" ON public.clients;
CREATE POLICY "Clients - select isolated" ON public.clients
  FOR SELECT
  USING (
    (public.is_owner_scoped_writer() AND created_by_user_id = auth.uid())
    OR (
      public.is_admin_or_financeiro()
      AND (created_by_user_id = auth.uid() OR created_by_user_id IS NULL)
    )
  );

DROP POLICY IF EXISTS "Clients - insert isolated" ON public.clients;
CREATE POLICY "Clients - insert isolated" ON public.clients
  FOR INSERT
  WITH CHECK (
    public.current_user_has_any_role(
      ARRAY['admin', 'financeiro', 'comercial', 'supervisor']::text[]
    )
    AND (created_by_user_id IS NULL OR created_by_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Clients - update isolated" ON public.clients;
CREATE POLICY "Clients - update isolated" ON public.clients
  FOR UPDATE
  USING (
    (public.is_owner_scoped_writer() AND created_by_user_id = auth.uid())
    OR (
      public.is_admin_or_financeiro()
      AND (created_by_user_id = auth.uid() OR created_by_user_id IS NULL)
    )
  )
  WITH CHECK (
    (public.is_owner_scoped_writer() AND created_by_user_id = auth.uid())
    OR (
      public.is_admin_or_financeiro()
      AND (created_by_user_id = auth.uid() OR created_by_user_id IS NULL)
    )
  );

DROP POLICY IF EXISTS "Clients - delete isolated" ON public.clients;
CREATE POLICY "Clients - delete isolated" ON public.clients
  FOR DELETE
  USING (
    (public.is_owner_scoped_writer() AND created_by_user_id = auth.uid())
    OR (
      public.is_admin_or_financeiro()
      AND (created_by_user_id = auth.uid() OR created_by_user_id IS NULL)
    )
  );

-- ------------------------------------------------------------
-- 4) CALENDAR_EVENTS — mesma regra da 015, agora com supervisor
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Calendar - select scoped" ON public.calendar_events;
CREATE POLICY "Calendar - select scoped" ON public.calendar_events
  FOR SELECT
  USING (
    public.is_admin_or_financeiro()
    OR (public.is_owner_scoped_writer() AND created_by_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Calendar - insert scoped" ON public.calendar_events;
CREATE POLICY "Calendar - insert scoped" ON public.calendar_events
  FOR INSERT
  WITH CHECK (
    public.is_admin_or_financeiro()
    OR (
      public.is_owner_scoped_writer()
      AND (created_by_user_id IS NULL OR created_by_user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Calendar - update scoped" ON public.calendar_events;
CREATE POLICY "Calendar - update scoped" ON public.calendar_events
  FOR UPDATE
  USING (
    public.is_admin_or_financeiro()
    OR (public.is_owner_scoped_writer() AND created_by_user_id = auth.uid())
  )
  WITH CHECK (
    public.is_admin_or_financeiro()
    OR (public.is_owner_scoped_writer() AND created_by_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Calendar - delete scoped" ON public.calendar_events;
CREATE POLICY "Calendar - delete scoped" ON public.calendar_events
  FOR DELETE
  USING (
    public.is_admin_or_financeiro()
    OR (public.is_owner_scoped_writer() AND created_by_user_id = auth.uid())
  );

-- ============================================================
-- FIM
-- ============================================================
