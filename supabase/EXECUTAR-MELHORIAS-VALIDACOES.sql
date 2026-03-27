-- ============================================
-- EXECUTAR MELHORIAS NAS VALIDAÇÕES DO BACKEND
-- ============================================
-- Copie e cole este arquivo completo no SQL Editor do Supabase
-- Execute tudo de uma vez
-- ============================================

-- ============================================
-- 1. SANITIZAÇÃO DE INPUTS (PREVENIR XSS)
-- ============================================

CREATE OR REPLACE FUNCTION sanitize_text(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
  IF input_text IS NULL THEN RETURN NULL; END IF;
  RETURN REGEXP_REPLACE(
    REGEXP_REPLACE(
      REGEXP_REPLACE(input_text, '<[^>]*>', '', 'g'),
      'javascript:', '', 'gi'
    ),
    'on\w+\s*=', '', 'gi'
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION sanitize_url(url_text TEXT)
RETURNS TEXT AS $$
BEGIN
  IF url_text IS NULL OR url_text = '' THEN RETURN NULL; END IF;
  IF url_text !~ '^https?://[a-zA-Z0-9.-]+' THEN RETURN NULL; END IF;
  RETURN REGEXP_REPLACE(url_text, '[<>"'']', '', 'g');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- 2. VALIDAÇÃO DE ARQUIVOS (FOTOS)
-- ============================================

CREATE OR REPLACE FUNCTION validate_photo_file(url_text TEXT, max_size_mb INTEGER DEFAULT 5)
RETURNS BOOLEAN AS $$
DECLARE
  url_lower TEXT;
  valid_extensions TEXT[] := ARRAY['jpg', 'jpeg', 'png', 'webp'];
  extension TEXT;
BEGIN
  IF url_text IS NULL OR url_text = '' THEN RETURN FALSE; END IF;
  url_lower := LOWER(url_text);
  extension := SUBSTRING(url_lower FROM '\.([a-z]+)(?:\?|$)');
  IF extension IS NULL OR NOT (extension = ANY(valid_extensions)) THEN RETURN FALSE; END IF;
  IF url_lower !~ '^https?://' THEN RETURN FALSE; END IF;
  IF LENGTH(url_text) > 500 THEN RETURN FALSE; END IF;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- 3. VALIDAÇÃO DE COORDENADAS GPS DO BRASIL
-- ============================================

CREATE OR REPLACE FUNCTION validate_coordinates_brazil(lat DOUBLE PRECISION, lng DOUBLE PRECISION)
RETURNS BOOLEAN AS $$
BEGIN
  IF NOT validate_coordinates(lat, lng) THEN RETURN FALSE; END IF;
  IF lat < -33.75 OR lat > 5.27 THEN RETURN FALSE; END IF;
  IF lng < -74.0 OR lng > -32.4 THEN RETURN FALSE; END IF;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- 4. CÁLCULO DE DISTÂNCIA ENTRE COORDENADAS
-- ============================================

CREATE OR REPLACE FUNCTION calculate_distance(lat1 DOUBLE PRECISION, lng1 DOUBLE PRECISION, lat2 DOUBLE PRECISION, lng2 DOUBLE PRECISION)
RETURNS DOUBLE PRECISION AS $$
DECLARE
  earth_radius_km DOUBLE PRECISION := 6371.0;
  dlat DOUBLE PRECISION;
  dlng DOUBLE PRECISION;
  a DOUBLE PRECISION;
  c DOUBLE PRECISION;
BEGIN
  dlat := RADIANS(lat2 - lat1);
  dlng := RADIANS(lng2 - lng1);
  a := SIN(dlat / 2) * SIN(dlat / 2) + COS(RADIANS(lat1)) * COS(RADIANS(lat2)) * SIN(dlng / 2) * SIN(dlng / 2);
  c := 2 * ATAN2(SQRT(a), SQRT(1 - a));
  RETURN earth_radius_km * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- 5. ATUALIZAR TRIGGERS COM SANITIZAÇÃO
-- ============================================

-- Atualizar função de validação de motorista
CREATE OR REPLACE FUNCTION validate_driver_data()
RETURNS TRIGGER AS $$
BEGIN
  NEW.name := sanitize_text(NEW.name);
  IF NOT validate_full_name(NEW.name) THEN
    RAISE EXCEPTION 'Nome inválido. Deve ser nome completo (mínimo 2 palavras)';
  END IF;
  IF NOT validate_email(NEW.email) THEN
    RAISE EXCEPTION 'Email inválido ou não permitido';
  END IF;
  IF NOT validate_phone(NEW.phone) THEN
    RAISE EXCEPTION 'Telefone inválido. Deve ter 10 ou 11 dígitos (com DDD)';
  END IF;
  IF NOT validate_cnh(NEW.cnh) THEN
    RAISE EXCEPTION 'CNH inválida. Deve ter 11 dígitos numéricos';
  END IF;
  IF NOT validate_plate(NEW.plate) THEN
    RAISE EXCEPTION 'Placa inválida. Use formato ABC-1234 ou ABC1D23';
  END IF;
  IF NEW.vehicle IS NOT NULL THEN NEW.vehicle := sanitize_text(NEW.vehicle); END IF;
  IF NEW.location IS NOT NULL THEN NEW.location := sanitize_text(NEW.location); END IF;
  IF LENGTH(NEW.name) > 100 THEN
    RAISE EXCEPTION 'Nome muito longo (máximo 100 caracteres)';
  END IF;
  IF LENGTH(NEW.email) > 255 THEN
    RAISE EXCEPTION 'Email muito longo (máximo 255 caracteres)';
  END IF;
  IF LENGTH(NEW.vehicle) > 50 THEN
    RAISE EXCEPTION 'Veículo muito longo (máximo 50 caracteres)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Atualizar função de validação de cliente
CREATE OR REPLACE FUNCTION validate_client_data()
RETURNS TRIGGER AS $$
BEGIN
  NEW.company_name := sanitize_text(NEW.company_name);
  NEW.responsible := sanitize_text(NEW.responsible);
  NEW.address := sanitize_text(NEW.address);
  IF NEW.company_name IS NULL OR TRIM(NEW.company_name) = '' THEN
    RAISE EXCEPTION 'Nome da empresa é obrigatório';
  END IF;
  IF LENGTH(NEW.company_name) > 200 THEN
    RAISE EXCEPTION 'Nome da empresa muito longo (máximo 200 caracteres)';
  END IF;
  IF NOT validate_full_name(NEW.responsible) THEN
    RAISE EXCEPTION 'Nome do responsável inválido. Deve ser nome completo (mínimo 2 palavras)';
  END IF;
  IF NOT validate_email(NEW.email) THEN
    RAISE EXCEPTION 'Email inválido ou não permitido';
  END IF;
  IF NOT validate_phone(NEW.whatsapp) THEN
    RAISE EXCEPTION 'WhatsApp inválido. Deve ter 10 ou 11 dígitos (com DDD)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'cnpj') THEN
    IF NEW.cnpj IS NOT NULL AND TRIM(NEW.cnpj) != '' THEN
      IF NOT validate_cnpj(NEW.cnpj) THEN RAISE EXCEPTION 'CNPJ inválido'; END IF;
    END IF;
  END IF;
  IF NEW.city IS NOT NULL THEN NEW.city := sanitize_text(NEW.city); END IF;
  IF NEW.neighborhood IS NOT NULL THEN NEW.neighborhood := sanitize_text(NEW.neighborhood); END IF;
  IF LENGTH(NEW.responsible) > 100 THEN
    RAISE EXCEPTION 'Nome do responsável muito longo (máximo 100 caracteres)';
  END IF;
  IF LENGTH(NEW.email) > 255 THEN
    RAISE EXCEPTION 'Email muito longo (máximo 255 caracteres)';
  END IF;
  IF LENGTH(NEW.address) > 300 THEN
    RAISE EXCEPTION 'Endereço muito longo (máximo 300 caracteres)';
  END IF;
  IF LENGTH(NEW.city) > 100 THEN
    RAISE EXCEPTION 'Cidade muito longa (máximo 100 caracteres)';
  END IF;
  IF LENGTH(NEW.state) > 2 THEN
    RAISE EXCEPTION 'Estado deve ter 2 caracteres (UF)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Atualizar função de validação de rota
CREATE OR REPLACE FUNCTION validate_route_data()
RETURNS TRIGGER AS $$
BEGIN
  NEW.origin := sanitize_text(NEW.origin);
  NEW.destination := sanitize_text(NEW.destination);
  IF NEW.freight_id IS NULL OR NEW.freight_id <= 0 THEN
    RAISE EXCEPTION 'Freight ID inválido. Deve ser um número positivo';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.drivers WHERE id = NEW.driver_id) THEN
    RAISE EXCEPTION 'Motorista não encontrado';
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
$$ LANGUAGE plpgsql;

-- Atualizar função de validação de check-in
CREATE OR REPLACE FUNCTION validate_checkin_data()
RETURNS TRIGGER AS $$
DECLARE
  v_route_driver_id UUID;
  v_route_exists BOOLEAN;
BEGIN
  IF NOT validate_coordinates_brazil(NEW.coords_lat, NEW.coords_lng) THEN
    RAISE EXCEPTION 'Coordenadas GPS inválidas ou fora do Brasil';
  END IF;
  IF NOT validate_photo_file(NEW.photo_url) THEN
    RAISE EXCEPTION 'URL da foto inválida. Use formatos: JPG, PNG ou WEBP';
  END IF;
  IF NEW.type NOT IN ('pickup', 'delivery') THEN
    RAISE EXCEPTION 'Tipo de check-in inválido. Deve ser "pickup" ou "delivery"';
  END IF;
  IF NEW.freight_id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM public.routes WHERE freight_id = NEW.freight_id) INTO v_route_exists;
    IF NOT v_route_exists THEN
      RAISE EXCEPTION 'Frete não encontrado';
    END IF;
    SELECT driver_id INTO v_route_driver_id FROM public.routes WHERE freight_id = NEW.freight_id;
    IF NEW.driver_id IS NOT NULL AND v_route_driver_id IS NOT NULL THEN
      IF NEW.driver_id != v_route_driver_id THEN
        RAISE EXCEPTION 'Motorista não autorizado para este frete';
      END IF;
    END IF;
  END IF;
  IF NEW.driver_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.drivers WHERE id = NEW.driver_id) THEN
      RAISE EXCEPTION 'Motorista não encontrado';
    END IF;
  END IF;
  IF NEW.address IS NOT NULL THEN
    NEW.address := sanitize_text(NEW.address);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. VALIDAÇÃO DE INTEGRIDADE REFERENCIAL
