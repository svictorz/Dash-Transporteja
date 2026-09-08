-- ============================================================
-- 047 - RESTAURA AS POLICIES DE STORAGE
-- ============================================================
-- Contexto:
--   Na VPS, storage.objects estava com RLS LIGADO e ZERO policies.
--   Nessa combinacao o Postgres nega tudo: nenhum usuario conseguia
--   subir imagem nem documento. A leitura seguia funcionando porque
--   os dois buckets sao publicos e o download nao passa por RLS.
--
--   As policies existiam nas migrations 014, 021, 039 e 041, mas nunca
--   chegaram na VPS: ela foi montada por dump de dados, e dump de dados
--   nao carrega policy.
--
-- O que esta migration faz:
--   Recria o conjunto vigente para os dois buckets. Uma diferenca
--   proposital em relacao a 021/041: onde havia a lista fixa
--   ('admin','financeiro') usa-se agora is_admin_or_financeiro(), que
--   a 045 deixou como ['admin','financeiro','fiscal'] — assim o storage
--   segue a mesma fonte de verdade das policies de routes e clients.
--
-- Regra final:
--   checkin-photos  qualquer autenticado sobe e le; dono edita e apaga
--                   o proprio; admin/financeiro/fiscal gerenciam tudo
--   avatars         cada um gerencia a propria pasta; todos leem
--
-- Idempotente.

-- ------------------------------------------------------------
-- checkin-photos — documentos e fotos de frete
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can upload photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'checkin-photos'
  AND (storage.foldername(name))[1] IN ('checkins', 'documents')
);

DROP POLICY IF EXISTS "Authenticated users can read photos" ON storage.objects;
CREATE POLICY "Authenticated users can read photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'checkin-photos');

DROP POLICY IF EXISTS "Authenticated users can update own checkin-photos" ON storage.objects;
CREATE POLICY "Authenticated users can update own checkin-photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'checkin-photos'
  AND (storage.foldername(name))[1] IN ('checkins', 'documents')
  AND owner_id = (SELECT auth.uid()::text)
)
WITH CHECK (
  bucket_id = 'checkin-photos'
  AND (storage.foldername(name))[1] IN ('checkins', 'documents')
  AND owner_id = (SELECT auth.uid()::text)
);

DROP POLICY IF EXISTS "Authenticated users can delete own checkin-photos" ON storage.objects;
CREATE POLICY "Authenticated users can delete own checkin-photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'checkin-photos'
  AND (storage.foldername(name))[1] IN ('checkins', 'documents')
  AND owner_id = (SELECT auth.uid()::text)
);

DROP POLICY IF EXISTS "Admins and financeiro manage all checkin-photos" ON storage.objects;
CREATE POLICY "Admins and financeiro manage all checkin-photos"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'checkin-photos'
  AND public.is_admin_or_financeiro()
)
WITH CHECK (
  bucket_id = 'checkin-photos'
  AND public.is_admin_or_financeiro()
);

-- ------------------------------------------------------------
-- avatars — foto de perfil, cada um na sua pasta
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);

DROP POLICY IF EXISTS "Users can read avatars" ON storage.objects;
CREATE POLICY "Users can read avatars"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);

DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);

-- ============================================================
-- FIM
-- ============================================================
