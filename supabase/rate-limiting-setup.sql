-- ============================================
-- RATE LIMITING - TRANSPORTEJÁ
-- ============================================
-- Este script implementa rate limiting no banco de dados
-- para proteger contra abuso e ataques
-- ============================================

-- ============================================
-- 1. TABELA DE RATE LIMITING
-- ============================================

CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  identifier TEXT NOT NULL, -- IP, user_id, ou outro identificador
  endpoint TEXT NOT NULL, -- Rota/endpoint sendo acessado
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blocked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(identifier, endpoint, window_start)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON public.rate_limits(identifier);
CREATE INDEX IF NOT EXISTS idx_rate_limits_endpoint ON public.rate_limits(endpoint);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON public.rate_limits(window_start);
CREATE INDEX IF NOT EXISTS idx_rate_limits_blocked_until ON public.rate_limits(blocked_until);

-- ============================================
-- 2. CONFIGURAÇÃO DE LIMITES
-- ============================================

-- Tabela de configuração de rate limits por endpoint
CREATE TABLE IF NOT EXISTS public.rate_limit_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  endpoint TEXT NOT NULL UNIQUE,
  max_requests INTEGER NOT NULL DEFAULT 100,
  window_seconds INTEGER NOT NULL DEFAULT 60, -- Janela de tempo em segundos
  block_duration_seconds INTEGER NOT NULL DEFAULT 300, -- Duração do bloqueio em segundos
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

-- ============================================
-- 3. FUNÇÃO PARA VERIFICAR RATE LIMIT
-- ============================================

CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier TEXT,
  p_endpoint TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_config RECORD;
  v_rate_limit RECORD;
  v_current_count INTEGER;
  v_window_start TIMESTAMPTZ;
  v_is_blocked BOOLEAN := FALSE;
  v_remaining_requests INTEGER;
  v_reset_at TIMESTAMPTZ;
BEGIN
  -- Buscar configuração do endpoint (ou usar padrão *)
  SELECT * INTO v_config
  FROM public.rate_limit_config
  WHERE endpoint = p_endpoint
     OR endpoint = '*'
  ORDER BY CASE WHEN endpoint = p_endpoint THEN 0 ELSE 1 END
  LIMIT 1;
  
  -- Se não houver configuração, permitir (sem limite)
  IF v_config IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'remaining', 999999,
      'reset_at', NOW() + INTERVAL '1 minute'
    );
  END IF;
  
  -- Calcular início da janela atual
  v_window_start := date_trunc('second', NOW() - 
    (EXTRACT(EPOCH FROM (NOW() - date_trunc('minute', NOW())))::INTEGER % v_config.window_seconds)::INTERVAL
  );
  
  -- Verificar se está bloqueado
  SELECT * INTO v_rate_limit
  FROM public.rate_limit_config
  WHERE endpoint = p_endpoint
     OR endpoint = '*'
  ORDER BY CASE WHEN endpoint = p_endpoint THEN 0 ELSE 1 END
  LIMIT 1;
  
  -- Verificar bloqueio anterior
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
  
  -- Buscar ou criar registro de rate limit
  INSERT INTO public.rate_limits (identifier, endpoint, request_count, window_start)
  VALUES (p_identifier, p_endpoint, 1, v_window_start)
  ON CONFLICT (identifier, endpoint, window_start)
  DO UPDATE SET
    request_count = rate_limits.request_count + 1,
    updated_at = NOW()
  RETURNING * INTO v_rate_limit;
  
  -- Verificar se excedeu o limite
  IF v_rate_limit.request_count > v_config.max_requests THEN
    -- Bloquear
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
  
  -- Calcular requisições restantes
  v_remaining_requests := GREATEST(0, v_config.max_requests - v_rate_limit.request_count);
  v_reset_at := v_window_start + (v_config.window_seconds || ' seconds')::INTERVAL;
  
  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', v_remaining_requests,
    'limit', v_config.max_requests,
    'reset_at', v_reset_at,
    'window_seconds', v_config.window_seconds
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. FUNÇÃO PARA LIMPAR REGISTROS ANTIGOS
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Deletar registros mais antigos que 24 horas e não bloqueados
  DELETE FROM public.rate_limits
  WHERE window_start < NOW() - INTERVAL '24 hours'
    AND (blocked_until IS NULL OR blocked_until < NOW());
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. TRIGGER PARA ATUALIZAR updated_at
-- ============================================

CREATE TRIGGER update_rate_limits_updated_at
  BEFORE UPDATE ON public.rate_limits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rate_limit_config_updated_at
  BEFORE UPDATE ON public.rate_limit_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_config ENABLE ROW LEVEL SECURITY;

-- Políticas para rate_limits (apenas sistema pode ler/escrever)
CREATE POLICY "System can manage rate limits" ON public.rate_limits
  FOR ALL USING (false); -- Nenhum acesso direto, apenas via funções

-- Políticas para rate_limit_config (admins podem ler)
CREATE POLICY "Admins can read rate limit config" ON public.rate_limit_config
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- 7. FUNÇÃO HELPER PARA OBTER IDENTIFICADOR
-- ============================================

-- Função para obter identificador do usuário (IP ou user_id)
CREATE OR REPLACE FUNCTION get_rate_limit_identifier()
RETURNS TEXT AS $$
DECLARE
  v_user_id UUID;
  v_ip_address TEXT;
BEGIN
  -- Tentar obter user_id da sessão
  v_user_id := auth.uid();
  
  IF v_user_id IS NOT NULL THEN
    RETURN 'user:' || v_user_id::TEXT;
  END IF;
  
  -- Se não autenticado, usar IP (se disponível)
  v_ip_address := current_setting('request.headers', true)::json->>'x-forwarded-for';
  
  IF v_ip_address IS NOT NULL THEN
    RETURN 'ip:' || v_ip_address;
  END IF;
  
  -- Fallback para 'anonymous'
  RETURN 'anonymous';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. COMENTÁRIOS E DOCUMENTAÇÃO
-- ============================================

COMMENT ON TABLE public.rate_limits IS 'Registra requisições para controle de rate limiting';
COMMENT ON TABLE public.rate_limit_config IS 'Configuração de limites por endpoint';

COMMENT ON FUNCTION check_rate_limit IS 'Verifica se uma requisição está dentro do limite permitido';
COMMENT ON FUNCTION cleanup_old_rate_limits IS 'Remove registros antigos de rate limiting';
COMMENT ON FUNCTION get_rate_limit_identifier IS 'Obtém identificador para rate limiting (user_id ou IP)';

-- ============================================
-- FIM DO SCRIPT
-- ============================================
-- Rate limiting implementado!
-- 
-- PRÓXIMOS PASSOS:
-- 1. Integrar check_rate_limit() nas funções SQL críticas
-- 2. Criar middleware no frontend para verificar rate limits
-- 3. Configurar limites apropriados para cada endpoint
-- 4. Monitorar e ajustar limites conforme necessário
-- ============================================

