-- ============================================================
-- 022 - CLIENTES COMO ENTIDADE COMPARTILHADA
-- ============================================================
-- Contexto:
--   A migração 015 isolou os clientes por usuário comercial
--   (cada comercial só via / editava os clientes que ele próprio
--   havia criado, via `created_by_user_id = auth.uid()`).
--
--   Na prática isso quebrou o fluxo de edição: clientes legados
--   (com `created_by_user_id = NULL`) e clientes criados por
--   admin/financeiro ficavam invisíveis ou imutáveis para o time
--   comercial, mesmo quando deveriam ser editados livremente
--   (ex.: corrigir o nome da empresa, telefone, endereço).
--
-- Decisão:
--   Voltar a tratar `public.clients` como entidade COMPARTILHADA
--   entre admin / financeiro / comercial:
--     - SELECT  → admin, financeiro e comercial veem TODOS
--     - INSERT  → admin, financeiro e comercial podem inserir
--     - UPDATE  → admin, financeiro e comercial podem atualizar
--                  qualquer cliente
--     - DELETE  → admin, financeiro e comercial podem deletar
--                  qualquer cliente
--
--   A coluna `created_by_user_id` é MANTIDA, mas agora serve
--   apenas como auditoria (quem cadastrou o cliente), sem
--   restringir acesso.
--
--   Motoristas (`driver`) continuam SEM acesso a clientes.
--
-- Idempotente: pode ser executado várias vezes sem efeito colateral.

-- ------------------------------------------------------------
-- 1) Limpar políticas antigas de public.clients
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

-- ------------------------------------------------------------
-- 2) Novas políticas: clientes compartilhados entre o time
--    administrativo / financeiro / comercial.
-- ------------------------------------------------------------

-- SELECT: admin, financeiro e comercial veem todos os clientes.
CREATE POLICY "Clients - select shared" ON public.clients
  FOR SELECT
  USING (
    public.current_user_has_any_role(
      ARRAY['admin', 'financeiro', 'comercial']::text[]
    )
  );

-- INSERT: admin, financeiro e comercial podem cadastrar clientes.
-- (o DEFAULT auth.uid() em created_by_user_id continua valendo)
CREATE POLICY "Clients - insert shared" ON public.clients
  FOR INSERT
  WITH CHECK (
    public.current_user_has_any_role(
      ARRAY['admin', 'financeiro', 'comercial']::text[]
    )
  );

-- UPDATE: admin, financeiro e comercial podem editar qualquer cliente.
CREATE POLICY "Clients - update shared" ON public.clients
  FOR UPDATE
  USING (
    public.current_user_has_any_role(
      ARRAY['admin', 'financeiro', 'comercial']::text[]
    )
  )
  WITH CHECK (
    public.current_user_has_any_role(
      ARRAY['admin', 'financeiro', 'comercial']::text[]
    )
  );

-- DELETE: admin, financeiro e comercial podem excluir qualquer cliente.
CREATE POLICY "Clients - delete shared" ON public.clients
  FOR DELETE
  USING (
    public.current_user_has_any_role(
      ARRAY['admin', 'financeiro', 'comercial']::text[]
    )
  );

-- ============================================================
-- FIM
-- ============================================================