-- ============================================

CREATE OR REPLACE FUNCTION validate_referential_integrity()
RETURNS TRIGGER AS $$
DECLARE
  v_dependent_count INTEGER;
BEGIN
  IF TG_TABLE_NAME = 'drivers' AND TG_OP = 'DELETE' THEN
    SELECT COUNT(*) INTO v_dependent_count
    FROM public.routes
    WHERE driver_id = OLD.id AND status NOT IN ('delivered', 'cancelled');
    IF v_dependent_count > 0 THEN
      RAISE EXCEPTION 'Não é possível excluir motorista com rotas ativas. Cancele ou conclua as rotas primeiro.';
    END IF;
  END IF;
  IF TG_TABLE_NAME = 'routes' AND TG_OP = 'DELETE' THEN
    SELECT COUNT(*) INTO v_dependent_count
    FROM public.checkins
    WHERE route_id = OLD.id OR freight_id = OLD.freight_id;
    IF v_dependent_count > 0 THEN
      RAISE NOTICE 'Rota excluída, mas % check-ins relacionados serão mantidos', v_dependent_count;
    END IF;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validate_driver_deletion ON public.drivers;
CREATE TRIGGER trigger_validate_driver_deletion
  BEFORE DELETE ON public.drivers
  FOR EACH ROW
  EXECUTE FUNCTION validate_referential_integrity();

