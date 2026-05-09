-- ============================================================
-- 020 - Permitir PDF (e aumentar limite) no bucket checkin-photos
-- ============================================================
-- O upload de comprovantes de frete agora aceita comprovantes em PDF além de imagens.

UPDATE storage.buckets
SET
  file_size_limit = 20971520, -- 20 MB
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf'
  ]
WHERE id = 'checkin-photos';
