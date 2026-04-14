-- Ajuste para quem já rodou a 008: força bypass de RLS dentro da função.
-- Sem SET row_security = off, o Postgres ainda pode aplicar RLS no SELECT interno.

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
