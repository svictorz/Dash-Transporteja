-- ============================================
-- ADICIONAR CAMPOS DE PERFIL NA TABELA USERS
-- ============================================
-- Execute este script no SQL Editor do Supabase

-- Adicionar campo de telefone
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS phone TEXT;

-- Adicionar campo de avatar/foto de perfil
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Comentários
COMMENT ON COLUMN public.users.phone IS 'Telefone do usuário';
COMMENT ON COLUMN public.users.avatar_url IS 'URL da foto de perfil do usuário';

