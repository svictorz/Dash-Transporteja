-- ============================================================
-- 021 - Storage checkin-photos: delete/update só do dono + admin/financeiro
-- ============================================================
-- Antes: qualquer usuário autenticado podia DELETE/UPDATE em checkins/ e documents/;
--        a policy "Admins and operators..." incluía 'comercial' com FOR ALL no bucket.
-- Agora: DELETE/UPDATE apenas se owner_id = usuário logado (quem fez o upload);
--        admin e financeiro mantêm gestão total. Comercial só nos próprios arquivos.
-- Docs: https://supabase.com/docs/guides/storage/security/ownership
--
-- Idempotente.

DROP POLICY IF EXISTS "Authenticated users can delete photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update own photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update own checkin-photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete own checkin-photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins and operators can manage all photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins and financeiro manage all checkin-photos" ON storage.objects;

-- UPDATE: só quem enviou o arquivo (JWT), nas pastas do app.
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

-- DELETE: mesmo critério de dono.
CREATE POLICY "Authenticated users can delete own checkin-photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'checkin-photos'
  AND (storage.foldername(name))[1] IN ('checkins', 'documents')
  AND owner_id = (SELECT auth.uid()::text)
);

-- Gestão ampla apenas admin e financeiro (alinhado ao escopo de rotas no app).
CREATE POLICY "Admins and financeiro manage all checkin-photos"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'checkin-photos'
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('admin', 'financeiro')
  )
)
WITH CHECK (
  bucket_id = 'checkin-photos'
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('admin', 'financeiro')
  )
);
