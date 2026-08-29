-- 041 - Perfil fiscal com acesso amplo de admin/financeiro
-- Libera o role fiscal e o inclui no mesmo helper de escopo usado por admin/financeiro.

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'comercial', 'financeiro', 'fiscal', 'driver'));

CREATE OR REPLACE FUNCTION public.is_admin_or_financeiro()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
STABLE
AS $$
  SELECT public.current_user_has_any_role(ARRAY['admin', 'financeiro', 'fiscal']::text[]);
$$;

REVOKE ALL ON FUNCTION public.is_admin_or_financeiro() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_or_financeiro() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_financeiro() TO service_role;

DROP POLICY IF EXISTS "Admins and financeiro manage all checkin-photos" ON storage.objects;
CREATE POLICY "Admins and financeiro manage all checkin-photos"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'checkin-photos'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'financeiro', 'fiscal')
    )
  )
  WITH CHECK (
    bucket_id = 'checkin-photos'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'financeiro', 'fiscal')
    )
  );
