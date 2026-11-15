-- Revisões novas recebem o total informado pela empresa. Revisões antigas
-- com componentes continuam válidas, desde que a soma esteja consistente.
CREATE OR REPLACE FUNCTION public.erp_validate_tax_components() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  total numeric;
  components numeric;
BEGIN
  IF NEW.status <> 'approved' THEN RETURN NEW; END IF;

  IF jsonb_typeof(NEW.rules->'tax_percent') <> 'number' THEN
    RAISE EXCEPTION 'Total de tributos ausente ou inválido';
  END IF;
  total := (NEW.rules->>'tax_percent')::numeric;
  IF total < 0 OR total > 100 THEN
    RAISE EXCEPTION 'Total de tributos deve estar entre 0 e 100';
  END IF;

  IF NEW.rules ?| ARRAY['icmst_percent', 'pis_cofins_percent', 'csll_irpj_lp_percent'] THEN
    IF NOT (NEW.rules ?& ARRAY['icmst_percent', 'pis_cofins_percent', 'csll_irpj_lp_percent'])
       OR jsonb_typeof(NEW.rules->'icmst_percent') <> 'number'
       OR jsonb_typeof(NEW.rules->'pis_cofins_percent') <> 'number'
       OR jsonb_typeof(NEW.rules->'csll_irpj_lp_percent') <> 'number' THEN
      RAISE EXCEPTION 'Componentes dos tributos incompletos ou inválidos';
    END IF;
    components := (NEW.rules->>'icmst_percent')::numeric
                + (NEW.rules->>'pis_cofins_percent')::numeric
                + (NEW.rules->>'csll_irpj_lp_percent')::numeric;
    IF (NEW.rules->>'icmst_percent')::numeric < 0
       OR (NEW.rules->>'pis_cofins_percent')::numeric < 0
       OR (NEW.rules->>'csll_irpj_lp_percent')::numeric < 0
       OR total <> round(components, 4) THEN
      RAISE EXCEPTION 'Total de tributos não corresponde à soma dos componentes';
    END IF;
  END IF;
  RETURN NEW;
END $$;
