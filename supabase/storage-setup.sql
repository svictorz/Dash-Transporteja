-- ============================================
-- CONFIGURAÇÃO DO STORAGE - TRANSPORTEJÁ
-- ============================================
-- Execute este script APÓS criar o bucket 'checkin-photos' no Storage
-- Dashboard > Storage > Create bucket > Nome: checkin-photos
-- Depois execute este script no SQL Editor

-- ============================================
-- POLÍTICAS DO STORAGE
-- ============================================

-- Remover políticas antigas (se existirem)
DROP POLICY IF EXISTS "Authenticated users can upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update own photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete own photos" ON storage.objects;

-- Permitir upload para usuários autenticados
CREATE POLICY "Authenticated users can upload photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'checkin-photos' AND
  (storage.foldername(name))[1] = 'checkins'
);

-- Permitir leitura para usuários autenticados
CREATE POLICY "Authenticated users can read photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'checkin-photos');

-- Permitir atualização para o próprio usuário
CREATE POLICY "Authenticated users can update own photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'checkin-photos' AND
  (storage.foldername(name))[1] = 'checkins' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Permitir exclusão para o próprio usuário
CREATE POLICY "Authenticated users can delete own photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'checkin-photos' AND
  (storage.foldername(name))[1] = 'checkins' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Permitir que admins e operadores gerenciem todas as fotos
CREATE POLICY "Admins and operators can manage all photos"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'checkin-photos' AND
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('admin', 'operator')
  )
);

-- ============================================
-- FIM DA CONFIGURAÇÃO DO STORAGE
-- ============================================

