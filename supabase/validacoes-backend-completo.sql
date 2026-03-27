-- ============================================
-- VALIDAÇÕES NO BACKEND - TRANSPORTEJÁ (COMPLETO E MELHORADO)
-- ============================================
-- Este script implementa validações robustas no banco de dados
-- para garantir integridade dos dados mesmo se o frontend for burlado
-- 
-- INSTRUÇÕES:
-- 1. Execute este script no SQL Editor do Supabase
-- 2. Verifique se não há erros
-- 3. Execute o script de teste: supabase/testar-validacoes-completo.sql
-- ============================================

-- ============================================
-- 1. FUNÇÕES DE VALIDAÇÃO BÁSICAS
-- ============================================

-- Função para validar email
CREATE OR REPLACE FUNCTION validate_email(email_text TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Verifica se não é vazio
  IF email_text IS NULL OR TRIM(email_text) = '' THEN
    RETURN FALSE;
  END IF;
  
  -- Verifica tamanho máximo
  IF LENGTH(email_text) > 255 THEN
    RETURN FALSE;
  END IF;
  
  -- Regex básico para email
  IF email_text !~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$' THEN
    RETURN FALSE;
  END IF;
  
  -- Verifica domínios temporários comuns
  IF email_text ~* '(tempmail|10minutemail|guerrillamail|mailinator|throwaway|temp-mail|yopmail|sharklasers)' THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função para validar telefone brasileiro
CREATE OR REPLACE FUNCTION validate_phone(phone_text TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  clean_phone TEXT;
BEGIN
  IF phone_text IS NULL OR TRIM(phone_text) = '' THEN
    RETURN FALSE;
  END IF;
  
  -- Remove caracteres não numéricos
  clean_phone := REGEXP_REPLACE(phone_text, '[^0-9]', '', 'g');
  
  -- Verifica se tem 10 ou 11 dígitos
  IF LENGTH(clean_phone) < 10 OR LENGTH(clean_phone) > 11 THEN
    RETURN FALSE;
  END IF;
  
  -- Não pode começar com 0
  IF clean_phone LIKE '0%' THEN
    RETURN FALSE;
  END IF;
  
  -- DDD deve ser válido (11 a 99, exceto alguns inválidos)
  IF SUBSTRING(clean_phone, 1, 2)::INTEGER < 11 OR SUBSTRING(clean_phone, 1, 2)::INTEGER > 99 THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função para validar CNH (11 dígitos numéricos)
CREATE OR REPLACE FUNCTION validate_cnh(cnh_text TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  clean_cnh TEXT;
BEGIN
  IF cnh_text IS NULL OR TRIM(cnh_text) = '' THEN
    RETURN FALSE;
  END IF;
  
  -- Remove caracteres não numéricos
  clean_cnh := REGEXP_REPLACE(cnh_text, '[^0-9]', '', 'g');
  
  -- Deve ter exatamente 11 dígitos
  IF LENGTH(clean_cnh) != 11 THEN
    RETURN FALSE;
  END IF;
  
  -- Não pode ser todos zeros ou repetidos
  IF clean_cnh = '00000000000' OR clean_cnh ~ '^(\d)\1{10}$' THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função para validar CNPJ (algoritmo completo)
CREATE OR REPLACE FUNCTION validate_cnpj(cnpj_text TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  clean_cnpj TEXT;
  length_val INTEGER;
  numbers TEXT;
  digits TEXT;
  sum_val INTEGER;
  pos INTEGER;
  result INTEGER;
BEGIN
  IF cnpj_text IS NULL OR TRIM(cnpj_text) = '' THEN
    RETURN FALSE;
  END IF;
  
  -- Remove caracteres não numéricos
  clean_cnpj := REGEXP_REPLACE(cnpj_text, '[^0-9]', '', 'g');
  
  -- Deve ter 14 dígitos
  IF LENGTH(clean_cnpj) != 14 THEN
    RETURN FALSE;
  END IF;
  
  -- Não pode ser todos iguais
  IF clean_cnpj ~ '^(\d)\1{13}$' THEN
    RETURN FALSE;
  END IF;
  
  -- Validação do primeiro dígito verificador
  length_val := 12;
  numbers := SUBSTRING(clean_cnpj, 1, length_val);
  digits := SUBSTRING(clean_cnpj, length_val + 1, 2);
  sum_val := 0;
  pos := length_val - 7;
  
  FOR i IN 1..length_val LOOP
    sum_val := sum_val + CAST(SUBSTRING(numbers, i, 1) AS INTEGER) * pos;
    pos := pos - 1;
    IF pos < 2 THEN
      pos := 9;
    END IF;
  END LOOP;
  
  result := sum_val % 11;
  result := CASE WHEN result < 2 THEN 0 ELSE 11 - result END;
  
  IF result != CAST(SUBSTRING(digits, 1, 1) AS INTEGER) THEN
    RETURN FALSE;
  END IF;
  
  -- Validação do segundo dígito verificador
  length_val := 13;
  numbers := SUBSTRING(clean_cnpj, 1, length_val);
  sum_val := 0;
  pos := length_val - 7;
  
  FOR i IN 1..length_val LOOP
    sum_val := sum_val + CAST(SUBSTRING(numbers, i, 1) AS INTEGER) * pos;
    pos := pos - 1;
    IF pos < 2 THEN
      pos := 9;
    END IF;
  END LOOP;
  
  result := sum_val % 11;
  result := CASE WHEN result < 2 THEN 0 ELSE 11 - result END;
  
  IF result != CAST(SUBSTRING(digits, 2, 1) AS INTEGER) THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função para validar placa (antiga e Mercosul)
CREATE OR REPLACE FUNCTION validate_plate(plate_text TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  clean_plate TEXT;
BEGIN
  IF plate_text IS NULL OR TRIM(plate_text) = '' THEN
    RETURN FALSE;
  END IF;
  
  -- Remove espaços e converte para maiúsculo
  clean_plate := UPPER(REGEXP_REPLACE(plate_text, '\s', '', 'g'));
  
  -- Formato antigo: ABC-1234 (3 letras + 4 números)
  -- Formato Mercosul: ABC1D23 (3 letras + 1 número + 1 letra + 2 números)
  IF clean_plate ~ '^[A-Z]{3}-?\d{4}$' OR clean_plate ~ '^[A-Z]{3}\d[A-Z]\d{2}$' THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função para validar CEP (8 dígitos)
CREATE OR REPLACE FUNCTION validate_cep(cep_text TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  clean_cep TEXT;
BEGIN
  IF cep_text IS NULL OR TRIM(cep_text) = '' THEN
    RETURN FALSE;
  END IF;
  
  -- Remove caracteres não numéricos
  clean_cep := REGEXP_REPLACE(cep_text, '[^0-9]', '', 'g');
  
  -- Deve ter 8 dígitos
  IF LENGTH(clean_cep) != 8 THEN
    RETURN FALSE;
  END IF;
  
  -- Não pode ser todos zeros ou repetidos
  IF clean_cep = '00000000' OR clean_cep ~ '^(\d)\1{7}$' THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função para validar nome completo (mínimo 2 palavras)
CREATE OR REPLACE FUNCTION validate_full_name(name_text TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  word_count INTEGER;
BEGIN
  IF name_text IS NULL OR TRIM(name_text) = '' THEN
    RETURN FALSE;
  END IF;
  
  -- Verifica tamanho mínimo e máximo
  IF LENGTH(TRIM(name_text)) < 3 OR LENGTH(name_text) > 100 THEN
    RETURN FALSE;
  END IF;
  
  -- Conta palavras (separadas por espaços)
  word_count := array_length(string_to_array(TRIM(name_text), ' '), 1);
  
  -- Deve ter pelo menos 2 palavras
  IF word_count < 2 THEN
    RETURN FALSE;
  END IF;
  
  -- Verifica se contém apenas letras, espaços e caracteres acentuados
  IF name_text !~ '^[a-zA-ZÀ-ÿ\s]+$' THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função para validar coordenadas GPS
CREATE OR REPLACE FUNCTION validate_coordinates(lat DOUBLE PRECISION, lng DOUBLE PRECISION)
RETURNS BOOLEAN AS $$
BEGIN
  -- Latitude deve estar entre -90 e 90
  IF lat IS NULL OR lat < -90 OR lat > 90 THEN
    RETURN FALSE;
  END IF;
  
  -- Longitude deve estar entre -180 e 180
  IF lng IS NULL OR lng < -180 OR lng > 180 THEN
    RETURN FALSE;
  END IF;
  
  -- Coordenadas (0, 0) são suspeitas (pode ser erro)
  -- Mas não vamos bloquear, apenas avisar
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função para validar URL de foto
CREATE OR REPLACE FUNCTION validate_photo_url(url_text TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  IF url_text IS NULL OR TRIM(url_text) = '' THEN
    RETURN FALSE;
  END IF;
  
  -- Deve ser uma URL válida (http ou https)
  IF url_text !~ '^https?://' THEN
    RETURN FALSE;
  END IF;
  
  -- Tamanho máximo da URL
  IF LENGTH(url_text) > 500 THEN
    RETURN FALSE;
  END IF;
  
  -- Deve ser de um domínio permitido (Supabase Storage ou similar)
  -- Ajuste conforme necessário
  IF url_text !~ '(supabase|storage|cloudinary|s3|amazonaws)' THEN
    -- Permitir URLs locais para desenvolvimento
    IF url_text !~ '^(http://localhost|http://127\.0\.0\.1)' THEN
      -- Em produção, pode querer ser mais restritivo
      -- RETURN FALSE;
    END IF;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- 2. LIMPEZA DE DADOS DUPLICADOS
-- ============================================

-- Função para limpar duplicatas de email em clientes
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT email, COUNT(*) as cnt
    FROM public.clients
    GROUP BY email
    HAVING COUNT(*) > 1
  ) duplicates;
  
  IF duplicate_count > 0 THEN
    UPDATE public.clients c1
    SET email = c1.email || '_duplicado_' || c1.id::TEXT
    WHERE c1.id NOT IN (
      SELECT DISTINCT ON (email) id
      FROM public.clients
      ORDER BY email, created_at ASC
    )
    AND EXISTS (
      SELECT 1 FROM public.clients c2
      WHERE c2.email = c1.email
      AND c2.id != c1.id
    );
    
    RAISE NOTICE 'Foram encontrados e corrigidos % emails duplicados em clientes', duplicate_count;
  END IF;
END $$;

-- Função para limpar duplicatas de CNH em motoristas
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT cnh, COUNT(*) as cnt
    FROM public.drivers
    GROUP BY cnh
    HAVING COUNT(*) > 1
  ) duplicates;
  
  IF duplicate_count > 0 THEN
    RAISE WARNING 'Existem % CNHs duplicadas em motoristas. Revise manualmente antes de adicionar constraint UNIQUE.', duplicate_count;
  END IF;
END $$;

-- Função para limpar duplicatas de email em motoristas
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT email, COUNT(*) as cnt
    FROM public.drivers
    GROUP BY email
    HAVING COUNT(*) > 1
  ) duplicates;
  
  IF duplicate_count > 0 THEN
    UPDATE public.drivers d1
    SET email = d1.email || '_duplicado_' || d1.id::TEXT
    WHERE d1.id NOT IN (
      SELECT DISTINCT ON (email) id
      FROM public.drivers
      ORDER BY email, created_at ASC
    )
    AND EXISTS (
      SELECT 1 FROM public.drivers d2
      WHERE d2.email = d1.email
      AND d2.id != d1.id
    );
    
    RAISE NOTICE 'Foram encontrados e corrigidos % emails duplicados em motoristas', duplicate_count;
  END IF;
END $$;

-- Função para limpar duplicatas de telefone em motoristas
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT phone, COUNT(*) as cnt
    FROM public.drivers
    GROUP BY phone
    HAVING COUNT(*) > 1
  ) duplicates;
  
  IF duplicate_count > 0 THEN
    UPDATE public.drivers d1
    SET phone = d1.phone || '_duplicado_' || d1.id::TEXT
    WHERE d1.id NOT IN (
      SELECT DISTINCT ON (phone) id
      FROM public.drivers
      ORDER BY phone, created_at ASC
    )
    AND EXISTS (
      SELECT 1 FROM public.drivers d2
      WHERE d2.phone = d1.phone
      AND d2.id != d1.id
    );
    
    RAISE NOTICE 'Foram encontrados e corrigidos % telefones duplicados em motoristas', duplicate_count;
  END IF;
END $$;

-- ============================================
-- 3. CONSTRAINTS DE UNICIDADE
-- ============================================

-- CNH deve ser única
DO $$
BEGIN
  ALTER TABLE public.drivers DROP CONSTRAINT IF EXISTS drivers_cnh_unique;
  
  IF NOT EXISTS (
    SELECT 1 FROM (
      SELECT cnh, COUNT(*) as cnt
      FROM public.drivers
      GROUP BY cnh
      HAVING COUNT(*) > 1
    ) duplicates
  ) THEN
    ALTER TABLE public.drivers 
    ADD CONSTRAINT drivers_cnh_unique UNIQUE (cnh);
    RAISE NOTICE 'Constraint drivers_cnh_unique adicionada com sucesso';
  ELSE
    RAISE WARNING 'Não foi possível adicionar constraint drivers_cnh_unique: existem CNHs duplicadas. Revise os dados manualmente.';
  END IF;
END $$;

-- Email de motorista deve ser único
DO $$
BEGIN
  ALTER TABLE public.drivers DROP CONSTRAINT IF EXISTS drivers_email_unique;
  
  IF NOT EXISTS (
    SELECT 1 FROM (
      SELECT email, COUNT(*) as cnt
      FROM public.drivers
      GROUP BY email
      HAVING COUNT(*) > 1
    ) duplicates
  ) THEN
    ALTER TABLE public.drivers 
    ADD CONSTRAINT drivers_email_unique UNIQUE (email);
    RAISE NOTICE 'Constraint drivers_email_unique adicionada com sucesso';
  ELSE
    RAISE WARNING 'Não foi possível adicionar constraint drivers_email_unique: existem emails duplicados.';
  END IF;
END $$;

-- Telefone de motorista deve ser único
DO $$
BEGIN
  ALTER TABLE public.drivers DROP CONSTRAINT IF EXISTS drivers_phone_unique;
  
  IF NOT EXISTS (
    SELECT 1 FROM (
      SELECT phone, COUNT(*) as cnt
      FROM public.drivers
      GROUP BY phone
      HAVING COUNT(*) > 1
    ) duplicates
  ) THEN
    ALTER TABLE public.drivers 
    ADD CONSTRAINT drivers_phone_unique UNIQUE (phone);
    RAISE NOTICE 'Constraint drivers_phone_unique adicionada com sucesso';
  ELSE
    RAISE WARNING 'Não foi possível adicionar constraint drivers_phone_unique: existem telefones duplicados.';
  END IF;
END $$;

-- CNPJ de cliente deve ser único (se não for NULL)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema = 'public' 
             AND table_name = 'clients' 
             AND column_name = 'cnpj') THEN
    DROP INDEX IF EXISTS clients_cnpj_unique;
    
    IF NOT EXISTS (
      SELECT 1 FROM (
        SELECT cnpj, COUNT(*) as cnt
        FROM public.clients
        WHERE cnpj IS NOT NULL
        GROUP BY cnpj
        HAVING COUNT(*) > 1
      ) duplicates
    ) THEN
      CREATE UNIQUE INDEX clients_cnpj_unique ON public.clients(cnpj) 
      WHERE cnpj IS NOT NULL;
      RAISE NOTICE 'Index clients_cnpj_unique adicionado com sucesso';
    ELSE
      RAISE WARNING 'Não foi possível adicionar index clients_cnpj_unique: existem CNPJs duplicados.';
    END IF;
  END IF;
END $$;

-- Email de cliente deve ser único
DO $$
BEGIN
  ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_email_unique;
  
  IF NOT EXISTS (
    SELECT 1 FROM (
      SELECT email, COUNT(*) as cnt
      FROM public.clients
      GROUP BY email
      HAVING COUNT(*) > 1
    ) duplicates
  ) THEN
    ALTER TABLE public.clients 
    ADD CONSTRAINT clients_email_unique UNIQUE (email);
    RAISE NOTICE 'Constraint clients_email_unique adicionada com sucesso';
  ELSE
    RAISE WARNING 'Não foi possível adicionar constraint clients_email_unique: existem emails duplicados.';
  END IF;
END $$;

-- ============================================
-- 4. TRIGGERS DE VALIDAÇÃO
-- ============================================

-- Função para validar dados de motorista
CREATE OR REPLACE FUNCTION validate_driver_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Validar nome completo
  IF NOT validate_full_name(NEW.name) THEN
    RAISE EXCEPTION 'Nome inválido. Deve ser nome completo (mínimo 2 palavras)';
  END IF;
  
  -- Validar email
  IF NOT validate_email(NEW.email) THEN
    RAISE EXCEPTION 'Email inválido ou não permitido';
  END IF;
  
  -- Validar telefone
  IF NOT validate_phone(NEW.phone) THEN
    RAISE EXCEPTION 'Telefone inválido. Deve ter 10 ou 11 dígitos (com DDD)';
  END IF;
  
  -- Validar CNH
  IF NOT validate_cnh(NEW.cnh) THEN
    RAISE EXCEPTION 'CNH inválida. Deve ter 11 dígitos numéricos';
  END IF;
  
  -- Validar placa
  IF NOT validate_plate(NEW.plate) THEN
    RAISE EXCEPTION 'Placa inválida. Use formato ABC-1234 ou ABC1D23';
  END IF;
  
  -- Validar tamanhos máximos
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

-- Trigger para validar motorista antes de inserir/atualizar
DROP TRIGGER IF EXISTS trigger_validate_driver ON public.drivers;
CREATE TRIGGER trigger_validate_driver
  BEFORE INSERT OR UPDATE ON public.drivers
  FOR EACH ROW
  EXECUTE FUNCTION validate_driver_data();

-- Função para validar dados de cliente
CREATE OR REPLACE FUNCTION validate_client_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Validar nome da empresa
  IF NEW.company_name IS NULL OR TRIM(NEW.company_name) = '' THEN
    RAISE EXCEPTION 'Nome da empresa é obrigatório';
  END IF;
  
  IF LENGTH(NEW.company_name) > 200 THEN
    RAISE EXCEPTION 'Nome da empresa muito longo (máximo 200 caracteres)';
  END IF;
  
  -- Validar responsável (nome completo)
  IF NOT validate_full_name(NEW.responsible) THEN
    RAISE EXCEPTION 'Nome do responsável inválido. Deve ser nome completo (mínimo 2 palavras)';
  END IF;
  
  -- Validar email
  IF NOT validate_email(NEW.email) THEN
    RAISE EXCEPTION 'Email inválido ou não permitido';
  END IF;
  
  -- Validar WhatsApp
  IF NOT validate_phone(NEW.whatsapp) THEN
    RAISE EXCEPTION 'WhatsApp inválido. Deve ter 10 ou 11 dígitos (com DDD)';
  END IF;
  
  -- Validar CNPJ (se fornecido)
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema = 'public' 
             AND table_name = 'clients' 
             AND column_name = 'cnpj') THEN
    IF NEW.cnpj IS NOT NULL AND TRIM(NEW.cnpj) != '' THEN
      IF NOT validate_cnpj(NEW.cnpj) THEN
        RAISE EXCEPTION 'CNPJ inválido';
      END IF;
    END IF;
  END IF;
  
  -- Validar tamanhos máximos
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

-- Trigger para validar cliente antes de inserir/atualizar
DROP TRIGGER IF EXISTS trigger_validate_client ON public.clients;
CREATE TRIGGER trigger_validate_client
  BEFORE INSERT OR UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION validate_client_data();

-- Função para validar dados de rota
CREATE OR REPLACE FUNCTION validate_route_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Validar freight_id (deve ser positivo)
  IF NEW.freight_id IS NULL OR NEW.freight_id <= 0 THEN
    RAISE EXCEPTION 'Freight ID inválido. Deve ser um número positivo';
  END IF;
  
  -- Validar que driver_id existe
  IF NOT EXISTS (SELECT 1 FROM public.drivers WHERE id = NEW.driver_id) THEN
    RAISE EXCEPTION 'Motorista não encontrado';
  END IF;
  
  -- Validar tamanhos máximos
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
  
  -- Validar placa da rota
  IF NOT validate_plate(NEW.plate) THEN
    RAISE EXCEPTION 'Placa inválida. Use formato ABC-1234 ou ABC1D23';
  END IF;
  
  -- Validar email da empresa (se fornecido)
  IF NEW.company_email IS NOT NULL AND TRIM(NEW.company_email) != '' THEN
    IF NOT validate_email(NEW.company_email) THEN
      RAISE EXCEPTION 'Email da empresa inválido';
    END IF;
  END IF;
  
  -- Validar telefone da empresa (se fornecido)
  IF NEW.company_phone IS NOT NULL AND TRIM(NEW.company_phone) != '' THEN
    IF NOT validate_phone(NEW.company_phone) THEN
      RAISE EXCEPTION 'Telefone da empresa inválido';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para validar rota antes de inserir/atualizar
DROP TRIGGER IF EXISTS trigger_validate_route ON public.routes;
CREATE TRIGGER trigger_validate_route
  BEFORE INSERT OR UPDATE ON public.routes
  FOR EACH ROW
  EXECUTE FUNCTION validate_route_data();

-- Função para validar check-in (MELHORADA)
CREATE OR REPLACE FUNCTION validate_checkin_data()
RETURNS TRIGGER AS $$
DECLARE
  route_driver_id UUID;
  route_exists BOOLEAN;
BEGIN
  -- Validar coordenadas GPS
  IF NOT validate_coordinates(NEW.coords_lat, NEW.coords_lng) THEN
    RAISE EXCEPTION 'Coordenadas GPS inválidas. Latitude deve estar entre -90 e 90, Longitude entre -180 e 180';
  END IF;
  
  -- Validar URL da foto
  IF NOT validate_photo_url(NEW.photo_url) THEN
    RAISE EXCEPTION 'URL da foto inválida ou não permitida';
  END IF;
  
  -- Validar tipo de check-in
  IF NEW.type NOT IN ('pickup', 'delivery') THEN
    RAISE EXCEPTION 'Tipo de check-in inválido. Deve ser "pickup" ou "delivery"';
  END IF;
  
  -- Validar que a rota existe (se freight_id foi fornecido)
  IF NEW.freight_id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM public.routes WHERE freight_id = NEW.freight_id) INTO route_exists;
    IF NOT route_exists THEN
      RAISE EXCEPTION 'Frete não encontrado';
    END IF;
    
    -- Buscar driver_id da rota
    SELECT driver_id INTO route_driver_id
    FROM public.routes
    WHERE freight_id = NEW.freight_id;
    
    -- Se o check-in tem driver_id, validar se é o mesmo da rota
    IF NEW.driver_id IS NOT NULL AND route_driver_id IS NOT NULL THEN
      IF NEW.driver_id != route_driver_id THEN
        RAISE EXCEPTION 'Motorista não autorizado para este frete';
      END IF;
    END IF;
  END IF;
  
  -- Validar que o motorista existe (se driver_id foi fornecido)
  IF NEW.driver_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.drivers WHERE id = NEW.driver_id) THEN
      RAISE EXCEPTION 'Motorista não encontrado';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para validar check-in antes de inserir
