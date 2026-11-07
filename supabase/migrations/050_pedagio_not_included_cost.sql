-- Preserve existing monetary values. Only new rows or financial saves use v2.
ALTER TABLE public.routes ADD COLUMN financial_calculation_version smallint NOT NULL DEFAULT 1
 CHECK (financial_calculation_version IN (1,2));

CREATE FUNCTION public.routes_recalculate_financials() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE base numeric; taxes numeric; insurance numeric; toll numeric; driver_cost numeric; rate numeric;
BEGIN
 base := coalesce(NEW.freight_value,NEW.nf_value);
 taxes := coalesce(NEW.taxes_value,
  floor(base * CASE WHEN NEW.taxes_percent IN (0,10,12,18) THEN NEW.taxes_percent ELSE 18 END + 0.5)/100,0);
 insurance := coalesce(NEW.seguro_value,
  floor(NEW.nf_value * CASE WHEN NEW.seguro_percent=0.2 THEN 0.2 ELSE 0 END + 0.5)/100,0);
 toll := CASE WHEN NEW.vale_pedagio_incluso IS false THEN coalesce(NEW.vale_pedagio,0) ELSE 0 END;
 driver_cost := floor((coalesce(NEW.driver_value,0)+toll)*100+0.5)/100;
 NEW.net_freight_value := floor((base - taxes - driver_cost - insurance)*100+0.5)/100;
 SELECT commission_rate INTO rate FROM public.users WHERE id=NEW.created_by_user_id;
 NEW.commission_value := floor(NEW.net_freight_value * coalesce(rate,30)+0.5)/100;
 NEW.financial_calculation_version := 2;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.routes_recalculate_financials() FROM PUBLIC;
-- Runs AFTER the whitelist/commission guards by trigger-name ordering. A client
-- cannot use derived fields or the version marker to bypass those guards.
CREATE TRIGGER routes_recalculate_financials_trigger
 BEFORE INSERT OR UPDATE OF cte_value,freight_value,nf_value,driver_value,taxes_percent,taxes_value,
 seguro_percent,seguro_value,vale_pedagio,vale_pedagio_incluso,net_freight_value,
 commission_value,financial_calculation_version ON public.routes
 FOR EACH ROW EXECUTE FUNCTION public.routes_recalculate_financials();
NOTIFY pgrst,'reload schema';
