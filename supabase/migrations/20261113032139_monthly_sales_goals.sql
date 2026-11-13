-- Metas independentes dos fretes e dos valores financeiros históricos.
CREATE TABLE public.monthly_sales_goals (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  month date NOT NULL CHECK (extract(day FROM month) = 1),
  amount numeric(14,2) NOT NULL CHECK (amount > 0 AND amount <> 'NaN'::numeric),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, month)
);
ALTER TABLE public.monthly_sales_goals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.monthly_sales_goals FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.monthly_sales_goals TO authenticated;
GRANT ALL ON public.monthly_sales_goals TO service_role;

CREATE POLICY monthly_goals_read ON public.monthly_sales_goals
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.current_user_has_any_role(ARRAY['admin']::text[])));
CREATE POLICY monthly_goals_admin_insert ON public.monthly_sales_goals
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.current_user_has_any_role(ARRAY['admin']::text[])));
CREATE POLICY monthly_goals_admin_update ON public.monthly_sales_goals
  FOR UPDATE TO authenticated
  USING ((SELECT public.current_user_has_any_role(ARRAY['admin']::text[])))
  WITH CHECK ((SELECT public.current_user_has_any_role(ARRAY['admin']::text[])));

CREATE TRIGGER monthly_goals_updated_at BEFORE UPDATE ON public.monthly_sales_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

NOTIFY pgrst, 'reload schema';
