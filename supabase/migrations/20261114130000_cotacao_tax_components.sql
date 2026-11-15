-- Revisões antigas permanecem intactas; novas aprovações devem registrar
-- o detalhamento que compõe tax_percent usado por erp_analyze_quote.
CREATE FUNCTION public.erp_validate_tax_components() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  total numeric;
BEGIN
  IF NEW.status <> 'approved' THEN RETURN NEW; END IF;

  IF NOT (NEW.rules ?& ARRAY['icmst_percent', 'pis_cofins_percent', 'csll_irpj_lp_percent', 'tax_percent'])
     OR jsonb_typeof(NEW.rules->'icmst_percent') <> 'number'
     OR jsonb_typeof(NEW.rules->'pis_cofins_percent') <> 'number'
     OR jsonb_typeof(NEW.rules->'csll_irpj_lp_percent') <> 'number'
     OR jsonb_typeof(NEW.rules->'tax_percent') <> 'number' THEN
    RAISE EXCEPTION 'Componentes dos tributos ausentes ou inválidos';
  END IF;

  total := (NEW.rules->>'icmst_percent')::numeric
         + (NEW.rules->>'pis_cofins_percent')::numeric
         + (NEW.rules->>'csll_irpj_lp_percent')::numeric;
  IF total < 0 OR total > 100
     OR (NEW.rules->>'icmst_percent')::numeric < 0
     OR (NEW.rules->>'pis_cofins_percent')::numeric < 0
     OR (NEW.rules->>'csll_irpj_lp_percent')::numeric < 0
     OR (NEW.rules->>'tax_percent')::numeric <> round(total, 4) THEN
    RAISE EXCEPTION 'O total de tributos deve corresponder à soma dos componentes';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER erp_validate_tax_components
BEFORE INSERT OR UPDATE OF status, rules ON public.erp_pricing_revisions
FOR EACH ROW EXECUTE FUNCTION public.erp_validate_tax_components();
