-- ============================================
-- CONFORMIDADE LGPD - TRANSPORTEJÁ
-- ============================================
-- Este script cria as tabelas e funções necessárias
-- para conformidade com a Lei Geral de Proteção de Dados (LGPD)
-- Execute este script no SQL Editor do Supabase
-- ============================================

-- ============================================
-- 1. TABELA DE CONSENTIMENTOS
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_consents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('cookies', 'location', 'camera', 'analytics', 'marketing')),
  granted BOOLEAN NOT NULL DEFAULT false,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, consent_type)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_user_consents_user_id ON public.user_consents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_consents_consent_type ON public.user_consents(consent_type);
CREATE INDEX IF NOT EXISTS idx_user_consents_created_at ON public.user_consents(created_at);

-- ============================================
-- 2. TABELA DE LOGS DE ACESSO A DADOS PESSOAIS
-- ============================================

CREATE TABLE IF NOT EXISTS public.data_access_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  accessed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  data_type TEXT NOT NULL CHECK (data_type IN ('personal_info', 'location', 'photo', 'checkin', 'route', 'driver', 'client')),
  action TEXT NOT NULL CHECK (action IN ('view', 'export', 'delete', 'update', 'create')),
  ip_address TEXT,
  user_agent TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_data_access_logs_user_id ON public.data_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_data_access_logs_accessed_by ON public.data_access_logs(accessed_by);
CREATE INDEX IF NOT EXISTS idx_data_access_logs_data_type ON public.data_access_logs(data_type);
CREATE INDEX IF NOT EXISTS idx_data_access_logs_created_at ON public.data_access_logs(created_at);

-- ============================================
-- 3. TABELA DE SOLICITAÇÕES LGPD
-- ============================================

CREATE TABLE IF NOT EXISTS public.lgpd_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('export', 'delete', 'rectification', 'portability')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected', 'cancelled')),
  requested_data JSONB,
  response_data JSONB,
  processed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  processed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_lgpd_requests_user_id ON public.lgpd_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_lgpd_requests_request_type ON public.lgpd_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_lgpd_requests_status ON public.lgpd_requests(status);
CREATE INDEX IF NOT EXISTS idx_lgpd_requests_created_at ON public.lgpd_requests(created_at);

-- ============================================
-- 4. FUNÇÕES AUXILIARES
-- ============================================

