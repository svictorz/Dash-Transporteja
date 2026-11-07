-- Restrict only the indicator. Monetary calculations and existing values stay intact.
CREATE FUNCTION public.routes_guard_toll_inclusion_role() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF public.current_user_has_any_role(ARRAY['comercial','supervisor']::text[]) THEN
  IF TG_OP='INSERT' THEN
   IF NEW.vale_pedagio_incluso IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Comercial e Supervisor não podem alterar Incluso/Não incluso do vale-pedágio.' USING ERRCODE='42501';
   END IF;
  ELSIF NEW.vale_pedagio_incluso IS DISTINCT FROM OLD.vale_pedagio_incluso THEN
   RAISE EXCEPTION 'Comercial e Supervisor não podem alterar Incluso/Não incluso do vale-pedágio.' USING ERRCODE='42501';
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.routes_guard_toll_inclusion_role() FROM PUBLIC;
CREATE TRIGGER routes_guard_toll_inclusion_role_trigger
 BEFORE INSERT OR UPDATE OF vale_pedagio_incluso ON public.routes
 FOR EACH ROW EXECUTE FUNCTION public.routes_guard_toll_inclusion_role();
