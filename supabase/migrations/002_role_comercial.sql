-- Migração: perfil "operator" → "comercial" e RLS alinhado ao painel JCN X ÁGAPE gestão.
-- Execute no SQL Editor do Supabase se o projeto foi criado antes da troca de papéis.

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

UPDATE public.users SET role = 'comercial' WHERE role = 'operator';

ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'comercial', 'driver'));

ALTER TABLE public.users ALTER COLUMN role SET DEFAULT 'comercial';

DROP POLICY IF EXISTS "Admins and operators can modify drivers" ON public.drivers;
CREATE POLICY "Admins and operators can modify drivers" ON public.drivers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'comercial')
    )
  );

DROP POLICY IF EXISTS "Admins and operators can modify clients" ON public.clients;
CREATE POLICY "Admins and operators can modify clients" ON public.clients
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'comercial')
    )
  );

DROP POLICY IF EXISTS "Admins and operators can modify routes" ON public.routes;
CREATE POLICY "Admins and operators can modify routes" ON public.routes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'comercial')
    )
  );

DROP POLICY IF EXISTS "Admins and operators can modify checkins" ON public.checkins;
CREATE POLICY "Admins and operators can modify checkins" ON public.checkins
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'comercial')
    )
  );

-- Se você tiver políticas do setup-completo.sql com nomes "Admins and operators can insert/update/delete ...",
-- recrie-as trocando role IN ('admin', 'operator') por ('admin', 'comercial').