-- Função para registrar acesso a dados pessoais
CREATE OR REPLACE FUNCTION log_data_access(
  p_user_id UUID,
  p_data_type TEXT,
  p_action TEXT,
  p_details JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
  v_session_user_id UUID;
  v_ip_address TEXT;
  v_user_agent TEXT;
BEGIN
  -- Obter ID do usuário da sessão atual
  v_session_user_id := auth.uid();
  
  -- Criar log de acesso
  INSERT INTO public.data_access_logs (
    user_id,
    accessed_by,
    data_type,
    action,
    details,
    ip_address,
    user_agent
  ) VALUES (
    p_user_id,
    v_session_user_id,
    p_data_type,
    p_action,
    p_details,
    current_setting('request.headers', true)::json->>'x-forwarded-for',
    current_setting('request.headers', true)::json->>'user-agent'
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para exportar dados pessoais do usuário
CREATE OR REPLACE FUNCTION export_user_data(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_user_data JSONB;
  v_driver_data JSONB;
  v_routes_data JSONB;
  v_checkins_data JSONB;
  v_consents_data JSONB;
  v_result JSONB;
BEGIN
  -- Dados do usuário
  SELECT to_jsonb(u.*) INTO v_user_data
  FROM public.users u
  WHERE u.id = p_user_id;
  
  -- Dados do motorista (se existir)
  SELECT jsonb_agg(to_jsonb(d.*)) INTO v_driver_data
  FROM public.drivers d
  WHERE d.user_id = p_user_id;
  
  -- Rotas do motorista
  SELECT jsonb_agg(to_jsonb(r.*)) INTO v_routes_data
  FROM public.routes r
  INNER JOIN public.drivers d ON d.id = r.driver_id
  WHERE d.user_id = p_user_id;
  
  -- Check-ins do motorista
  SELECT jsonb_agg(to_jsonb(c.*)) INTO v_checkins_data
  FROM public.checkins c
  WHERE c.driver_id IN (
    SELECT id FROM public.drivers WHERE user_id = p_user_id
  );
  
  -- Consentimentos
  SELECT jsonb_agg(to_jsonb(uc.*)) INTO v_consents_data
  FROM public.user_consents uc
  WHERE uc.user_id = p_user_id;
  
  -- Montar resultado
  v_result := jsonb_build_object(
    'user', v_user_data,
    'driver', COALESCE(v_driver_data, '[]'::jsonb),
    'routes', COALESCE(v_routes_data, '[]'::jsonb),
    'checkins', COALESCE(v_checkins_data, '[]'::jsonb),
    'consents', COALESCE(v_consents_data, '[]'::jsonb),
    'exported_at', NOW()
  );
  
  -- Registrar log
  PERFORM log_data_access(
    p_user_id,
    'personal_info',
    'export',
    jsonb_build_object('export_type', 'full')
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para excluir dados pessoais (direito ao esquecimento)
CREATE OR REPLACE FUNCTION delete_user_data(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_deleted_count JSONB;
  v_drivers_deleted INTEGER := 0;
  v_routes_deleted INTEGER := 0;
  v_checkins_deleted INTEGER := 0;
  v_consents_deleted INTEGER := 0;
BEGIN
  -- Registrar log antes de deletar
  PERFORM log_data_access(
    p_user_id,
    'personal_info',
    'delete',
    jsonb_build_object('delete_type', 'right_to_be_forgotten')
  );
  
  -- Deletar check-ins do motorista
  DELETE FROM public.checkins
  WHERE driver_id IN (
    SELECT id FROM public.drivers WHERE user_id = p_user_id
  );
  GET DIAGNOSTICS v_checkins_deleted = ROW_COUNT;
  
  -- Deletar rotas do motorista
  DELETE FROM public.routes
  WHERE driver_id IN (
    SELECT id FROM public.drivers WHERE user_id = p_user_id
  );
  GET DIAGNOSTICS v_routes_deleted = ROW_COUNT;
  
  -- Deletar motorista
  DELETE FROM public.drivers
  WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_drivers_deleted = ROW_COUNT;
  
  -- Deletar consentimentos
  DELETE FROM public.user_consents
  WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_consents_deleted = ROW_COUNT;
  
  -- Anonimizar dados do usuário (não deletar completamente para manter histórico)
  UPDATE public.users
  SET 
    email = 'deleted_' || id::text || '@deleted.local',
    name = 'Usuário Deletado'
  WHERE id = p_user_id;
  
  -- Deletar logs de acesso (opcional - pode manter para auditoria)
  -- DELETE FROM public.data_access_logs WHERE user_id = p_user_id;
  
  v_deleted_count := jsonb_build_object(
    'drivers', v_drivers_deleted,
    'routes', v_routes_deleted,
    'checkins', v_checkins_deleted,
    'consents', v_consents_deleted,
    'deleted_at', NOW()
  );
  
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. TRIGGERS
-- ============================================

-- Trigger para atualizar updated_at em user_consents
CREATE TRIGGER update_user_consents_updated_at
  BEFORE UPDATE ON public.user_consents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para atualizar updated_at em lgpd_requests
CREATE TRIGGER update_lgpd_requests_updated_at
  BEFORE UPDATE ON public.lgpd_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lgpd_requests ENABLE ROW LEVEL SECURITY;

-- Políticas para user_consents
CREATE POLICY "Users can read own consents" ON public.user_consents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own consents" ON public.user_consents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own consents" ON public.user_consents
  FOR UPDATE USING (auth.uid() = user_id);

-- Políticas para data_access_logs
CREATE POLICY "Users can read own access logs" ON public.data_access_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all access logs" ON public.data_access_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Políticas para lgpd_requests
CREATE POLICY "Users can read own LGPD requests" ON public.lgpd_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own LGPD requests" ON public.lgpd_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can read all LGPD requests" ON public.lgpd_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update LGPD requests" ON public.lgpd_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- 7. COMENTÁRIOS E DOCUMENTAÇÃO
-- ============================================

COMMENT ON TABLE public.user_consents IS 'Armazena consentimentos LGPD dos usuários (cookies, localização, câmera, etc.)';
COMMENT ON TABLE public.data_access_logs IS 'Registra todos os acessos a dados pessoais para auditoria LGPD';
COMMENT ON TABLE public.lgpd_requests IS 'Solicitações LGPD (exportação, exclusão, retificação, portabilidade)';

COMMENT ON FUNCTION log_data_access IS 'Registra acesso a dados pessoais para auditoria LGPD';
COMMENT ON FUNCTION export_user_data IS 'Exporta todos os dados pessoais do usuário em formato JSON';
COMMENT ON FUNCTION delete_user_data IS 'Exclui dados pessoais do usuário (direito ao esquecimento)';

-- ============================================
-- FIM DO SCRIPT
-- ============================================
-- Estrutura LGPD criada com sucesso!
-- 
-- PRÓXIMOS PASSOS:
-- 1. Implementar banner de consentimento no frontend
-- 2. Criar páginas legais (Política de Privacidade, Termos de Uso)
-- 3. Criar página de gerenciamento de dados pessoais
-- 4. Implementar serviços de exportação e exclusão
-- ============================================

