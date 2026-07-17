-- Remove agape.jcnlog@gmail.com como super admin. Nenhum e-mail assume o
-- posto por enquanto: is_super_admin() passa a retornar sempre falso, então
-- a policy "Users - admin update" (migration 033) bloqueia qualquer alteração
-- de role via client até um novo dono ser configurado (SUPER_ADMIN_EMAIL em
-- lib/utils/roles.ts + esta função).

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT false;
$$;
