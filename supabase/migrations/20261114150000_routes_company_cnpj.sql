-- Identifica a empresa do frete pelo CNPJ, sem alterar rotas antigas.
ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS company_cnpj text;

NOTIFY pgrst, 'reload schema';
