-- Meta de lucro líquido é independente dos valores históricos dos fretes.
ALTER TABLE public.monthly_sales_goals
  ADD COLUMN net_amount numeric(14,2)
  CHECK (net_amount IS NULL OR (net_amount > 0 AND net_amount <> 'NaN'::numeric));

NOTIFY pgrst, 'reload schema';
