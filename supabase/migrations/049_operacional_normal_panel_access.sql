-- Operacional has the normal owner's workflow, plus limited cross-owner editing.
-- Keep all existing role membership and policies intact; only add operacional.
CREATE OR REPLACE FUNCTION public.is_owner_scoped_writer()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=public SET row_security=off AS $$
 SELECT public.current_user_has_any_role(ARRAY['comercial','supervisor','operacional']::text[]);
$$;

CREATE POLICY "Clients - operacional insert" ON public.clients FOR INSERT TO authenticated
WITH CHECK (public.current_user_has_any_role(ARRAY['operacional']::text[])
 AND created_by_user_id=auth.uid());

CREATE POLICY "Drivers - operacional own" ON public.drivers FOR ALL TO authenticated
USING (public.current_user_has_any_role(ARRAY['operacional']::text[])
 AND created_by_user_id=auth.uid())
WITH CHECK (public.current_user_has_any_role(ARRAY['operacional']::text[])
 AND created_by_user_id=auth.uid());

-- On their own freights, retain the normal Comercial workflow (Rotas).
-- Foreign freights still pass through the exact whitelist from migration 048.
-- Changing ownership also runs the guard, preventing bypass by reassignment.
DROP TRIGGER routes_guard_operacional_trigger ON public.routes;
CREATE TRIGGER routes_guard_operacional_trigger BEFORE UPDATE ON public.routes
 FOR EACH ROW WHEN (OLD.created_by_user_id IS DISTINCT FROM auth.uid()
  OR NEW.created_by_user_id IS DISTINCT FROM OLD.created_by_user_id)
 EXECUTE FUNCTION public.routes_guard_operacional();

NOTIFY pgrst, 'reload schema';
