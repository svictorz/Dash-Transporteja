-- ============================================================
-- 017 - Renumerar freight_id em ordem crescente a partir de 0
-- ============================================================
-- Substitui o gerador aleatório por uma sequência incremental.
-- - Renumera as rotas existentes pela ordem de criação (created_at, id).
-- - Atualiza checkins.freight_id (FK) para manter as referências.
-- - Cria a sequence routes_freight_id_seq começando em 0.
-- - Define DEFAULT nextval(seq) na coluna routes.freight_id, de modo
--   que novos inserts sem freight_id recebem o próximo número.
--
-- Idempotente o suficiente: roda uma vez. Se rodar de novo, vai
-- só "renumerar de novo na mesma ordem" (não causa perda de dados,
-- mas evite repetir desnecessariamente).

-- ------------------------------------------------------------
-- 1) Snapshot do mapeamento (id -> novo freight_id)
-- ------------------------------------------------------------
CREATE TEMP TABLE _route_renumber AS
SELECT
  id,
  freight_id AS old_id,
  (ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) - 1)::BIGINT AS new_id
FROM public.routes;

-- ------------------------------------------------------------
-- 2) Remove FK temporariamente para permitir o shift sem violar
-- ------------------------------------------------------------
ALTER TABLE public.checkins DROP CONSTRAINT IF EXISTS checkins_freight_id_fkey;

-- ------------------------------------------------------------
-- 3) Aplica os novos valores via offset alto para evitar colisão
--    com valores antigos no índice UNIQUE durante o UPDATE.
-- ------------------------------------------------------------
UPDATE public.routes r
SET freight_id = m.new_id + 1000000000
FROM _route_renumber m
WHERE r.id = m.id;

UPDATE public.checkins c
SET freight_id = m.new_id + 1000000000
FROM _route_renumber m
WHERE c.freight_id = m.old_id;

-- ------------------------------------------------------------
-- 4) Move para os valores definitivos (0, 1, 2, ...)
-- ------------------------------------------------------------
UPDATE public.routes
SET freight_id = freight_id - 1000000000
WHERE freight_id >= 1000000000;

UPDATE public.checkins
SET freight_id = freight_id - 1000000000
WHERE freight_id >= 1000000000;

-- ------------------------------------------------------------
-- 5) Recria FK
-- ------------------------------------------------------------
ALTER TABLE public.checkins
  ADD CONSTRAINT checkins_freight_id_fkey
  FOREIGN KEY (freight_id) REFERENCES public.routes(freight_id) ON DELETE SET NULL;

-- ------------------------------------------------------------
-- 6) Cria a sequence (começa em 0) e amarra ao default da coluna
-- ------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.routes_freight_id_seq
  AS BIGINT
  MINVALUE 0
  START WITH 0;

-- Garante que o próximo nextval() pegue o número certo
-- (max+1 se houver rotas; 0 se a tabela estiver vazia).
SELECT setval(
  'public.routes_freight_id_seq',
  COALESCE((SELECT MAX(freight_id) FROM public.routes), -1) + 1,
  false
);

-- Coluna passa a usar a sequence como default
ALTER TABLE public.routes
  ALTER COLUMN freight_id SET DEFAULT nextval('public.routes_freight_id_seq');

-- Faz a sequence "pertencer" à coluna (limpa junto se a coluna sumir)
ALTER SEQUENCE public.routes_freight_id_seq OWNED BY public.routes.freight_id;
