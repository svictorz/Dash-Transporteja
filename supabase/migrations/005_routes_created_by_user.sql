-- Guarda quem criou o frete para métricas de performance por comercial.
ALTER TABLE public.routes
ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_routes_created_by_user_id ON public.routes(created_by_user_id);

-- Preenche registros antigos para evitar dados nulos quando só existe um comercial/admin.
DO $$
DECLARE
  fallback_user_id UUID;
BEGIN
  SELECT id
    INTO fallback_user_id
    FROM public.users
   WHERE role IN ('admin', 'comercial')
   ORDER BY created_at ASC
   LIMIT 1;

  IF fallback_user_id IS NOT NULL THEN
    UPDATE public.routes
       SET created_by_user_id = fallback_user_id
     WHERE created_by_user_id IS NULL;
  END IF;
END $$;

-- Garante que novos fretes criados no dashboard fiquem com o usuário logado.
DROP POLICY IF EXISTS "Admins and operators can modify routes" ON public.routes;
CREATE POLICY "Admins and operators can modify routes" ON public.routes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'comercial')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'comercial')
    )
    AND (created_by_user_id IS NULL OR created_by_user_id = auth.uid())
  );

