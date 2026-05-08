-- ============================================================
-- 015 - ROLE 'financeiro' + ISOLAMENTO POR USUÁRIO (COMERCIAL)
-- ============================================================
-- Objetivos:
--  1) Adicionar role 'financeiro' ao CHECK de public.users.role.
--  2) Garantir que clients/drivers/routes/calendar_events tenham
--     coluna `created_by_user_id` (responsável pelo registro).
--  3) Reescrever as RLS para que:
--       - admin / financeiro:  veem e modificam tudo (igual entre si)
--       - comercial:           vê e modifica APENAS os seus próprios
--                              (created_by_user_id = auth.uid())
--       - registros legados sem dono (created_by_user_id IS NULL):
--                              só admin/financeiro veem
--  4) Permitir que admin altere o role de qualquer usuário.
--
-- Idempotente: pode ser executado mais de uma vez sem efeito colateral.

-- ------------------------------------------------------------
-- 1) ROLE 'financeiro' no CHECK
-- ------------------------------------------------------------
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'comercial', 'financeiro', 'driver'));

-- ------------------------------------------------------------
-- 2) created_by_user_id em clients e drivers
-- ------------------------------------------------------------
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- Default = usuário logado (preenche automático em novos inserts)
ALTER TABLE public.clients ALTER COLUMN created_by_user_id SET DEFAULT auth.uid();
ALTER TABLE public.drivers ALTER COLUMN created_by_user_id SET DEFAULT auth.uid();
ALTER TABLE public.routes  ALTER COLUMN created_by_user_id SET DEFAULT auth.uid();

CREATE INDEX IF NOT EXISTS idx_clients_created_by_user_id ON public.clients(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_drivers_created_by_user_id ON public.drivers(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_routes_created_by_user_id  ON public.routes(created_by_user_id);

-- ------------------------------------------------------------
-- 3) Helpers de role
-- ------------------------------------------------------------
-- (current_user_has_any_role já existe, vinda da migration 008)

CREATE OR REPLACE FUNCTION public.is_admin_or_financeiro()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
STABLE
AS $$
  SELECT public.current_user_has_any_role(ARRAY['admin', 'financeiro']::text[]);
$$;

CREATE OR REPLACE FUNCTION public.is_comercial()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
STABLE
AS $$
  SELECT public.current_user_has_any_role(ARRAY['comercial']::text[]);
$$;

-- ------------------------------------------------------------
-- 4) RLS - public.routes
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

-- SELECT: admin/financeiro veem tudo; comercial vê só os seus.
CREATE POLICY "Routes - select scoped" ON public.routes
  FOR SELECT
  USING (
    public.is_admin_or_financeiro()
    OR (
      public.is_comercial()
      AND created_by_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.drivers d
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

-- UPDATE
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

-- DELETE
CREATE POLICY "Routes - delete scoped" ON public.routes
  FOR DELETE
  USING (
    public.is_admin_or_financeiro()
    OR (public.is_comercial() AND created_by_user_id = auth.uid())
  );

-- ------------------------------------------------------------
-- 5) RLS - public.clients
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read clients" ON public.clients;
DROP POLICY IF EXISTS "Admins and operators can modify clients" ON public.clients;
DROP POLICY IF EXISTS "Clients - select scoped" ON public.clients;
DROP POLICY IF EXISTS "Clients - insert scoped" ON public.clients;
DROP POLICY IF EXISTS "Clients - update scoped" ON public.clients;
DROP POLICY IF EXISTS "Clients - delete scoped" ON public.clients;

CREATE POLICY "Clients - select scoped" ON public.clients
  FOR SELECT
  USING (
    public.is_admin_or_financeiro()
    OR (public.is_comercial() AND created_by_user_id = auth.uid())
  );

CREATE POLICY "Clients - insert scoped" ON public.clients
  FOR INSERT
  WITH CHECK (
    public.is_admin_or_financeiro()
    OR (
      public.is_comercial()
      AND (created_by_user_id IS NULL OR created_by_user_id = auth.uid())
    )
  );

CREATE POLICY "Clients - update scoped" ON public.clients
  FOR UPDATE
  USING (
    public.is_admin_or_financeiro()
    OR (public.is_comercial() AND created_by_user_id = auth.uid())
  )
  WITH CHECK (
    public.is_admin_or_financeiro()
    OR (public.is_comercial() AND created_by_user_id = auth.uid())
  );

CREATE POLICY "Clients - delete scoped" ON public.clients
  FOR DELETE
  USING (
    public.is_admin_or_financeiro()
    OR (public.is_comercial() AND created_by_user_id = auth.uid())
  );

-- ------------------------------------------------------------
-- 6) RLS - public.drivers
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read drivers" ON public.drivers;
DROP POLICY IF EXISTS "Admins and operators can modify drivers" ON public.drivers;
DROP POLICY IF EXISTS "Drivers - select scoped" ON public.drivers;
DROP POLICY IF EXISTS "Drivers - insert scoped" ON public.drivers;
DROP POLICY IF EXISTS "Drivers - update scoped" ON public.drivers;
DROP POLICY IF EXISTS "Drivers - delete scoped" ON public.drivers;

