CREATE OR REPLACE FUNCTION public.update_route_observation(
  p_route_id uuid,
  p_observation text
)
RETURNS public.routes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_route public.routes;
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING ERRCODE = '42501';
  END IF;

  SELECT role INTO v_role
  FROM public.users
  WHERE id = auth.uid();

  IF v_role NOT IN ('admin', 'financeiro', 'fiscal') THEN
    RAISE EXCEPTION 'Sem permissão para editar observações.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.routes
  SET observation = NULLIF(btrim(p_observation), '')
  WHERE id = p_route_id
  RETURNING * INTO v_route;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Frete não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_route;
END;
$$;

REVOKE ALL ON FUNCTION public.update_route_observation(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_route_observation(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_route_observation(uuid, text) TO authenticated;
