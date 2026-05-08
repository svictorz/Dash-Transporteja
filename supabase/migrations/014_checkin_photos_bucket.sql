-- ============================================
-- BUCKET checkin-photos (idempotente)
-- ============================================
-- Cria o bucket usado pelo app para fotos de check-in (pasta `checkins/`)
-- e para anexos de comprovantes de frete (pasta `documents/`).
-- Ajusta também as policies para aceitar ambas as pastas.

-- Cria o bucket se ainda não existir (público, com limite de 10MB).
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

-- Remove policies antigas (incluindo as do storage-setup.sql) para
-- recriarmos com suporte às duas pastas (`checkins` e `documents`).
DROP POLICY IF EXISTS "Authenticated users can upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update own photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete own photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins and operators can manage all photos" ON storage.objects;

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

-- Update: usuários autenticados podem atualizar arquivos nas pastas suportadas.
CREATE POLICY "Authenticated users can update photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'checkin-photos'
  AND (storage.foldername(name))[1] IN ('checkins', 'documents')
)
WITH CHECK (
  bucket_id = 'checkin-photos'
  AND (storage.foldername(name))[1] IN ('checkins', 'documents')
);

-- Delete: usuários autenticados podem remover arquivos das pastas suportadas.
CREATE POLICY "Authenticated users can delete photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'checkin-photos'
  AND (storage.foldername(name))[1] IN ('checkins', 'documents')
);

-- Acesso amplo para admins/operadores em todo o bucket.
CREATE POLICY "Admins and operators can manage all photos"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'checkin-photos'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('admin', 'operator', 'comercial')
  )
)
WITH CHECK (
  bucket_id = 'checkin-photos'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('admin', 'operator', 'comercial')
  )
);
