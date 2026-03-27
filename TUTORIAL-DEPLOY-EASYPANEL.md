# Tutorial: Subir o Dashboard Transporte Já no EasyPanel

Passo a passo para publicar o projeto no **EasyPanel** (painel de hospedagem em servidor próprio ou VPS).

---

## O que você vai precisar

| Item | Onde conseguir |
|------|----------------|
| **Servidor com EasyPanel** | Instalado e acessível (ex.: `https://seu-servidor.com` ou IP). |
| **Repositório Git** | Código do dashboard no GitHub, GitLab ou outro (branch `main` ou `master`). |
| **Projeto Supabase** | Já criado; URL e chave **anon** em: Supabase → Project Settings → API. |

---

## Parte 1 – Preparar o repositório

1. **Envie o código para o Git** (se ainda não fez):
   - Commit e push de todos os arquivos, incluindo:
     - `Dockerfile` (na raiz)
     - `next.config.js` (com `output: 'standalone'`)
     - `.dockerignore`
   - Não precisa enviar `.env.local` nem `node_modules` (já estão no `.gitignore`).

2. **Anote:**
   - URL do repositório (ex.: `https://github.com/seu-usuario/Dash-Transporteja`)
   - Nome do branch (ex.: `main`)

---

## Parte 2 – Criar o projeto no EasyPanel

1. Acesse o **EasyPanel** no navegador (URL do seu servidor).

2. Faça login (se pedir).

3. Na tela inicial:
   - Clique em **Create** (ou **New** / **Novo**).
   - Escolha **New project** (novo projeto).

4. Dê um nome ao projeto, por exemplo: **transporteja** ou **dashboard**.
   - Confirme / salve.

---

## Parte 3 – Adicionar o serviço (App)

1. Dentro do projeto criado, clique em **+ Service** (ou **Add Service**).

2. Escolha o tipo de serviço: **App** (aplicação web).
   - Não escolha Database, Cron etc.; só **App**.

3. Dê um nome ao serviço, por exemplo: **dashboard** ou **transporteja-web**.
   - Salve se pedir.

---

## Parte 4 – Conectar o repositório (Source)

1. Abra o serviço que você criou e vá na aba **Source** (ou **Código** / **Repository**).

2. **Conectar ao Git:**
   - Se for a primeira vez: **Connect to GitHub** (ou GitLab) e autorize o EasyPanel.
   - Depois, selecione:
     - **Repository:** o repositório do dashboard (ex.: `Dash-Transporteja`).
     - **Branch:** `main` (ou o branch que você usa).

3. **Build path (caminho do build):**
   - Deixe em branco ou **/** (raiz).
   - O `Dockerfile` está na raiz do repositório.

4. Salve (**Save**).

---

## Parte 5 – Configurar o build (Dockerfile)

1. Vá na aba **Build** do mesmo serviço.

2. **Build method / Método:** escolha **Dockerfile**.

3. **Dockerfile path / Caminho:**  
   - Digite: **Dockerfile**  
   - (nome do arquivo na raiz do repo).

4. Não é necessário preencher **Build context** se estiver na raiz.

5. Salve (**Save**).

---

## Parte 6 – Variáveis de ambiente (Environment)

1. Vá na aba **Environment** (ou **Variáveis**).

2. Adicione **duas variáveis** (botão **Add** ou **+**):

   | Nome (Key) | Valor (Value) |
   |------------|----------------|
   | `NEXT_PUBLIC_SUPABASE_URL` | A URL do seu projeto no Supabase. Ex.: `https://bwadzrzsikloaipaaayh.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | A chave **anon** (public) do Supabase. Ex.: `eyJhbGciOiJIUzI1NiIs...` |

   **Onde achar no Supabase:**  
   Dashboard do Supabase → **Project Settings** (ícone de engrenagem) → **API** →  
   - **Project URL** → copie para `NEXT_PUBLIC_SUPABASE_URL`  
   - **Project API keys** → **anon** **public** → copie para `NEXT_PUBLIC_SUPABASE_ANON_KEY`

3. **Importante:** não use a chave **service_role** (secret) em variáveis que começam com `NEXT_PUBLIC_`.

4. Salve (**Save**).

---

## Parte 7 – Fazer o deploy

1. Na tela do serviço, clique em **Deploy** (ou **Build and deploy** / **Redeploy**).

2. O EasyPanel vai:
   - Baixar o código do Git
   - Rodar o build do Docker (pode levar **5–15 minutos** na primeira vez)
   - Subir o container

3. Acompanhe pela aba **Logs** ou **Build logs**.  
   - Ao terminar, deve aparecer algo como **Success** ou **Running**.

4. **URL de acesso:**  
   - O EasyPanel mostra uma URL pública (ex.: `https://dashboard-transporteja.seudominio.com` ou por IP + porta).  
   - Use essa URL no navegador para acessar o dashboard.

---

## Parte 8 – Domínio e HTTPS (opcional)

1. Vá na aba **Domains** (ou **Domínios**) do serviço.

2. Adicione seu domínio (ex.: `dashboard.transporteja.com.br`).

3. Se o EasyPanel tiver **SSL automático**, ele pode gerar e renovar o certificado.  
   - Consulte a documentação do seu EasyPanel para ativar HTTPS.

---

## Resumo rápido (checklist)

- [ ] Código no Git (com `Dockerfile`, `next.config.js` com `standalone`)
- [ ] Projeto criado no EasyPanel
- [ ] Serviço tipo **App** adicionado
- [ ] **Source:** repositório e branch corretos
- [ ] **Build:** método **Dockerfile**, caminho `Dockerfile`
- [ ] **Environment:** `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] **Deploy** executado e build com sucesso
- [ ] Acesso pela URL gerada (e domínio/HTTPS se configurou)

---

## Problemas comuns

| Problema | O que fazer |
|----------|-------------|
| **Build falha** | Verifique os logs. Confirme que no repositório existem `Dockerfile`, `package.json`, `next.config.js` e que em `next.config.js` tem `output: 'standalone'`. |
| **Página em branco ou erro 502** | Confira se as variáveis de ambiente estão corretas (sem espaço extra, URL e anon key do Supabase). Veja os logs do **container** (não só do build). |
| **"Missing Supabase environment variables"** | As variáveis têm de se chamar exatamente `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Adicione na aba Environment e faça **Redeploy**. |
| **Login não funciona** | Confirme que no Supabase existem usuários na tabela `users` e que as políticas RLS e Auth estão corretas. Use o mesmo projeto Supabase que no `.env.local` local. |

---

## Referência dos arquivos do projeto

- **Dockerfile** – na raiz; build em 2 estágios (Node 20), porta 3000.
- **next.config.js** – deve conter `output: 'standalone'`.
- **.dockerignore** – evita copiar `node_modules`, `.env`, etc. para o build.

Com isso, o dashboard fica no ar no EasyPanel. Para atualizar no futuro: faça push no Git e clique em **Deploy** (ou configure webhook para deploy automático, se o painel permitir).
