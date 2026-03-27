-- ============================================
-- CONFIGURAR BUCKET DE AVATARES
-- ============================================
-- IMPORTANTE: Primeiro crie o bucket 'avatars' no Dashboard do Supabase
-- Dashboard > Storage > Create bucket > Nome: avatars > Public: Yes
-- Depois execute este script no SQL Editor

-- ============================================
-- POLÍTICAS DO STORAGE PARA AVATARES
-- ============================================

-- Remover políticas antigas (se existirem)
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can read avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;

-- Permitir upload de avatar para usuários autenticados (apenas próprio)
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Permitir leitura de avatares para usuários autenticados
CREATE POLICY "Users can read avatars"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');

-- Permitir atualização do próprio avatar
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Permitir exclusão do próprio avatar
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

