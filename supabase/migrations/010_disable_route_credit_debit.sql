-- SaaS sem bloqueio por saldo: o trigger de débito deixa de alterar credits_balance.

CREATE OR REPLACE FUNCTION public.decrement_credits_on_route_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.decrement_credits_on_route_insert() IS
  'No-op: não debita créditos ao inserir rota (uso ilimitado na plataforma).';
