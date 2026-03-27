-- ============================================
-- CONFIGURAR 10 CRÉDITOS POR NOVA ROTA
-- ============================================
-- Execute no SQL Editor do Supabase.
-- Substitui a função que debita créditos ao criar rota: de 1 para 10 créditos por rota.
-- ============================================

CREATE OR REPLACE FUNCTION public.decrement_credits_on_route_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_updated integer;
  v_credits_per_route integer := 10;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.users
  SET credits_balance = credits_balance - v_credits_per_route
  WHERE id = v_uid AND credits_balance >= v_credits_per_route;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Saldo de créditos insuficiente para criar rota. Cada rota consome 10 créditos. Adquira mais créditos para continuar.';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.decrement_credits_on_route_insert() IS 'Debita 10 créditos do usuário logado ao inserir uma nova rota; falha se saldo < 10';
