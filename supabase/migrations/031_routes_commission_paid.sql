-- ============================================================
-- 031 - STATUS DE PAGAMENTO DA COMISSÃO (SOMENTE ADMIN)
-- ============================================================

ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS commission_paid BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.routes.commission_paid IS
  'Indica se a comissão do comercial já foi paga. Alterável apenas por administradores.';

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
STABLE
AS $$
  SELECT public.current_user_has_any_role(ARRAY['admin']::text[]);
$$;

CREATE OR REPLACE FUNCTION public.routes_guard_commission_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.commission_paid IS DISTINCT FROM NEW.commission_paid THEN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Apenas administradores podem alterar o status de pagamento da comissão.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS routes_guard_commission_paid_trigger ON public.routes;
CREATE TRIGGER routes_guard_commission_paid_trigger
  BEFORE UPDATE ON public.routes
  FOR EACH ROW
  EXECUTE FUNCTION public.routes_guard_commission_paid();
