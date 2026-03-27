-- ============================================
-- EXECUTAR TUDO - CRIPTOGRAFIA E RATE LIMITING
-- ============================================
-- Copie e cole este arquivo completo no SQL Editor do Supabase
-- Execute tudo de uma vez ou seção por seção
-- ============================================

-- ============================================
-- PARTE 1: CRIPTOGRAFIA DE DADOS SENSÍVEIS
-- ============================================

-- Habilitar extensão pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Função para obter chave de criptografia
CREATE OR REPLACE FUNCTION get_encryption_key()
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(
    current_setting('app.encryption_key', true),
    'transporteja-encryption-key-2025-change-in-production'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para criptografar texto
CREATE OR REPLACE FUNCTION encrypt_sensitive_data(data_text TEXT)
RETURNS TEXT AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  IF data_text IS NULL OR data_text = '' THEN
    RETURN NULL;
  END IF;
  
  encryption_key := get_encryption_key();
  
  RETURN encode(
    pgp_sym_encrypt(data_text, encryption_key, 'compress-algo=1, cipher-algo=aes256'),
    'base64'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para descriptografar texto
CREATE OR REPLACE FUNCTION decrypt_sensitive_data(encrypted_text TEXT)
RETURNS TEXT AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  IF encrypted_text IS NULL OR encrypted_text = '' THEN
    RETURN NULL;
  END IF;
  
  encryption_key := get_encryption_key();
  
  BEGIN
    RETURN pgp_sym_decrypt(
      decode(encrypted_text, 'base64')::bytea,
      encryption_key
    );
  EXCEPTION
    WHEN OTHERS THEN
      RETURN NULL;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Adicionar colunas criptografadas em drivers
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'cnh_encrypted') THEN
    ALTER TABLE public.drivers ADD COLUMN cnh_encrypted TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'phone_encrypted') THEN
    ALTER TABLE public.drivers ADD COLUMN phone_encrypted TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'email_encrypted') THEN
    ALTER TABLE public.drivers ADD COLUMN email_encrypted TEXT;
  END IF;
END $$;

-- Adicionar colunas criptografadas em clients
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'whatsapp_encrypted') THEN
    ALTER TABLE public.clients ADD COLUMN whatsapp_encrypted TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'email_encrypted') THEN
    ALTER TABLE public.clients ADD COLUMN email_encrypted TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'cnpj_encrypted') THEN
    ALTER TABLE public.clients ADD COLUMN cnpj_encrypted TEXT;
  END IF;
END $$;

-- Função para criptografar dados de motorista
CREATE OR REPLACE FUNCTION encrypt_driver_sensitive_data()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.cnh IS NOT NULL AND NEW.cnh != '' THEN
    NEW.cnh_encrypted := encrypt_sensitive_data(NEW.cnh);
  END IF;
  
  IF NEW.phone IS NOT NULL AND NEW.phone != '' THEN
    NEW.phone_encrypted := encrypt_sensitive_data(NEW.phone);
  END IF;
  
  IF NEW.email IS NOT NULL AND NEW.email != '' THEN
    NEW.email_encrypted := encrypt_sensitive_data(NEW.email);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para criptografar dados de motorista
DROP TRIGGER IF EXISTS trigger_encrypt_driver_data ON public.drivers;
CREATE TRIGGER trigger_encrypt_driver_data
  BEFORE INSERT OR UPDATE ON public.drivers
  FOR EACH ROW
  EXECUTE FUNCTION encrypt_driver_sensitive_data();

-- Função para criptografar dados de cliente
CREATE OR REPLACE FUNCTION encrypt_client_sensitive_data()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.whatsapp IS NOT NULL AND NEW.whatsapp != '' THEN
    NEW.whatsapp_encrypted := encrypt_sensitive_data(NEW.whatsapp);
  END IF;
  
  IF NEW.email IS NOT NULL AND NEW.email != '' THEN
    NEW.email_encrypted := encrypt_sensitive_data(NEW.email);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'cnpj') THEN
    IF NEW.cnpj IS NOT NULL AND NEW.cnpj != '' THEN
      NEW.cnpj_encrypted := encrypt_sensitive_data(NEW.cnpj);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para criptografar dados de cliente
DROP TRIGGER IF EXISTS trigger_encrypt_client_data ON public.clients;
CREATE TRIGGER trigger_encrypt_client_data
  BEFORE INSERT OR UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION encrypt_client_sensitive_data();

