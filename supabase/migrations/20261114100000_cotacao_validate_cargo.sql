-- Uma análise comercial exige carga e nota conhecidas e pelo menos um veículo apto.
-- O trigger cobre também chamadas diretas à função de cálculo.
CREATE FUNCTION public.erp_validate_analysis_cargo() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE weight_kg numeric; invoice_value numeric;
BEGIN
  weight_kg := NULLIF(NEW.snapshot #>> '{draft,pesoKg}', '')::numeric;
  invoice_value := NULLIF(NEW.snapshot #>> '{draft,valorNota}', '')::numeric;
  IF weight_kg IS NULL OR weight_kg <= 0 OR invoice_value IS NULL OR invoice_value <= 0 THEN
    RAISE EXCEPTION 'Informe peso e valor da nota positivos antes de calcular o preço';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(NEW.snapshot #> '{rules,vehicles}') AS vehicle
    WHERE (vehicle->>'payloadKg')::numeric >= weight_kg
  ) THEN
    RAISE EXCEPTION 'Carga acima da capacidade de todos os veículos aprovados';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER erp_validate_analysis_cargo BEFORE INSERT ON public.erp_quote_analyses
FOR EACH ROW EXECUTE FUNCTION public.erp_validate_analysis_cargo();
NOTIFY pgrst, 'reload schema';
