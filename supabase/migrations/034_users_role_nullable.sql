-- A tela de Permissões (app/(painel)/usuarios/page.tsx) usa role = NULL
-- para representar "acesso revogado" (ver handleRevokeAccess e o gate em
-- app/(painel)/layout.tsx), mas a coluna role nunca deixou de ser NOT NULL,
-- causando "null value in column "role" of relation "users" violates
-- not-null constraint" ao tentar revogar o acesso de alguém.

ALTER TABLE public.users ALTER COLUMN role DROP NOT NULL;
