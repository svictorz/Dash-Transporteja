-- Adiciona campos de valor de NF e observação nas rotas/fretes
ALTER TABLE public.routes
ADD COLUMN IF NOT EXISTS nf_value NUMERIC(14,2),
ADD COLUMN IF NOT EXISTS observation TEXT;

