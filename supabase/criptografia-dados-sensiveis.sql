-- ============================================
-- CRIPTOGRAFIA DE DADOS SENSÍVEIS - TRANSPORTEJÁ
-- ============================================
-- Este script implementa criptografia para dados sensíveis
-- como CNH, telefones e outros dados pessoais
-- 
-- IMPORTANTE: Use uma chave de criptografia segura em produção!
-- ============================================

-- ============================================
-- 1. EXTENSÃO PARA CRIPTOGRAFIA
-- ============================================

-- Habilitar extensão pgcrypto (já vem com PostgreSQL)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- 2. CONFIGURAÇÃO DE CHAVE DE CRIPTOGRAFIA
-- ============================================

-- NOTA: Em produção, use uma chave segura armazenada em variável de ambiente
-- ou no Supabase Vault. Esta é apenas para desenvolvimento.

-- Criar função para obter chave de criptografia
-- Em produção, isso deve vir de uma fonte segura (Supabase Vault, env var)
CREATE OR REPLACE FUNCTION get_encryption_key()
RETURNS TEXT AS $$
BEGIN
  -- Em produção, obtenha de Supabase Vault ou variável de ambiente
  -- Por enquanto, usando uma chave fixa (NÃO USE EM PRODUÇÃO!)
  RETURN COALESCE(
    current_setting('app.encryption_key', true),
    'transporteja-encryption-key-2025-change-in-production'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 3. FUNÇÕES DE CRIPTOGRAFIA
-- ============================================

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
  
  -- Usar pgcrypto para criptografar com AES-256
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
  
  -- Descriptografar usando pgcrypto
  BEGIN
    RETURN pgp_sym_decrypt(
      decode(encrypted_text, 'base64')::bytea,
      encryption_key
    );
  EXCEPTION
    WHEN OTHERS THEN
      -- Se falhar, retornar NULL (dados podem não estar criptografados ainda)
      RETURN NULL;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. ADICIONAR COLUNAS CRIPTOGRAFADAS
-- ============================================

-- Adicionar colunas para dados criptografados em drivers
DO $$
BEGIN
  -- CNH criptografada
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'drivers' 
    AND column_name = 'cnh_encrypted'
  ) THEN
    ALTER TABLE public.drivers 
    ADD COLUMN cnh_encrypted TEXT;
  END IF;
  
  -- Telefone criptografado
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'drivers' 
    AND column_name = 'phone_encrypted'
  ) THEN
    ALTER TABLE public.drivers 
    ADD COLUMN phone_encrypted TEXT;
  END IF;
  
  -- Email criptografado (opcional, mas recomendado)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'drivers' 
    AND column_name = 'email_encrypted'
  ) THEN
    ALTER TABLE public.drivers 
    ADD COLUMN email_encrypted TEXT;
  END IF;
END $$;

-- Adicionar colunas para dados criptografados em clients
DO $$
BEGIN
  -- WhatsApp criptografado
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'clients' 
    AND column_name = 'whatsapp_encrypted'
  ) THEN
    ALTER TABLE public.clients 
    ADD COLUMN whatsapp_encrypted TEXT;
  END IF;
  
  -- Email criptografado
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'clients' 
    AND column_name = 'email_encrypted'
  ) THEN
    ALTER TABLE public.clients 
    ADD COLUMN email_encrypted TEXT;
  END IF;
  
  -- CNPJ criptografado (se fornecido)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'clients' 
    AND column_name = 'cnpj_encrypted'
  ) THEN
    ALTER TABLE public.clients 
    ADD COLUMN cnpj_encrypted TEXT;
  END IF;
END $$;

-- ============================================
-- 5. TRIGGERS PARA CRIPTOGRAFAR AUTOMATICAMENTE
-- ============================================

-- Função para criptografar dados de motorista antes de inserir/atualizar
CREATE OR REPLACE FUNCTION encrypt_driver_sensitive_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Criptografar CNH
  IF NEW.cnh IS NOT NULL AND NEW.cnh != '' THEN
    NEW.cnh_encrypted := encrypt_sensitive_data(NEW.cnh);
    -- Manter CNH original para validação (será removido depois)
    -- Em produção, considere remover o campo original após migração
  END IF;
  
  -- Criptografar telefone
  IF NEW.phone IS NOT NULL AND NEW.phone != '' THEN
    NEW.phone_encrypted := encrypt_sensitive_data(NEW.phone);
  END IF;
  
  -- Criptografar email (opcional)
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

-- Função para criptografar dados de cliente antes de inserir/atualizar
CREATE OR REPLACE FUNCTION encrypt_client_sensitive_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Criptografar WhatsApp
  IF NEW.whatsapp IS NOT NULL AND NEW.whatsapp != '' THEN
    NEW.whatsapp_encrypted := encrypt_sensitive_data(NEW.whatsapp);
  END IF;
  
  -- Criptografar email
  IF NEW.email IS NOT NULL AND NEW.email != '' THEN
    NEW.email_encrypted := encrypt_sensitive_data(NEW.email);
  END IF;
  
  -- Criptografar CNPJ (se fornecido)
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema = 'public' 
             AND table_name = 'clients' 
             AND column_name = 'cnpj') THEN
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