DROP TRIGGER IF EXISTS trigger_validate_checkin ON public.checkins;
CREATE TRIGGER trigger_validate_checkin
  BEFORE INSERT ON public.checkins
  FOR EACH ROW
  EXECUTE FUNCTION validate_checkin_data();

-- ============================================
-- 5. CONSTRAINTS DE TAMANHO (CHECK)
-- ============================================

-- Motoristas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'drivers_name_length_check'
  ) THEN
    ALTER TABLE public.drivers 
    ADD CONSTRAINT drivers_name_length_check 
    CHECK (LENGTH(name) <= 100);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'drivers_email_length_check'
  ) THEN
    ALTER TABLE public.drivers 
    ADD CONSTRAINT drivers_email_length_check 
    CHECK (LENGTH(email) <= 255);
  END IF;
END $$;

-- Clientes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'clients_company_name_length_check'
  ) THEN
    ALTER TABLE public.clients 
    ADD CONSTRAINT clients_company_name_length_check 
    CHECK (LENGTH(company_name) <= 200);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'clients_responsible_length_check'
  ) THEN
    ALTER TABLE public.clients 
    ADD CONSTRAINT clients_responsible_length_check 
    CHECK (LENGTH(responsible) <= 100);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'clients_email_length_check'
  ) THEN
    ALTER TABLE public.clients 
    ADD CONSTRAINT clients_email_length_check 
    CHECK (LENGTH(email) <= 255);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'clients_state_length_check'
  ) THEN
    ALTER TABLE public.clients 
    ADD CONSTRAINT clients_state_length_check 
    CHECK (LENGTH(state) = 2);
  END IF;