CREATE POLICY "Drivers - select scoped" ON public.drivers
  FOR SELECT
  USING (
    public.is_admin_or_financeiro()
    OR (public.is_comercial() AND created_by_user_id = auth.uid())
    OR (user_id = auth.uid()) -- motorista vê o próprio cadastro
  );

CREATE POLICY "Drivers - insert scoped" ON public.drivers
  FOR INSERT
  WITH CHECK (
    public.is_admin_or_financeiro()
    OR (
      public.is_comercial()
      AND (created_by_user_id IS NULL OR created_by_user_id = auth.uid())
    )
  );

CREATE POLICY "Drivers - update scoped" ON public.drivers
  FOR UPDATE
  USING (
    public.is_admin_or_financeiro()
    OR (public.is_comercial() AND created_by_user_id = auth.uid())
  )
  WITH CHECK (
    public.is_admin_or_financeiro()
    OR (public.is_comercial() AND created_by_user_id = auth.uid())
  );

CREATE POLICY "Drivers - delete scoped" ON public.drivers
  FOR DELETE
  USING (
    public.is_admin_or_financeiro()
    OR (public.is_comercial() AND created_by_user_id = auth.uid())
  );

-- ------------------------------------------------------------
-- 7) RLS - public.calendar_events
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Admins and operators can modify calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Calendar - select scoped" ON public.calendar_events;
DROP POLICY IF EXISTS "Calendar - insert scoped" ON public.calendar_events;
DROP POLICY IF EXISTS "Calendar - update scoped" ON public.calendar_events;
DROP POLICY IF EXISTS "Calendar - delete scoped" ON public.calendar_events;

CREATE POLICY "Calendar - select scoped" ON public.calendar_events
  FOR SELECT
  USING (
    public.is_admin_or_financeiro()
    OR (public.is_comercial() AND created_by_user_id = auth.uid())
  );

CREATE POLICY "Calendar - insert scoped" ON public.calendar_events
  FOR INSERT
  WITH CHECK (
    public.is_admin_or_financeiro()
    OR (
      public.is_comercial()
      AND (created_by_user_id IS NULL OR created_by_user_id = auth.uid())
    )
  );

CREATE POLICY "Calendar - update scoped" ON public.calendar_events
  FOR UPDATE
  USING (
    public.is_admin_or_financeiro()
    OR (public.is_comercial() AND created_by_user_id = auth.uid())
  )
  WITH CHECK (
    public.is_admin_or_financeiro()
    OR (public.is_comercial() AND created_by_user_id = auth.uid())
  );

CREATE POLICY "Calendar - delete scoped" ON public.calendar_events
  FOR DELETE
  USING (
    public.is_admin_or_financeiro()
    OR (public.is_comercial() AND created_by_user_id = auth.uid())
  );

-- ------------------------------------------------------------
-- 8) RLS - public.users (admin pode listar/atualizar role)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read own data" ON public.users;
DROP POLICY IF EXISTS "Admins can read all users" ON public.users;
DROP POLICY IF EXISTS "Users - select self or admin" ON public.users;
DROP POLICY IF EXISTS "Users - update self" ON public.users;
DROP POLICY IF EXISTS "Users - admin update" ON public.users;

-- Cada usuário vê o próprio registro; admin vê todos.
CREATE POLICY "Users - select self or admin" ON public.users
  FOR SELECT
  USING (
    auth.uid() = id
    OR public.is_admin_or_financeiro()
    OR public.current_user_has_any_role(ARRAY['admin']::text[])
  );

-- Cada usuário pode atualizar o próprio registro (sem mexer em role).
CREATE POLICY "Users - update self" ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admin pode atualizar qualquer usuário (incluindo o role).
CREATE POLICY "Users - admin update" ON public.users
  FOR UPDATE
  USING (public.current_user_has_any_role(ARRAY['admin']::text[]))
  WITH CHECK (public.current_user_has_any_role(ARRAY['admin']::text[]));

-- ============================================================
-- FIM
-- ============================================================
