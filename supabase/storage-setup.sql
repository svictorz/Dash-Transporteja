-- ============================================
-- CONFIGURAÇÃO DO STORAGE - TRANSPORTEJÁ
-- ============================================
-- Este script cria (se necessário) o bucket `checkin-photos`
-- e configura as policies de upload, leitura, update e delete.
-- Pode ser executado várias vezes (idempotente) no SQL Editor do Supabase.

-- ============================================
-- 1) BUCKET
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'checkin-photos',
  'checkin-photos',
  true,
  10485760, -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================
-- 2) POLICIES
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update own photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete own photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete own checkin-photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update own checkin-photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins and operators can manage all photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins and financeiro manage all checkin-photos" ON storage.objects;

-- Upload: usuários autenticados podem enviar para `checkins/` ou `documents/`.
CREATE POLICY "Authenticated users can upload photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'checkin-photos'
  AND (storage.foldername(name))[1] IN ('checkins', 'documents')
);

-- Leitura: qualquer usuário autenticado pode ler do bucket.
CREATE POLICY "Authenticated users can read photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'checkin-photos');

-- Update: só o dono do arquivo (quem fez upload com sessão autenticada).
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

-- Delete: só o dono (ver migration 021 e docs de ownership do Supabase).
CREATE POLICY "Authenticated users can delete own checkin-photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'checkin-photos'
  AND (storage.foldername(name))[1] IN ('checkins', 'documents')
  AND owner_id = (SELECT auth.uid()::text)
);

-- Gestão total do bucket: admin e financeiro (escopo alinhado ao painel).
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

-- ============================================
-- FIM DA CONFIGURAÇÃO DO STORAGE
-- ============================================