DROP TRIGGER IF EXISTS trigger_validate_route_deletion ON public.routes;
CREATE TRIGGER trigger_validate_route_deletion
  BEFORE DELETE ON public.routes
  FOR EACH ROW
  EXECUTE FUNCTION validate_referential_integrity();

-- ============================================
-- 7. VALIDAÇÃO DE DUPLICATAS
-- ============================================

CREATE OR REPLACE FUNCTION check_duplicate_driver()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.drivers WHERE cnh = NEW.cnh AND id != NEW.id) THEN
    RAISE EXCEPTION 'CNH já cadastrada para outro motorista';
  END IF;
  IF EXISTS (SELECT 1 FROM public.drivers WHERE email = NEW.email AND id != NEW.id) THEN
    RAISE EXCEPTION 'Email já cadastrado para outro motorista';
  END IF;
  IF EXISTS (SELECT 1 FROM public.drivers WHERE phone = NEW.phone AND id != NEW.id) THEN
    RAISE EXCEPTION 'Telefone já cadastrado para outro motorista';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_duplicate_driver ON public.drivers;
CREATE TRIGGER trigger_check_duplicate_driver
  BEFORE INSERT OR UPDATE ON public.drivers
  FOR EACH ROW
  EXECUTE FUNCTION check_duplicate_driver();

CREATE OR REPLACE FUNCTION check_duplicate_client()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.clients WHERE email = NEW.email AND id != NEW.id) THEN
    RAISE EXCEPTION 'Email já cadastrado para outro cliente';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'cnpj') THEN
    IF NEW.cnpj IS NOT NULL AND TRIM(NEW.cnpj) != '' THEN
      IF EXISTS (SELECT 1 FROM public.clients WHERE cnpj = NEW.cnpj AND id != NEW.id) THEN
        RAISE EXCEPTION 'CNPJ já cadastrado para outro cliente';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_duplicate_client ON public.clients;
CREATE TRIGGER trigger_check_duplicate_client
  BEFORE INSERT OR UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION check_duplicate_client();

-- ============================================
-- FIM
-- ============================================
-- Melhorias nas validações instaladas!
-- 
-- NOVAS FUNCIONALIDADES:
-- ✅ Sanitização de inputs (prevenir XSS)
-- ✅ Validação de arquivos (tipo, formato)
-- ✅ Validação de coordenadas GPS do Brasil
-- ✅ Validação de integridade referencial
-- ✅ Verificação de duplicatas antes de inserir
-- ✅ Cálculo de distância entre coordenadas
-- ============================================

