-- ============================================================
-- 046 - COMISSAO PAGA: LIBERA FINANCEIRO E FISCAL
-- ============================================================
-- Contexto:
--   A migration 031 criou o trigger routes_guard_commission_paid, que
--   derruba qualquer alteracao de routes.commission_paid feita por quem
--   nao e admin puro (public.is_admin()).
--
--   Com o Controle Financeiro aberto a financeiro e fiscal, esse guard
--   passa a ser o unico ponto que ainda recusa o salvamento — e falha
--   como excecao no meio do UPDATE, nao como campo desabilitado.
--
-- Decisao:
--   financeiro e fiscal passam a marcar comissao como paga, no mesmo
--   escopo de admin. Reaproveita is_admin_or_financeiro(), que a 045
--   deixou como ['admin','financeiro','fiscal'] — assim o guard e as
--   policies de routes seguem a mesma lista, sem duas fontes de verdade.
--
--   Comercial e supervisor continuam sem poder alterar o campo.
--
-- Idempotente.

CREATE OR REPLACE FUNCTION public.routes_guard_commission_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.commission_paid IS DISTINCT FROM NEW.commission_paid THEN
    IF NOT public.is_admin_or_financeiro() THEN
      RAISE EXCEPTION 'Apenas admin, financeiro ou fiscal podem alterar o status de pagamento da comissao.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON COLUMN public.routes.commission_paid IS
  'Indica se a comissao do comercial ja foi paga. Alteravel por admin, financeiro e fiscal.';

-- ============================================================
-- FIM
-- ============================================================
