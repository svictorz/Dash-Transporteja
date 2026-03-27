# Deploy do Dashboard no EasyPanel

Guia para subir o dashboard **Transporte Já** em um servidor com [EasyPanel](https://easypanel.io).

O projeto está **pronto para deploy**: build com `npm run build`, Dockerfile com output `standalone` e variáveis de ambiente documentadas em `.env.example`.

---

## Pré-requisitos

- Servidor com EasyPanel instalado e acessível
- Repositório Git com o código do dashboard (GitHub, GitLab, etc.)
- Projeto Supabase já configurado (URL e chave anônima)

---

## Passo 1 – Criar o projeto no EasyPanel

1. Acesse o EasyPanel no seu servidor.
2. Clique em **Create** → **New** e crie um projeto (ex.: `transporteja`).

---

## Passo 2 – Adicionar o serviço (App)

1. No projeto, clique em **+ Service**.
2. Escolha o tipo **App**.

---

## Passo 3 – Conectar o repositório

1. Na aba **Source**, conecte seu repositório Git (GitHub/GitLab).
2. Selecione o repositório e o branch (ex.: `main`).
3. Deixe o **Build Path** como raiz do repositório (ou o caminho onde está o `Dockerfile`).

---

## Passo 4 – Configurar o build

1. Vá na aba **Build**.
2. Método de build: **Dockerfile**.
3. Caminho do Dockerfile: `Dockerfile` (raiz do repositório).

Salve as alterações.

---

## Passo 5 – Variáveis de ambiente

Na aba **Environment**, adicione:

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Sim | URL do projeto no Supabase (ex.: `https://xxxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sim | Chave anônima (pública) do Supabase |

**Não** coloque a **Service Role Key** do Supabase em variáveis que começam com `NEXT_PUBLIC_` (ela não deve ir para o navegador).

Opcional:

- `PORT=3000` – EasyPanel costuma definir sozinho; só defina se precisar.

Salve.

---

## Passo 6 – Deploy

1. Clique em **Deploy** para fazer o build e subir o container.
2. Aguarde o build terminar (pode levar alguns minutos na primeira vez).
3. Use a **URL pública** que o EasyPanel mostrar para acessar o dashboard.

---

## Domínio e HTTPS

- Na aba **Domains** do serviço, adicione seu domínio (ex.: `dashboard.transporteja.com.br`).
- O EasyPanel pode provisionar e renovar certificados SSL automaticamente (consulte a doc do painel).

---

## Dicas

- **Re-deploy:** a cada push no branch configurado, você pode configurar webhook para deploy automático (se o EasyPanel estiver integrado ao Git).
- **Logs:** use a aba de logs do serviço no EasyPanel para ver erros do Next.js.
- **Porta:** o container expõe a porta **3000**; o EasyPanel faz o mapeamento para a porta pública.

Se algo falhar no build, confira se `next.config.js` tem `output: 'standalone'` e se o repositório contém o `Dockerfile` na raiz.