-- Views descriptografadas
CREATE OR REPLACE VIEW drivers_decrypted AS
SELECT 
  id, user_id, name,
  decrypt_sensitive_data(phone_encrypted) AS phone,
  decrypt_sensitive_data(email_encrypted) AS email,
  decrypt_sensitive_data(cnh_encrypted) AS cnh,
  vehicle, plate, status, location, last_checkin, created_at, updated_at
FROM public.drivers;

CREATE OR REPLACE VIEW clients_decrypted AS
SELECT 
  id, company_name, responsible,
  decrypt_sensitive_data(whatsapp_encrypted) AS whatsapp,
  decrypt_sensitive_data(email_encrypted) AS email,
  decrypt_sensitive_data(cnpj_encrypted) AS cnpj,
  address, extension, city, neighborhood, state, created_at, updated_at
FROM public.clients;

-- Função para migrar dados existentes
CREATE OR REPLACE FUNCTION migrate_existing_data_to_encrypted()
RETURNS JSONB AS $$
DECLARE
  drivers_updated INTEGER := 0;
  clients_updated INTEGER := 0;
BEGIN
  UPDATE public.drivers
  SET 
    cnh_encrypted = encrypt_sensitive_data(cnh),
    phone_encrypted = encrypt_sensitive_data(phone),
    email_encrypted = encrypt_sensitive_data(email)
  WHERE cnh_encrypted IS NULL OR phone_encrypted IS NULL OR email_encrypted IS NULL;
  
  GET DIAGNOSTICS drivers_updated = ROW_COUNT;
  
  UPDATE public.clients
  SET 
    whatsapp_encrypted = encrypt_sensitive_data(whatsapp),
    email_encrypted = encrypt_sensitive_data(email),
    cnpj_encrypted = CASE 
      WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'cnpj')
      THEN encrypt_sensitive_data(cnpj)
      ELSE NULL
    END
  WHERE whatsapp_encrypted IS NULL OR email_encrypted IS NULL;
  
  GET DIAGNOSTICS clients_updated = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'drivers_updated', drivers_updated,
    'clients_updated', clients_updated,
    'migration_date', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PARTE 2: RATE LIMITING
-- ============================================