END $$;

-- Rotas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'routes_origin_length_check'
  ) THEN
    ALTER TABLE public.routes 
    ADD CONSTRAINT routes_origin_length_check 
    CHECK (LENGTH(origin) <= 200);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'routes_destination_length_check'
  ) THEN
    ALTER TABLE public.routes 
    ADD CONSTRAINT routes_destination_length_check 
    CHECK (LENGTH(destination) <= 200);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'routes_origin_state_length_check'
  ) THEN
    ALTER TABLE public.routes 
    ADD CONSTRAINT routes_origin_state_length_check 
    CHECK (LENGTH(origin_state) = 2);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'routes_destination_state_length_check'
  ) THEN
    ALTER TABLE public.routes 
    ADD CONSTRAINT routes_destination_state_length_check 
    CHECK (LENGTH(destination_state) = 2);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'routes_freight_id_positive_check'
  ) THEN
    ALTER TABLE public.routes 
    ADD CONSTRAINT routes_freight_id_positive_check 
    CHECK (freight_id > 0);
  END IF;
END $$;

-- Check-ins
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'checkins_coords_lat_range_check'
  ) THEN
    ALTER TABLE public.checkins 
    ADD CONSTRAINT checkins_coords_lat_range_check 
    CHECK (coords_lat >= -90 AND coords_lat <= 90);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'checkins_coords_lng_range_check'
  ) THEN
    ALTER TABLE public.checkins 
    ADD CONSTRAINT checkins_coords_lng_range_check 
    CHECK (coords_lng >= -180 AND coords_lng <= 180);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'checkins_photo_url_length_check'
  ) THEN
    ALTER TABLE public.checkins 
    ADD CONSTRAINT checkins_photo_url_length_check 
    CHECK (LENGTH(photo_url) <= 500);
  END IF;
