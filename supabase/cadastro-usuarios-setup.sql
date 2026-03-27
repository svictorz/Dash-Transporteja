-- ============================================
-- CADASTRO DE NOVOS USUÁRIOS — SETUP SUPABASE
-- ============================================
-- Execute este script no SQL Editor do Supabase.
-- Adiciona colunas para onboarding e função RPC de créditos de boas-vindas.
-- ============================================

-- 1) Colunas na tabela users
-- ============================================
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS company_name TEXT;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS company_cnpj TEXT;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.users.terms_accepted_at IS 'Data/hora em que o usuário aceitou Termos de Uso e Política de Privacidade';
COMMENT ON COLUMN public.users.company_name IS 'Nome da empresa do operador (opcional no onboarding)';
COMMENT ON COLUMN public.users.company_cnpj IS 'CNPJ da empresa do operador (opcional no onboarding)';
COMMENT ON COLUMN public.users.onboarding_completed IS 'Se true, o usuário já concluiu o passo de boas-vindas e recebeu créditos iniciais';

-- 2) Função RPC: atribuir créditos de boas-vindas e marcar onboarding concluído
-- ============================================
-- Evita double-submit: só atualiza se onboarding_completed = FALSE.
CREATE OR REPLACE FUNCTION public.complete_onboarding(welcome_credits INTEGER DEFAULT 5)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET credits_balance = credits_balance + welcome_credits,
      onboarding_completed = TRUE
  WHERE id = auth.uid() AND onboarding_completed = FALSE;
END;
$$;

COMMENT ON FUNCTION public.complete_onboarding(INTEGER) IS 'Marca onboarding como concluído e adiciona créditos de boas-vindas ao usuário logado (apenas se ainda não concluído)';
