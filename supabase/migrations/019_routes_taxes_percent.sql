-- ============================================================
-- 019 - Percentual de tributos configurável (0 / 10 / 12 / 18)
-- ============================================================
-- Apenas o dashboard usa este valor para recalcular taxes_value.
-- Padrão histórico: 18%.

ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS taxes_percent SMALLINT NOT NULL DEFAULT 18
  CHECK (taxes_percent IN (0, 10, 12, 18));

-- Backfill: tenta inferir o percentual a partir de freight_value e taxes_value
UPDATE public.routes r
SET taxes_percent = sub.inferred
FROM (
  SELECT
    id,
    CASE
      WHEN freight_value IS NULL OR freight_value::numeric <= 0 OR taxes_value IS NULL THEN 18::smallint
      WHEN taxes_value::numeric = 0 THEN 0::smallint
      WHEN ABS((taxes_value::numeric / NULLIF(freight_value::numeric, 0)) * 100 - 18) <= 1.5 THEN 18::smallint
      WHEN ABS((taxes_value::numeric / NULLIF(freight_value::numeric, 0)) * 100 - 12) <= 1.5 THEN 12::smallint
      WHEN ABS((taxes_value::numeric / NULLIF(freight_value::numeric, 0)) * 100 - 10) <= 1.5 THEN 10::smallint
      WHEN ABS((taxes_value::numeric / NULLIF(freight_value::numeric, 0)) * 100) <= 1.5 THEN 0::smallint
      ELSE 18::smallint
    END AS inferred
  FROM public.routes
) sub
WHERE r.id = sub.id;
