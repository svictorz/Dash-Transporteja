-- CNPJ opcional para vincular a empresa do frete ao cadastro de clientes.
-- Não altera registros existentes, permissões ou regras de acesso.
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS cnpj text;

NOTIFY pgrst, 'reload schema';