-- ============================================
-- 6. VIEWS PARA DESCRIPTOGRAFAR DADOS (SEGURAS)
-- ============================================

-- View para motoristas com dados descriptografados (apenas para usuários autorizados)
CREATE OR REPLACE VIEW drivers_decrypted AS
SELECT 
  id,
  user_id,
  name,
  decrypt_sensitive_data(phone_encrypted) AS phone,
  decrypt_sensitive_data(email_encrypted) AS email,
  decrypt_sensitive_data(cnh_encrypted) AS cnh,
  vehicle,
  plate,
  status,
  location,
  last_checkin,
  created_at,
  updated_at
FROM public.drivers;

-- View para clientes com dados descriptografados
CREATE OR REPLACE VIEW clients_decrypted AS
SELECT 
  id,
  company_name,
  responsible,
  decrypt_sensitive_data(whatsapp_encrypted) AS whatsapp,
  decrypt_sensitive_data(email_encrypted) AS email,
  decrypt_sensitive_data(cnpj_encrypted) AS cnpj,
  address,
  extension,
  city,
  neighborhood,
  state,
  created_at,
  updated_at
FROM public.clients;

-- ============================================
-- 7. RLS PARA VIEWS DESCRIPTOGRAFADAS
-- ============================================

-- Habilitar RLS nas views
ALTER VIEW drivers_decrypted SET (security_invoker = true);
ALTER VIEW clients_decrypted SET (security_invoker = true);

-- Políticas RLS para views (herdam das tabelas originais)
-- As views usam as mesmas políticas das tabelas base

-- ============================================
-- 8. FUNÇÃO PARA MIGRAR DADOS EXISTENTES
-- ============================================

-- Função para migrar dados existentes para formato criptografado
CREATE OR REPLACE FUNCTION migrate_existing_data_to_encrypted()
RETURNS JSONB AS $$
DECLARE
  drivers_updated INTEGER := 0;
  clients_updated INTEGER := 0;
BEGIN
  -- Migrar dados de motoristas
  UPDATE public.drivers
  SET 
    cnh_encrypted = encrypt_sensitive_data(cnh),
    phone_encrypted = encrypt_sensitive_data(phone),
    email_encrypted = encrypt_sensitive_data(email)
  WHERE cnh_encrypted IS NULL 
     OR phone_encrypted IS NULL 
     OR email_encrypted IS NULL;
  
  GET DIAGNOSTICS drivers_updated = ROW_COUNT;
  
  -- Migrar dados de clientes
  UPDATE public.clients
  SET 
    whatsapp_encrypted = encrypt_sensitive_data(whatsapp),
    email_encrypted = encrypt_sensitive_data(email),
    cnpj_encrypted = CASE 
      WHEN EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'clients' 
                   AND column_name = 'cnpj')
      THEN encrypt_sensitive_data(cnpj)
      ELSE NULL
    END
  WHERE whatsapp_encrypted IS NULL 
     OR email_encrypted IS NULL;
  
  GET DIAGNOSTICS clients_updated = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'drivers_updated', drivers_updated,
    'clients_updated', clients_updated,
    'migration_date', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 9. COMENTÁRIOS E DOCUMENTAÇÃO
-- ============================================

COMMENT ON FUNCTION encrypt_sensitive_data IS 'Criptografa dados sensíveis usando AES-256';
COMMENT ON FUNCTION decrypt_sensitive_data IS 'Descriptografa dados sensíveis (apenas para usuários autorizados)';
COMMENT ON FUNCTION encrypt_driver_sensitive_data IS 'Trigger que criptografa automaticamente dados de motorista';
COMMENT ON FUNCTION encrypt_client_sensitive_data IS 'Trigger que criptografa automaticamente dados de cliente';
COMMENT ON FUNCTION migrate_existing_data_to_encrypted IS 'Migra dados existentes para formato criptografado';

COMMENT ON COLUMN public.drivers.cnh_encrypted IS 'CNH criptografada (AES-256)';
COMMENT ON COLUMN public.drivers.phone_encrypted IS 'Telefone criptografado (AES-256)';
COMMENT ON COLUMN public.drivers.email_encrypted IS 'Email criptografado (AES-256)';

COMMENT ON COLUMN public.clients.whatsapp_encrypted IS 'WhatsApp criptografado (AES-256)';
COMMENT ON COLUMN public.clients.email_encrypted IS 'Email criptografado (AES-256)';
COMMENT ON COLUMN public.clients.cnpj_encrypted IS 'CNPJ criptografado (AES-256)';

-- ============================================
-- FIM DO SCRIPT
-- ============================================
-- Criptografia de dados sensíveis implementada!
-- 
-- PRÓXIMOS PASSOS:
-- 1. Configure uma chave de criptografia segura em produção
-- 2. Execute migrate_existing_data_to_encrypted() para migrar dados existentes
-- 3. Atualize o frontend para usar as views descriptografadas
-- 4. Considere remover campos originais após migração completa
-- ============================================

