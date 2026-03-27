-- ============================================
-- CORRIGIR CHECK-INS SEM freight_id / route_id
-- ============================================
-- O motorista subiu as fotos, mas o app gravou sem freight_id e route_id.
-- Este script associa os check-ins do motorista à rota mais recente dele.
--
-- Execute no SQL Editor do Supabase (Dashboard > SQL Editor > New Query).
-- ============================================

-- 1) Ver os check-ins que estão com freight_id NULL (fotos "perdidas")
SELECT id, type, freight_id, route_id, driver_id, photo_url, timestamp, created_at
FROM public.checkins
WHERE freight_id IS NULL
ORDER BY created_at DESC;

-- 2) Corrigir: vincular check-ins órfãos à rota do frete 506599320
--    (motorista 42ce80c2-b431-439f-843a-e64e8763bcfe, rota 0590ab7a-62b2-4ee0-8dcf-60b895c5ae99)
UPDATE public.checkins
SET freight_id = 506599320,
    route_id  = '0590ab7a-62b2-4ee0-8dcf-60b895c5ae99'
WHERE driver_id = '42ce80c2-b431-439f-843a-e64e8763bcfe'
  AND freight_id IS NULL;

-- 3) Conferir: listar check-ins do frete 506599320
-- SELECT id, type, freight_id, route_id, photo_url, timestamp
-- FROM public.checkins
-- WHERE freight_id = 506599320
-- ORDER BY timestamp;
