-- Evita "infinite recursion detected in policy for relation users":
-- políticas que fazem EXISTS (SELECT ... FROM public.users) reaplicam RLS em users.
-- SECURITY DEFINER + row_security=off: o SELECT em public.users não reaplica RLS
-- (no Supabase, só DEFINER sem isso ainda pode disparar recursão).

CREATE OR REPLACE FUNCTION public.current_user_has_any_role(_roles text[])
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role = ANY (_roles)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.current_user_has_any_role(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_has_any_role(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_has_any_role(text[]) TO service_role;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can read all users" ON public.users;
CREATE POLICY "Admins can read all users" ON public.users
  FOR SELECT
  USING (public.current_user_has_any_role (ARRAY['admin']::text[]));

DROP POLICY IF EXISTS "Admins can update all users" ON public.users;
CREATE POLICY "Admins can update all users" ON public.users
  FOR UPDATE
  USING (public.current_user_has_any_role (ARRAY['admin']::text[]));

-- ---------------------------------------------------------------------------
-- drivers (unifica políticas antigas insert/update/delete/modify)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins and operators can modify drivers" ON public.drivers;
DROP POLICY IF EXISTS "Admins and operators can insert drivers" ON public.drivers;
DROP POLICY IF EXISTS "Admins and operators can update drivers" ON public.drivers;
DROP POLICY IF EXISTS "Admins and operators can delete drivers" ON public.drivers;

CREATE POLICY "Admins and operators can modify drivers" ON public.drivers
  FOR ALL
  USING (
    public.current_user_has_any_role (ARRAY['admin', 'comercial']::text[])
  )
  WITH CHECK (
    public.current_user_has_any_role (ARRAY['admin', 'comercial']::text[])
  );

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins and operators can modify clients" ON public.clients;
DROP POLICY IF EXISTS "Admins and operators can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Admins and operators can update clients" ON public.clients;
DROP POLICY IF EXISTS "Admins and operators can delete clients" ON public.clients;

CREATE POLICY "Admins and operators can modify clients" ON public.clients
  FOR ALL
  USING (
    public.current_user_has_any_role (ARRAY['admin', 'comercial']::text[])
  )
  WITH CHECK (
    public.current_user_has_any_role (ARRAY['admin', 'comercial']::text[])
  );

-- ---------------------------------------------------------------------------
-- routes (mantém regra created_by_user_id da migração 005)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins and operators can modify routes" ON public.routes;
DROP POLICY IF EXISTS "Admins and operators can insert routes" ON public.routes;
DROP POLICY IF EXISTS "Admins and operators can update routes" ON public.routes;
DROP POLICY IF EXISTS "Admins and operators can delete routes" ON public.routes;

CREATE POLICY "Admins and operators can modify routes" ON public.routes
  FOR ALL
  USING (
    public.current_user_has_any_role (ARRAY['admin', 'comercial']::text[])
  )
  WITH CHECK (
    public.current_user_has_any_role (ARRAY['admin', 'comercial']::text[])
    AND (
      created_by_user_id IS NULL
      OR created_by_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- checkins
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins and operators can modify checkins" ON public.checkins;
DROP POLICY IF EXISTS "Admins and operators can update checkins" ON public.checkins;
DROP POLICY IF EXISTS "Admins and operators can delete checkins" ON public.checkins;

CREATE POLICY "Admins and operators can modify checkins" ON public.checkins
  FOR ALL
  USING (
    public.current_user_has_any_role (ARRAY['admin', 'comercial']::text[])
  )
  WITH CHECK (
    public.current_user_has_any_role (ARRAY['admin', 'comercial']::text[])
  );

-- ---------------------------------------------------------------------------
-- calendar_events (requer migração 006 aplicada antes)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins and operators can modify calendar events" ON public.calendar_events;

CREATE POLICY "Admins and operators can modify calendar events" ON public.calendar_events
  FOR ALL
  USING (
    public.current_user_has_any_role (ARRAY['admin', 'comercial']::text[])
  )
  WITH CHECK (
    public.current_user_has_any_role (ARRAY['admin', 'comercial']::text[])
    AND (
      created_by_user_id IS NULL
      OR created_by_user_id = auth.uid()
    )
  );
