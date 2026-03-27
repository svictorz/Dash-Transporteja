# Tutorial: Deploy do Dashboard na Vercel

Sim, você pode usar este projeto na **Vercel**. O dashboard é Next.js 14 e funciona direto lá.

---

## O que você precisa

- Conta na [Vercel](https://vercel.com) (grátis)
- Repositório do projeto no **GitHub**, **GitLab** ou **Bitbucket**
- **URL** e **chave anon** do Supabase (Project Settings → API)

---

## Passo a passo

### 1. Acessar a Vercel

1. Acesse [vercel.com](https://vercel.com) e faça login (pode ser com GitHub).
2. No dashboard, clique em **Add New…** → **Project**.

### 2. Importar o repositório

1. Conecte o provedor (GitHub/GitLab/Bitbucket) se ainda não estiver conectado.
2. Selecione o repositório do dashboard (ex.: `Dash-Transporteja`).
3. Clique em **Import**.

### 3. Configurar o projeto

1. **Framework Preset:** a Vercel detecta **Next.js** automaticamente; deixe como está.
2. **Root Directory:** em branco (raiz do repo).
3. **Build Command:** `npm run build` (padrão).
4. **Output Directory:** deixe o padrão (não use `out`; Next.js usa `.next`).
5. **Install Command:** `npm install` (padrão).

### 4. Variáveis de ambiente

Na mesma tela (ou em **Settings → Environment Variables** depois):

| Nome | Valor |
|------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto no Supabase (ex.: `https://xxxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave **anon (public)** do Supabase |

- **Environment:** marque **Production** (e **Preview** se quiser nas branches de PR).
- Não use a chave **service_role** em variáveis `NEXT_PUBLIC_*`.

### 5. Deploy

1. Clique em **Deploy**.
2. A Vercel faz o build e publica. Ao terminar, ela mostra uma URL tipo `https://seu-projeto.vercel.app`.
3. Acesse essa URL para usar o dashboard.

---

## Depois do deploy

- **Domínio próprio:** em **Settings → Domains** adicione seu domínio (ex.: `dashboard.transporteja.com.br`). A Vercel configura HTTPS.
- **Atualizações:** a cada **push** no branch conectado (ex.: `main`), a Vercel pode fazer deploy automático (habilitado por padrão).
- **Logs e builds:** em **Deployments** você vê histórico e logs de cada build.

---

## Observação sobre `output: 'standalone'`

O `next.config.js` está com `output: 'standalone'` (usado para Docker/EasyPanel). Na Vercel isso **não atrapalha**; a Vercel ignora e faz o deploy normalmente. Se quiser, pode deixar assim para continuar usando o mesmo código no EasyPanel e na Vercel.

---

## Resumo

| Onde | Uso |
|------|-----|
| **Vercel** | Deploy rápido, HTTPS e domínio grátis, deploy automático por Git. |
| **EasyPanel** | Servidor próprio/VPS, mais controle, mesmo projeto (Dockerfile). |

Os dois funcionam com este projeto; basta configurar as variáveis de ambiente em cada um.
