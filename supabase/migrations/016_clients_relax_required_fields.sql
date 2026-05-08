-- ============================================================
-- 016 - Relaxar campos obrigatórios em public.clients
-- ============================================================
-- Permite criar um cliente "leve" (apenas com company_name + contatos)
-- a partir do fluxo de criação de rotas, sem exigir endereço completo.
-- Os campos seguem podendo ser preenchidos pelo modal "Adicionar Cliente"
-- na tela /dashboard/clientes.

ALTER TABLE public.clients ALTER COLUMN responsible DROP NOT NULL;
ALTER TABLE public.clients ALTER COLUMN whatsapp DROP NOT NULL;
ALTER TABLE public.clients ALTER COLUMN email DROP NOT NULL;
ALTER TABLE public.clients ALTER COLUMN address DROP NOT NULL;
ALTER TABLE public.clients ALTER COLUMN city DROP NOT NULL;
ALTER TABLE public.clients ALTER COLUMN neighborhood DROP NOT NULL;
ALTER TABLE public.clients ALTER COLUMN state DROP NOT NULL;
