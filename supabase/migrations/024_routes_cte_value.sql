-- Valor do Conhecimento de Transporte Eletrônico (CTE), preenchido manualmente no painel.
ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS cte_value NUMERIC(14,2);

COMMENT ON COLUMN public.routes.cte_value IS 'Valor de CTE informado manualmente no cadastro do frete.';
