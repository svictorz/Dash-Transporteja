-- Restringe a alteração de role de usuários (gestão de permissões) ao
-- e-mail super admin. Antes, qualquer usuário com role = 'admin' podia
-- alterar a role de qualquer outro usuário via UPDATE em public.users;
-- agora só o dono do sistema (SUPER_ADMIN_EMAIL em lib/utils/roles.ts)
-- pode. Leitura da lista de usuários (admin/financeiro) não muda.

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT lower(trim(auth.jwt() ->> 'email')) = 'transporteja00@gmail.com';
$$;

REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO service_role;

DROP POLICY IF EXISTS "Users - admin update" ON public.users;
CREATE POLICY "Users - admin update" ON public.users
  FOR UPDATE
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
