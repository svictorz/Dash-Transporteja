-- ============================================
-- CRÉDITOS + CLIENTES (CNPJ) - SETUP SUPABASE
-- ============================================
-- Cole este conteúdo no SQL Editor do Supabase e execute (Run).
-- Não altera dados existentes; adiciona colunas e trigger necessários.
-- ============================================

-- 1) Coluna de créditos em users
-- ============================================
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS credits_balance INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.users.credits_balance IS 'Créditos para criação de rotas; debitado automaticamente ao inserir em routes';

-- Garantir que o saldo nunca fique negativo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_credits_balance_non_negative'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_credits_balance_non_negative
      CHECK (credits_balance >= 0);
  END IF;
END $$;

-- 2) Coluna cnpj em clients (se ainda não existir)
-- ============================================
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS cnpj TEXT;

COMMENT ON COLUMN public.clients.cnpj IS 'CNPJ da empresa (validação e auto-preenchimento via Brasil API no app)';

-- 3) Função que debita 1 crédito do usuário ao criar rota
-- ============================================
-- Usa auth.uid() para saber quem está criando a rota (Supabase injeta o JWT).
-- Se o usuário não tiver créditos, a inserção da rota é revertida (RAISE EXCEPTION).
CREATE OR REPLACE FUNCTION public.decrement_credits_on_route_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_updated integer;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.users
  SET credits_balance = credits_balance - 1
  WHERE id = v_uid AND credits_balance >= 1;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Saldo de créditos insuficiente para criar rota. Adquira mais créditos para continuar.';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.decrement_credits_on_route_insert() IS 'Debita 1 crédito do usuário logado ao inserir uma nova rota; falha se saldo < 1';

-- 4) Trigger: após inserir em routes, debitar crédito
-- ============================================
DROP TRIGGER IF EXISTS trigger_decrement_credits_on_route_insert ON public.routes;

CREATE TRIGGER trigger_decrement_credits_on_route_insert
  AFTER INSERT ON public.routes
  FOR EACH ROW
  EXECUTE FUNCTION public.decrement_credits_on_route_insert();

-- 5) (Opcional) Dar créditos iniciais para usuários existentes
-- ============================================
-- Descomente e ajuste o valor se quiser que usuários já cadastrados comecem com créditos:
-- UPDATE public.users SET credits_balance = 10 WHERE credits_balance = 0;

-- ============================================
-- FIM
-- ============================================
-- Após executar:
-- 1) Novos usuários começam com credits_balance = 0 (padrão).
-- 2) Para criar rotas, o usuário precisa ter pelo menos 1 crédito.
-- 3) Para dar créditos: UPDATE public.users SET credits_balance = credits_balance + N WHERE id = '...';
-- 4) O app já exibe "Créditos: X" na TopBar e bloqueia criação de rota se saldo < 1.
