-- ============================================
-- LIMPAR DADOS DE TESTE (DRIVERS, ROTAS, CHECKINS, LOCALIZAÇÕES)
-- ============================================
-- ATENÇÃO:
-- Este script REMOVE TODOS os registros das tabelas abaixo:
--   - public.location_updates
--   - public.checkins
--   - public.routes
--   - public.drivers
--
-- Execute apenas se você tiver certeza de que os dados atuais
-- são apenas de teste/demonstração.
--
-- Passos:
-- 1. Abra o Supabase Dashboard.
-- 2. Vá em SQL Editor → New Query.
-- 3. Cole este script e clique em Run.
-- ============================================

BEGIN;

  -- Primeiro removemos dependências (localizações e check-ins)
  DELETE FROM public.location_updates;
  DELETE FROM public.checkins;

  -- Depois rotas (fretes)
  DELETE FROM public.routes;

  -- Por fim motoristas
  DELETE FROM public.drivers;

COMMIT;

-- Se você também quiser limpar clientes, descomente a linha abaixo:
-- DELETE FROM public.clients;

