-- ============================================================
-- 032 - Seguro do frete (alíquota 0% ou 0,2% sobre a NF)
-- ============================================================
-- Valor do seguro = nf_value * seguro_percent/100.
-- Visível para todos os perfis; editável apenas por admin (regra na UI).
-- Desconta do frete líquido (e, portanto, da comissão).

ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS seguro_percent NUMERIC(4,2) NOT NULL DEFAULT 0
  CHECK (seguro_percent IN (0, 0.2));

ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS seguro_value NUMERIC(14,2);

COMMENT ON COLUMN public.routes.seguro_percent IS 'Alíquota do seguro sobre a NF: 0% ou 0,2%. Editável apenas por admin.';
COMMENT ON COLUMN public.routes.seguro_value IS 'Valor do seguro = nf_value * seguro_percent/100.';
