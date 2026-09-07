-- ============================================================
-- 045 - FISCAL VOLTA PARA O HELPER DE ADMIN/FINANCEIRO
-- ============================================================
-- Contexto:
--   A migration 041 criou o perfil `fiscal` e o incluiu em
--   public.is_admin_or_financeiro(). O CHECK de perfis foi aplicado
--   nos bancos, mas a redefinicao da funcao nao — os ambientes ficaram
--   com a versao antiga, ARRAY['admin','financeiro'], sem fiscal.
--
--   Efeito: a tela deixa o fiscal editar (canEditPerformance permite),
--   e o RLS recusa no save. O usuario preenche e perde o trabalho.
--
--   A 042 recriou o CHECK ja com fiscal e supervisor, o que mascarou a
--   falha: olhar so o constraint dava a impressao de que a 041 tinha
--   rodado.
--
-- Efeito desta migration:
--   fiscal passa a ler e escrever no mesmo escopo de admin/financeiro,
--   que e o desenho da 041. Nenhum outro perfil muda.
--
--   Vale para routes, clients e calendar_events de uma vez, porque as
--   tres chamam este mesmo helper nas policies.
--
-- Idempotente.

CREATE OR REPLACE FUNCTION public.is_admin_or_financeiro()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
STABLE
AS $$
  SELECT public.current_user_has_any_role(ARRAY['admin', 'financeiro', 'fiscal']::text[]);
$$;

REVOKE ALL ON FUNCTION public.is_admin_or_financeiro() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_or_financeiro() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_financeiro() TO service_role;

-- ============================================================
-- FIM
-- ============================================================
