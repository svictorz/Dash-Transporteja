-- ============================================================
-- Usar no Supabase: SQL Editor
-- Objetivo: remover usuário antigo e preparar para admin@transporteja.com
-- ============================================================

-- PASSO 1: Remover usuário existente com esse e-mail
-- (rodar este bloco primeiro)
DELETE FROM public.users WHERE email = 'admin@transporteja.com';
DELETE FROM auth.users WHERE email = 'admin@transporteja.com';


-- PASSO 2: Criar o usuário novo no Dashboard do Supabase
--    Authentication > Users > Add user > Create new user
--    Email: admin@transporteja.com
--    Password: 123456
-- Depois volte aqui e rode o PASSO 3.


-- PASSO 3: Garantir perfil em public.users com role admin
-- (rodar depois de criar o usuário no Dashboard)
-- Se o trigger handle_new_user já criou a linha, só atualiza o role.
INSERT INTO public.users (id, email, name, role)
SELECT id, email, 'Admin', 'admin'
FROM auth.users
WHERE email = 'admin@transporteja.com'
ON CONFLICT (id) DO UPDATE
SET role = 'admin', name = 'Admin', updated_at = NOW();
