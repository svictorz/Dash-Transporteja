# Scripts

## Criar usuário admin

Remove um usuário existente com o mesmo e-mail (se houver) e cria um novo usuário para login:

- **E-mail:** `admin@transporteja.com`
- **Senha:** `123456` (você pediu 12345; o Supabase exige no mínimo 6 caracteres, por isso o script usa 123456)

### Pré-requisitos

No `.env.local` na raiz do projeto:

- `NEXT_PUBLIC_SUPABASE_URL` – URL do projeto (já usada pelo app)
- `SUPABASE_SERVICE_ROLE_KEY` – Chave **service_role** (não a anon):
  - Supabase Dashboard → seu projeto → **Project Settings** → **API** → **service_role** (secret)

### Executar

Na raiz do projeto:

```bash
node scripts/create-admin-user.mjs
```

Depois faça login em `/login` com `admin@transporteja.com` e `123456`.
