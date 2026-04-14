-- Permite criar frete sem motorista vinculado (driver_id opcional).

ALTER TABLE public.routes
  ALTER COLUMN driver_id DROP NOT NULL;

-- Ambientes com validações (sanitize_text / validate_plate etc.): atualiza o trigger da rota.
DO $migration$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'sanitize_text')
     AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'validate_plate') THEN
    EXECUTE $fn$
CREATE OR REPLACE FUNCTION validate_route_data()
RETURNS TRIGGER AS $trig$
BEGIN
  NEW.origin := sanitize_text(NEW.origin);
  NEW.destination := sanitize_text(NEW.destination);
  IF NEW.freight_id IS NULL OR NEW.freight_id <= 0 THEN
    RAISE EXCEPTION 'Freight ID inválido. Deve ser um número positivo';
  END IF;
  IF NEW.driver_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.drivers WHERE id = NEW.driver_id) THEN
      RAISE EXCEPTION 'Motorista não encontrado';
    END IF;
  END IF;
  IF NEW.vehicle IS NOT NULL THEN NEW.vehicle := sanitize_text(NEW.vehicle); END IF;
  IF NEW.company_name IS NOT NULL THEN NEW.company_name := sanitize_text(NEW.company_name); END IF;
  IF NEW.company_responsible IS NOT NULL THEN NEW.company_responsible := sanitize_text(NEW.company_responsible); END IF;
  IF NEW.company_address IS NOT NULL THEN NEW.company_address := sanitize_text(NEW.company_address); END IF;
  IF NEW.company_city IS NOT NULL THEN NEW.company_city := sanitize_text(NEW.company_city); END IF;
  IF LENGTH(NEW.origin) > 200 THEN
    RAISE EXCEPTION 'Origem muito longa (máximo 200 caracteres)';
  END IF;
  IF LENGTH(NEW.destination) > 200 THEN
    RAISE EXCEPTION 'Destino muito longo (máximo 200 caracteres)';
  END IF;
  IF LENGTH(NEW.origin_state) > 2 THEN
    RAISE EXCEPTION 'Estado de origem deve ter 2 caracteres (UF)';
  END IF;
  IF LENGTH(NEW.destination_state) > 2 THEN
    RAISE EXCEPTION 'Estado de destino deve ter 2 caracteres (UF)';
  END IF;
  IF LENGTH(NEW.vehicle) > 50 THEN
    RAISE EXCEPTION 'Veículo muito longo (máximo 50 caracteres)';
  END IF;
  IF NOT validate_plate(NEW.plate) THEN
    RAISE EXCEPTION 'Placa inválida. Use formato ABC-1234 ou ABC1D23';
  END IF;
  IF NEW.company_email IS NOT NULL AND TRIM(NEW.company_email) != '' THEN
    IF NOT validate_email(NEW.company_email) THEN
      RAISE EXCEPTION 'Email da empresa inválido';
    END IF;
  END IF;
  IF NEW.company_phone IS NOT NULL AND TRIM(NEW.company_phone) != '' THEN
    IF NOT validate_phone(NEW.company_phone) THEN
      RAISE EXCEPTION 'Telefone da empresa inválido';
    END IF;
  END IF;
  RETURN NEW;
END;
$trig$ LANGUAGE plpgsql;
$fn$;
  END IF;
END $migration$;
