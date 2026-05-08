-- Corrige RLS de routes para permitir que usuários do painel atualizem fretes.
-- O bloqueio acontecia no WITH CHECK quando a rota tinha created_by_user_id
-- diferente do usuário logado ou quando policies antigas ainda usavam "operator".

DROP POLICY IF EXISTS "Admins and operators can modify routes" ON public.routes;
DROP POLICY IF EXISTS "Admins and operators can insert routes" ON public.routes;
DROP POLICY IF EXISTS "Admins and operators can update routes" ON public.routes;
DROP POLICY IF EXISTS "Admins and operators can delete routes" ON public.routes;

CREATE POLICY "Admins and operators can insert routes" ON public.routes
  FOR INSERT
  WITH CHECK (
    public.current_user_has_any_role(ARRAY['admin', 'comercial']::text[])
    AND (
      created_by_user_id IS NULL
      OR created_by_user_id = auth.uid()
    )
  );

CREATE POLICY "Admins and operators can update routes" ON public.routes
  FOR UPDATE
  USING (
    public.current_user_has_any_role(ARRAY['admin', 'comercial']::text[])
  )
  WITH CHECK (
    public.current_user_has_any_role(ARRAY['admin', 'comercial']::text[])
  );

CREATE POLICY "Admins and operators can delete routes" ON public.routes
  FOR DELETE
  USING (
    public.current_user_has_any_role(ARRAY['admin', 'comercial']::text[])
  );
