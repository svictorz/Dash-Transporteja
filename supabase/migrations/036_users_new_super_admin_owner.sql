-- Define transporteja00@gmail.com como novo super admin (dono do sistema),
-- substituindo o estado "sem dono" da migration 035.

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT lower(trim(auth.jwt() ->> 'email')) = 'transporteja00@gmail.com';
$$;
