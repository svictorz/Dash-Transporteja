-- Define os super admins atuais do sistema.
-- Estes e-mails podem gerenciar permissoes e manter acesso administrativo irrestrito.

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT lower(trim(auth.jwt() ->> 'email')) = ANY (ARRAY[
    'transporteja00@gmail.com',
    'jcnlogtransportes@gmail.com',
    'joaovictorpaiva89@gmail.com'
  ]::text[]);
$$;

REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO service_role;

UPDATE public.users
SET role = 'admin'
WHERE lower(trim(email)) = ANY (ARRAY[
  'jcnlogtransportes@gmail.com',
  'joaovictorpaiva89@gmail.com'
]::text[]);