END $$;

-- ============================================
-- 6. COMENTÁRIOS E DOCUMENTAÇÃO
-- ============================================

COMMENT ON FUNCTION validate_email IS 'Valida formato de email e bloqueia domínios temporários';
COMMENT ON FUNCTION validate_phone IS 'Valida telefone brasileiro (10 ou 11 dígitos com DDD válido)';
COMMENT ON FUNCTION validate_cnh IS 'Valida CNH (11 dígitos numéricos)';
COMMENT ON FUNCTION validate_cnpj IS 'Valida CNPJ com algoritmo de dígitos verificadores';
COMMENT ON FUNCTION validate_plate IS 'Valida placa de veículo (antiga ou Mercosul)';
COMMENT ON FUNCTION validate_cep IS 'Valida CEP brasileiro (8 dígitos)';
COMMENT ON FUNCTION validate_full_name IS 'Valida nome completo (mínimo 2 palavras)';
COMMENT ON FUNCTION validate_coordinates IS 'Valida coordenadas GPS (latitude -90 a 90, longitude -180 a 180)';
COMMENT ON FUNCTION validate_photo_url IS 'Valida URL de foto (deve ser HTTP/HTTPS válido)';

COMMENT ON TRIGGER trigger_validate_driver ON public.drivers IS 'Valida dados de motorista antes de inserir/atualizar';
COMMENT ON TRIGGER trigger_validate_client ON public.clients IS 'Valida dados de cliente antes de inserir/atualizar';
COMMENT ON TRIGGER trigger_validate_route ON public.routes IS 'Valida dados de rota antes de inserir/atualizar';
COMMENT ON TRIGGER trigger_validate_checkin ON public.checkins IS 'Valida dados de check-in antes de inserir (GPS, foto, autorização)';

-- ============================================
-- FIM DO SCRIPT
-- ============================================
-- Todas as validações foram implementadas
-- O banco de dados agora valida dados mesmo se o frontend for burlado
-- 
-- PRÓXIMOS PASSOS:
-- 1. Execute o script de teste: supabase/testar-validacoes-completo.sql
-- 2. Verifique os logs para garantir que não há erros
-- 3. Teste inserções inválidas para confirmar que as validações funcionam
-- ============================================

