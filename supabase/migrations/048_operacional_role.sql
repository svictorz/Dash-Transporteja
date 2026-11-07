-- Additive permissions. Existing write helpers and policies stay unchanged.
ALTER TABLE public.users DROP CONSTRAINT users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK
 (role IN ('admin','comercial','financeiro','fiscal','supervisor','driver','operacional'));

CREATE OR REPLACE FUNCTION public.is_global_performance_viewer()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public SET row_security = off AS $$
 SELECT public.current_user_has_any_role(ARRAY['admin','financeiro','fiscal','supervisor','operacional']::text[]);
$$;

CREATE POLICY "Routes - operacional update" ON public.routes FOR UPDATE TO authenticated
USING (public.current_user_has_any_role(ARRAY['operacional']::text[]))
WITH CHECK (public.current_user_has_any_role(ARRAY['operacional']::text[]));

CREATE FUNCTION public.routes_guard_operacional() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
 allowed text[] := ARRAY['cte_value','vale_pedagio','vale_pedagio_incluso','driver_value',
  'taxes_percent','seguro_percent','driver_name','driver_phone','driver_payment_status',
  'driver_payment_type','vehicle','plate','updated_at'];
 base numeric; seller_rate numeric; pct numeric;
BEGIN
 IF NOT public.current_user_has_any_role(ARRAY['operacional']::text[]) THEN RETURN NEW; END IF;
 -- Any new schema column is blocked by default. Derived values cannot be submitted.
 IF (to_jsonb(NEW) - allowed) IS DISTINCT FROM (to_jsonb(OLD) - allowed) THEN
  RAISE EXCEPTION 'Operacional só pode alterar campos financeiros e dados do motorista autorizados.' USING ERRCODE='42501';
 END IF;
 IF NEW.taxes_percent IS DISTINCT FROM OLD.taxes_percent AND
    (NEW.taxes_percent IS NULL OR NEW.taxes_percent NOT IN (0,18)) THEN
  RAISE EXCEPTION 'Alíquota de tributos inválida.' USING ERRCODE='42501';
 END IF;
 IF NEW.seguro_percent IS DISTINCT FROM OLD.seguro_percent AND
    (NEW.seguro_percent IS NULL OR NEW.seguro_percent NOT IN (0,0.2)) THEN
  RAISE EXCEPTION 'Alíquota de seguro inválida.' USING ERRCODE='42501';
 END IF;
 IF NEW.cte_value < 0 OR NEW.vale_pedagio < 0 OR NEW.driver_value < 0
    OR NEW.cte_value::text IN ('NaN','Infinity','-Infinity')
    OR NEW.vale_pedagio::text IN ('NaN','Infinity','-Infinity')
    OR NEW.driver_value::text IN ('NaN','Infinity','-Infinity') THEN
  RAISE EXCEPTION 'Valores financeiros inválidos.' USING ERRCODE='42501';
 END IF;
 IF NEW.driver_payment_status IS DISTINCT FROM OLD.driver_payment_status
    AND NEW.driver_payment_status IS NOT NULL
    AND NEW.driver_payment_status NOT IN ('Pendente','50%','70%','100%') THEN
  RAISE EXCEPTION 'Status de pagamento inválido.' USING ERRCODE='42501';
 END IF;
 IF ROW(NEW.cte_value,NEW.vale_pedagio,NEW.vale_pedagio_incluso,NEW.driver_value,NEW.taxes_percent,NEW.seguro_percent)
  IS DISTINCT FROM ROW(OLD.cte_value,OLD.vale_pedagio,OLD.vale_pedagio_incluso,OLD.driver_value,OLD.taxes_percent,OLD.seguro_percent) THEN
  base := coalesce(NEW.freight_value,NEW.nf_value);
  pct := CASE WHEN NEW.taxes_percent IN (0,10,12,18) THEN NEW.taxes_percent ELSE 18 END;
  -- Same cent rounding as Math.round, including negative freight margins.
  NEW.taxes_value := floor(base * pct + 0.5) / 100;
  NEW.seguro_value := floor(NEW.nf_value * CASE WHEN NEW.seguro_percent=0.2 THEN 0.2 ELSE 0 END + 0.5) / 100;
  NEW.net_freight_value := floor((base - coalesce(NEW.taxes_value,0) - coalesce(NEW.driver_value,0)
   - coalesce(NEW.seguro_value,0) - CASE WHEN NEW.vale_pedagio_incluso IS DISTINCT FROM false
    THEN coalesce(NEW.vale_pedagio,0) ELSE 0 END) * 100 + 0.5) / 100;
  SELECT commission_rate INTO seller_rate FROM public.users WHERE id=NEW.created_by_user_id;
  NEW.commission_value := floor(NEW.net_freight_value * coalesce(seller_rate,30) + 0.5) / 100;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.routes_guard_operacional() FROM PUBLIC;
CREATE TRIGGER routes_guard_operacional_trigger BEFORE UPDATE ON public.routes
 FOR EACH ROW EXECUTE FUNCTION public.routes_guard_operacional();

CREATE FUNCTION public.users_guard_operacional() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF public.current_user_has_any_role(ARRAY['operacional']::text[])
  AND ROW(NEW.id,NEW.role,NEW.commission_rate,NEW.email)
   IS DISTINCT FROM ROW(OLD.id,OLD.role,OLD.commission_rate,OLD.email) THEN
  RAISE EXCEPTION 'Operacional não pode alterar cargo, comissão ou identidade do perfil.' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.users_guard_operacional() FROM PUBLIC;
CREATE TRIGGER users_guard_operacional_trigger BEFORE UPDATE ON public.users
 FOR EACH ROW EXECUTE FUNCTION public.users_guard_operacional();
NOTIFY pgrst, 'reload schema';