-- Tabela de rate limits
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  identifier TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blocked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(identifier, endpoint, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON public.rate_limits(identifier);
CREATE INDEX IF NOT EXISTS idx_rate_limits_endpoint ON public.rate_limits(endpoint);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON public.rate_limits(window_start);
CREATE INDEX IF NOT EXISTS idx_rate_limits_blocked_until ON public.rate_limits(blocked_until);

-- Tabela de configuração
CREATE TABLE IF NOT EXISTS public.rate_limit_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  endpoint TEXT NOT NULL UNIQUE,
  max_requests INTEGER NOT NULL DEFAULT 100,
  window_seconds INTEGER NOT NULL DEFAULT 60,
  block_duration_seconds INTEGER NOT NULL DEFAULT 300,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir configurações padrão
INSERT INTO public.rate_limit_config (endpoint, max_requests, window_seconds, block_duration_seconds, description)
VALUES
  ('/api/auth/login', 5, 60, 900, 'Login: 5 tentativas por minuto, bloqueio de 15 minutos'),
  ('/api/auth/signup', 3, 3600, 3600, 'Registro: 3 tentativas por hora, bloqueio de 1 hora'),
  ('/api/checkins', 60, 60, 300, 'Check-ins: 60 por minuto, bloqueio de 5 minutos'),
  ('/api/drivers', 100, 60, 300, 'Motoristas: 100 requisições por minuto'),
  ('/api/routes', 100, 60, 300, 'Rotas: 100 requisições por minuto'),
  ('/api/clients', 100, 60, 300, 'Clientes: 100 requisições por minuto'),
  ('/api/export-data', 5, 3600, 3600, 'Exportação de dados: 5 por hora'),
  ('/api/delete-data', 3, 86400, 86400, 'Exclusão de dados: 3 por dia'),
  ('*', 1000, 60, 600, 'Geral: 1000 requisições por minuto')
ON CONFLICT (endpoint) DO NOTHING;

-- Função para obter identificador
CREATE OR REPLACE FUNCTION get_rate_limit_identifier()
RETURNS TEXT AS $$
DECLARE
  v_user_id UUID;
  v_ip_address TEXT;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NOT NULL THEN
    RETURN 'user:' || v_user_id::TEXT;
  END IF;
  
  v_ip_address := current_setting('request.headers', true)::json->>'x-forwarded-for';
  
  IF v_ip_address IS NOT NULL THEN
    RETURN 'ip:' || v_ip_address;
  END IF;
  
  RETURN 'anonymous';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para verificar rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier TEXT,
  p_endpoint TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_config RECORD;
  v_rate_limit RECORD;
  v_window_start TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_config
  FROM public.rate_limit_config
  WHERE endpoint = p_endpoint OR endpoint = '*'
  ORDER BY CASE WHEN endpoint = p_endpoint THEN 0 ELSE 1 END
  LIMIT 1;
  
  IF v_config IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'remaining', 999999, 'reset_at', NOW() + INTERVAL '1 minute');
  END IF;
  
  v_window_start := date_trunc('second', NOW() - (EXTRACT(EPOCH FROM (NOW() - date_trunc('minute', NOW())))::INTEGER % v_config.window_seconds)::INTERVAL);
  
  SELECT * INTO v_rate_limit
  FROM public.rate_limits
  WHERE identifier = p_identifier
    AND endpoint = p_endpoint
    AND blocked_until IS NOT NULL
    AND blocked_until > NOW()
  LIMIT 1;
  
  IF v_rate_limit IS NOT NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'blocked', true,
      'blocked_until', v_rate_limit.blocked_until,
      'message', 'Você foi bloqueado por exceder o limite de requisições. Tente novamente mais tarde.'
    );
  END IF;
  
  INSERT INTO public.rate_limits (identifier, endpoint, request_count, window_start)
  VALUES (p_identifier, p_endpoint, 1, v_window_start)
  ON CONFLICT (identifier, endpoint, window_start)
  DO UPDATE SET request_count = rate_limits.request_count + 1, updated_at = NOW()
  RETURNING * INTO v_rate_limit;
  
  IF v_rate_limit.request_count > v_config.max_requests THEN
    UPDATE public.rate_limits
    SET blocked_until = NOW() + (v_config.block_duration_seconds || ' seconds')::INTERVAL
    WHERE id = v_rate_limit.id;
    
    RETURN jsonb_build_object(
      'allowed', false,
      'blocked', true,
      'blocked_until', NOW() + (v_config.block_duration_seconds || ' seconds')::INTERVAL,
      'message', 'Limite de requisições excedido. Você foi bloqueado temporariamente.'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', GREATEST(0, v_config.max_requests - v_rate_limit.request_count),
    'limit', v_config.max_requests,
    'reset_at', v_window_start + (v_config.window_seconds || ' seconds')::INTERVAL,
    'window_seconds', v_config.window_seconds
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para limpar registros antigos
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.rate_limits
  WHERE window_start < NOW() - INTERVAL '24 hours'
    AND (blocked_until IS NULL OR blocked_until < NOW());
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
DROP TRIGGER IF EXISTS update_rate_limits_updated_at ON public.rate_limits;
CREATE TRIGGER update_rate_limits_updated_at
  BEFORE UPDATE ON public.rate_limits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_rate_limit_config_updated_at ON public.rate_limit_config;
CREATE TRIGGER update_rate_limit_config_updated_at
  BEFORE UPDATE ON public.rate_limit_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "System can manage rate limits" ON public.rate_limits;
CREATE POLICY "System can manage rate limits" ON public.rate_limits
  FOR ALL USING (false);

DROP POLICY IF EXISTS "Admins can read rate limit config" ON public.rate_limit_config;
CREATE POLICY "Admins can read rate limit config" ON public.rate_limit_config
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- PARTE 3: MIGRAR DADOS EXISTENTES (OPCIONAL)
-- ============================================
-- Descomente a linha abaixo para migrar dados existentes para formato criptografado
-- SELECT migrate_existing_data_to_encrypted();

-- ============================================
-- FIM
-- ============================================
-- Tudo foi executado com sucesso!
-- 
-- PRÓXIMOS PASSOS:
-- 1. Configure uma chave de criptografia segura (Supabase Vault)
-- 2. Execute: SELECT migrate_existing_data_to_encrypted(); (se tiver dados existentes)
-- 3. Teste as funcionalidades
-- ============================================

