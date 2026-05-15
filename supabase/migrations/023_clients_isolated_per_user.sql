-- ============================================================
-- 023 - CLIENTES ISOLADOS POR USUÁRIO
-- ============================================================
-- Contexto:
--   A migração 022 tornou `public.clients` compartilhado entre o time
--   (admin / financeiro / comercial viam tudo). Na prática isso poluiu
--   o autocomplete de "Empresa" no formulário de criar rota, mostrando
--   clientes de outros usuários (incluindo testes e nomes soltos).
--
-- Decisão:
--   Voltar ao isolamento por usuário, mas mantendo um espaço para
--   "clientes sem dono" (legados criados antes da introdução de
--   `created_by_user_id`):
--     - Comercial:        vê / edita APENAS os próprios
--     - Admin/financeiro: vê / edita os próprios + os LEGADOS
--                         (created_by_user_id IS NULL)
--     - Insert:           qualquer um dos 3 roles, com dono = ele mesmo
--                         (o DEFAULT auth.uid() já garante isso)
--     - Motorista:        sem acesso
--
-- Idempotente: pode ser executado várias vezes sem efeito colateral.

-- ------------------------------------------------------------
-- 1) Limpar policies anteriores de public.clients
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read clients"   ON public.clients;
DROP POLICY IF EXISTS "Admins and operators can modify clients" ON public.clients;
DROP POLICY IF EXISTS "Clients - select scoped"  ON public.clients;
DROP POLICY IF EXISTS "Clients - insert scoped"  ON public.clients;
DROP POLICY IF EXISTS "Clients - update scoped"  ON public.clients;
DROP POLICY IF EXISTS "Clients - delete scoped"  ON public.clients;
DROP POLICY IF EXISTS "Clients - select shared"  ON public.clients;
DROP POLICY IF EXISTS "Clients - insert shared"  ON public.clients;
DROP POLICY IF EXISTS "Clients - update shared"  ON public.clients;
DROP POLICY IF EXISTS "Clients - delete shared"  ON public.clients;
DROP POLICY IF EXISTS "Clients - select isolated" ON public.clients;
DROP POLICY IF EXISTS "Clients - insert isolated" ON public.clients;
DROP POLICY IF EXISTS "Clients - update isolated" ON public.clients;
DROP POLICY IF EXISTS "Clients - delete isolated" ON public.clients;

-- ------------------------------------------------------------
-- 2) SELECT — visibilidade por usuário
-- ------------------------------------------------------------
CREATE POLICY "Clients - select isolated" ON public.clients
  FOR SELECT
  USING (
    -- Comercial: só os próprios.
    (public.is_comercial() AND created_by_user_id = auth.uid())
    -- Admin/financeiro: os próprios + os "sem dono" (legados).
    OR (
      public.is_admin_or_financeiro()
      AND (created_by_user_id = auth.uid() OR created_by_user_id IS NULL)
    )
  );

-- ------------------------------------------------------------
-- 3) INSERT — qualquer um dos 3 roles, com dono = ele mesmo
-- ------------------------------------------------------------
CREATE POLICY "Clients - insert isolated" ON public.clients
  FOR INSERT
  WITH CHECK (
    public.current_user_has_any_role(
      ARRAY['admin', 'financeiro', 'comercial']::text[]
    )
    -- O DEFAULT auth.uid() em created_by_user_id cobre o caso NULL.
    AND (created_by_user_id IS NULL OR created_by_user_id = auth.uid())
  );

-- ------------------------------------------------------------
-- 4) UPDATE — mesma regra do SELECT
-- ------------------------------------------------------------
CREATE POLICY "Clients - update isolated" ON public.clients
  FOR UPDATE
  USING (
    (public.is_comercial() AND created_by_user_id = auth.uid())
    OR (
      public.is_admin_or_financeiro()
      AND (created_by_user_id = auth.uid() OR created_by_user_id IS NULL)
    )
  )
  WITH CHECK (
    (public.is_comercial() AND created_by_user_id = auth.uid())
    OR (
      public.is_admin_or_financeiro()
      AND (created_by_user_id = auth.uid() OR created_by_user_id IS NULL)
    )
  );

-- ------------------------------------------------------------
-- 5) DELETE — mesma regra do UPDATE
-- ------------------------------------------------------------
CREATE POLICY "Clients - delete isolated" ON public.clients
  FOR DELETE
  USING (
    (public.is_comercial() AND created_by_user_id = auth.uid())
    OR (
      public.is_admin_or_financeiro()
      AND (created_by_user_id = auth.uid() OR created_by_user_id IS NULL)
    )
  );

-- ============================================================
-- FIM
-- ============================================================
