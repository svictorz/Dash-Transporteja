# PRD — Cadastro de Novos Usuários (Operadores)

**Produto:** TransporteJá — Dashboard  
**Versão do documento:** 1.0  
**Data:** Março 2026  
**Escopo:** Fluxo completo de registro, confirmação de e-mail e onboarding de novos operadores no dashboard.  
**Status:** Em revisão

---

## 1. Resumo executivo

Atualmente o TransporteJá **não possui fluxo de auto-cadastro**. Novos usuários são criados manualmente via script (`scripts/create-admin-user.mjs`) ou diretamente no Supabase. O botão "Registrar" na tela de login aponta para `#` (sem destino funcional).

Este PRD define o fluxo de **registro self-service para operadores** (transportadoras e empresas de frete), incluindo: formulário de cadastro, confirmação de e-mail, setup inicial do perfil (nome, telefone, dados da empresa) e atribuição de créditos de boas-vindas.

---

## 2. Declaração do problema

- Novos clientes interessados no TransporteJá **não conseguem se cadastrar sozinhos** — dependem de ação manual do time.
- A landing page convida a testar o produto, mas o fluxo de entrada está incompleto.
- Sem auto-cadastro, a aquisição de clientes é limitada e o custo operacional do onboarding é alto.
- Não há fluxo de recuperação de senha funcional (link "Esqueceu a Senha?" aponta para `#`).

---

## 3. Objetivos

| Objetivo | Descrição |
|----------|-----------|
| **Auto-cadastro** | Permitir que qualquer operador crie uma conta sem intervenção manual. |
| **Confirmação de e-mail** | Garantir que o e-mail pertence ao usuário antes de liberar o acesso. |
| **Onboarding guiado** | Coletar dados mínimos (nome, telefone, empresa) para o perfil funcionar. |
| **Créditos de boas-vindas** | Atribuir saldo inicial para o operador criar as primeiras rotas. |
| **Recuperação de senha** | Fluxo de reset de senha via e-mail. |
| **Conformidade LGPD** | Aceite explícito dos Termos de Uso e Política de Privacidade no ato do cadastro. |

---

## 4. Personas

| Persona | Descrição | Necessidade |
|---------|-----------|-------------|
| **Operador / Despachante** | Gestor de uma transportadora ou empresa de frete. Cadastra rotas, motoristas e clientes. | Criar conta rapidamente, entender o produto e começar a operar. |
| **Admin TransporteJá** | Time interno. Monitora novos cadastros e concede créditos adicionais. | Visualizar novos operadores, ajustar saldo e papéis (roles). |

---

## 5. Fluxo completo (estados)

```
[Landing page / Login] 
  → clica "Registrar"
  → [Formulário de Cadastro]
      → preenche e-mail, senha, nome, telefone
      → aceita Termos e Política
      → clica "Criar conta"
  → [E-mail de confirmação enviado]
      → usuário abre o link no e-mail
  → [Confirmação bem-sucedida]
      → [Setup do Perfil — passo único]
          → nome da empresa (opcional), segmento (opcional)
          → créditos de boas-vindas atribuídos automaticamente
  → [Dashboard] — acesso liberado
```

**Fluxo paralelo — Recuperação de senha:**

```
[Login] 
  → clica "Esqueceu a Senha?"
  → [Formulário de Recuperação] — informa e-mail
  → [E-mail de reset enviado]
      → usuário clica no link
  → [Formulário de Nova Senha]
  → [Login] — redireciona após reset
```

---

## 6. User stories

### 6.1 Cadastro

**US-01 — Criar conta com e-mail e senha**  
Como operador, quero preencher nome, e-mail e senha para criar minha conta no TransporteJá.  
**Critérios de aceite:**
- Campos: Nome completo, E-mail, Senha, Confirmar senha.
- Validação: e-mail válido, senha mínimo 8 caracteres (letras + número), senhas iguais.
- Aceite obrigatório dos Termos de Uso e Política de Privacidade (checkbox).
- Ao enviar: criar usuário no Supabase Auth + registro na tabela `users` com `role = 'operator'` e `credits_balance = 0`.
- Exibir mensagem "Verifique seu e-mail para ativar a conta".
- Em caso de e-mail já cadastrado: mensagem clara de erro.
- Rate limit: máximo 5 tentativas de cadastro por IP em 10 minutos.

**US-02 — Confirmar e-mail**  
Como operador, quero clicar no link recebido por e-mail para confirmar meu endereço e liberar o acesso.  
**Critérios de aceite:**
- Link de confirmação gerado pelo Supabase Auth (`confirmEmail`).
- Após clicar: redirecionar para `/dashboard/bem-vindo` (setup inicial) ou dashboard.
- Link expira em 24 horas; ao expirar, exibir opção de reenviar o e-mail.
- Se o usuário tentar logar antes de confirmar: mensagem informando que a confirmação está pendente + botão para reenviar.

**US-03 — Setup inicial do perfil (onboarding)**  
Como operador recém-cadastrado, quero completar meu perfil com dados da empresa para começar a operar.  
**Critérios de aceite:**
- Campos opcionais: Telefone, Nome da empresa, CNPJ (com busca automática de dados via `lib/services/cnpj.ts`).
- Ao informar o CNPJ: preencher automaticamente razão social e endereço da empresa.
- Ao concluir: atribuir créditos de boas-vindas (quantidade configurável; sugestão: 5 créditos).
- Usuário pode pular ("Configurar depois") e fazer isso mais tarde em Dados Pessoais / Configurações.
- Mostrar resumo: "Sua conta está pronta! Você recebeu X créditos para criar suas primeiras rotas."

### 6.2 Recuperação de senha

**US-04 — Solicitar reset de senha**  
Como operador que esqueceu a senha, quero receber um e-mail de recuperação para redefinir meu acesso.  
**Critérios de aceite:**
- Campo de e-mail na tela de recuperação (rota: `/login/recuperar-senha`).
- Ao enviar: chamar `supabase.auth.resetPasswordForEmail()`.
- Exibir: "Se o e-mail estiver cadastrado, você receberá as instruções em breve." (não revelar se o e-mail existe).
- Rate limit: máximo 3 solicitações por e-mail em 1 hora.

**US-05 — Definir nova senha**  
Como operador, quero definir uma nova senha após clicar no link de recuperação.  
**Critérios de aceite:**
- Rota: `/login/nova-senha` (com token Supabase na URL).
- Campos: Nova senha, Confirmar nova senha.
- Validação: mínimo 8 caracteres, diferente da atual (não obrigatório, mas recomendável).
- Ao salvar: chamar `supabase.auth.updateUser({ password })`, redirecionar para login com mensagem de sucesso.
- Token inválido ou expirado: exibir mensagem e link para solicitar novo e-mail.

### 6.3 Admin — gestão de novos cadastros

**US-06 — Visualizar novos operadores cadastrados**  
Como admin, quero ver a lista de operadores recém-cadastrados para monitorar a aquisição.  
**Critérios de aceite:**
- Na tela `/dashboard/configuracoes` (ou nova aba Admin): listar usuários com `role = 'operator'`, ordenados por `created_at` desc.
- Campos: nome, e-mail, data de cadastro, saldo de créditos, status (confirmado / pendente).
- Ação: adicionar créditos manualmente (input numérico + botão "Adicionar").

---

## 7. Requisitos

### Must-have (P0)

- [ ] Página `/register` com formulário de cadastro (nome, e-mail, senha, confirmar senha, checkbox de aceite).
- [ ] Integração com Supabase Auth (`signUp`) + insert na tabela `users`.
- [ ] E-mail de confirmação (via Supabase Auth built-in).
- [ ] Tratamento de erro: e-mail duplicado, senha fraca, senhas diferentes.
- [ ] Redirecionar confirmação para dashboard com setup inicial.
- [ ] Atribuição automática de créditos de boas-vindas após confirmação.
- [ ] Página `/login/recuperar-senha` — solicitar reset.
- [ ] Página `/login/nova-senha` — definir nova senha com token.
- [ ] Aceite dos Termos de Uso e Política de Privacidade (checkbox, links para `/legal/termos` e `/legal/privacidade`).
- [ ] Rate limit nas rotas de cadastro e recuperação de senha.

### Nice-to-have (P1)

- [ ] Step de onboarding com busca por CNPJ (preenche nome da empresa e endereço automaticamente).
- [ ] E-mail de boas-vindas personalizado (além do de confirmação do Supabase).
- [ ] Progress indicator durante o setup (Passo 1/2).
- [ ] Opção de login com Google (`supabase.auth.signInWithOAuth`).
- [ ] Painel admin de monitoramento de novos cadastros.

### Fora do escopo (v1)

- Cadastro de motoristas via self-service (motoristas são cadastrados pelo operador no dashboard).
- Planos pagos no ato do cadastro (fluxo de pagamento é separado).
- Convite por link (operador convida outro operador).
- SSO / SAML para empresas enterprise.

---

## 8. Requisitos técnicos

### Stack e integrações

| Item | Detalhe |
|------|---------|
| **Framework** | Next.js 14 (App Router), TypeScript |
| **Auth** | Supabase Auth — `signUp`, `resetPasswordForEmail`, `updateUser` |
| **Banco** | Tabela `users` (Supabase Postgres) — campos: `id`, `email`, `name`, `role`, `credits_balance`, `phone`, `avatar_url` |
| **Créditos** | Serviço `lib/services/credits.ts` — função de adicionar saldo ao cadastro |
| **CNPJ** | Serviço `lib/services/cnpj.ts` — busca dados da empresa para preenchimento automático |
| **Rate limit** | `lib/hooks/useRateLimit.ts` / `lib/middleware/rate-limiting.ts` |
| **Validação** | `lib/utils/validation.ts` — estender com validação de senha forte |
| **LGPD** | Registrar data e hora do aceite dos termos na tabela `users` (campo `terms_accepted_at`) |

### Rotas novas

| Rota | Arquivo | Descrição |
|------|---------|-----------|
| `/register` | `app/register/page.tsx` | Formulário de cadastro |
| `/register/confirmando` | `app/register/confirmando/page.tsx` | Tela "verifique seu e-mail" |
| `/dashboard/bem-vindo` | `app/dashboard/bem-vindo/page.tsx` | Setup inicial pós-confirmação |
| `/login/recuperar-senha` | `app/login/recuperar-senha/page.tsx` | Solicitar reset de senha |
| `/login/nova-senha` | `app/login/nova-senha/page.tsx` | Definir nova senha com token |

### Alterações no banco (Supabase)

```sql
-- Adicionar campo para registrar aceite dos termos
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

-- Adicionar campo de telefone (se não existir)
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;

-- Adicionar campo de nome da empresa
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_cnpj TEXT;
```

### Segurança

- Senhas: mínimo 8 caracteres, ao menos 1 letra e 1 número (validação front + configuração Supabase Auth).
- E-mail: confirmação obrigatória antes de liberar acesso ao dashboard.
- Rate limit: nas APIs `/api/auth/register` e `resetPasswordForEmail`.
- Não vazar se um e-mail já está cadastrado na tela de recuperação de senha (resposta genérica).
- Registrar `terms_accepted_at` como prova de aceite para conformidade LGPD.

---

## 9. UX / Design

### Princípios

- **Consistência:** usar os mesmos componentes e paleta da tela de login existente (card branco, fundo cinza, logo no topo).
- **Mínimo de atrito:** o cadastro deve ser concluído em menos de 2 minutos.
- **Feedback claro:** mensagens de erro inline (abaixo do campo), não apenas no topo do formulário.
- **Mobile first:** formulários devem funcionar bem em telas de 360px+.

### Telas a criar

1. **`/register`** — Card igual ao login, campos empilhados, checkbox de aceite com links, botão "Criar conta".
2. **`/register/confirmando`** — Ícone de e-mail, texto "Verifique sua caixa de entrada", botão "Reenviar e-mail", link "Voltar ao login".
3. **`/dashboard/bem-vindo`** — Card de onboarding (opcionais: telefone, empresa, CNPJ), botão "Concluir", link "Pular por agora".
4. **`/login/recuperar-senha`** — Campo de e-mail, botão "Enviar instruções", link "Lembrei minha senha".
5. **`/login/nova-senha`** — Campos nova senha + confirmar, botão "Redefinir senha".

---

## 10. Métricas de sucesso

| Métrica | Descrição | Alvo (sugestão) |
|---------|-----------|-----------------|
| **Taxa de conclusão do cadastro** | % de usuários que iniciam o cadastro e confirmam o e-mail. | ≥ 60% |
| **Taxa de conclusão do onboarding** | % de usuários confirmados que completam o setup inicial (sem pular). | ≥ 40% |
| **Tempo médio até primeiro frete criado** | Desde o cadastro até a criação da primeira rota. | ≤ 30 minutos |
| **Taxa de erro no cadastro** | % de tentativas que resultam em erro (e-mail inválido, senha fraca etc.). | ≤ 10% |
| **Churn pós-cadastro (7 dias)** | % de usuários que não retornam ao dashboard nos 7 dias após o cadastro. | Monitorar; baseline após 1 mês. |

---

## 11. Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| Spam de contas (bots) | Rate limit por IP + confirmação de e-mail obrigatória antes de liberar acesso. |
| E-mail de confirmação caindo em spam | Configurar domínio de envio no Supabase (SPF, DKIM, DMARC); usar domínio próprio. |
| Usuário não confirmar o e-mail | Exibir aviso no login ("confirme seu e-mail") + botão de reenvio. |
| Dados do CNPJ indisponíveis (API fora) | Tornar o passo do CNPJ opcional; não bloquear o cadastro em caso de falha da API. |
| Vazamento de créditos (double-submit) | Usar flag `onboarding_completed` na tabela `users`; atribuir créditos somente se `false`. |
| Aceite de termos sem leitura | Registrar `terms_accepted_at`; exibir link para os documentos; suficiente para conformidade. |

---

## 12. Dependências e premissas

- **Supabase Auth** com confirmação de e-mail habilitada (verificar configuração no projeto Supabase).
- **Serviço de créditos** (`lib/services/credits.ts`) deve ter função `addCredits(userId, amount, reason)`.
- **CNPJ service** (`lib/services/cnpj.ts`) já implementado; integrar no passo de onboarding.
- **Tabela `users`** no Supabase já existente; adicionar colunas `terms_accepted_at`, `phone`, `company_name`, `company_cnpj` via migration SQL.
- Páginas legais (`/legal/termos`, `/legal/privacidade`) já existem no projeto — confirmar conteúdo atualizado antes do lançamento.

---

## 13. Questões em aberto

| # | Questão | Responsável | Prazo |
|---|---------|-------------|-------|
| 1 | Quantos créditos de boas-vindas serão concedidos no cadastro? | Produto | — |
| 2 | O e-mail de confirmação usará o template padrão do Supabase ou um customizado? | Dev | — |
| 3 | O campo CNPJ no onboarding é para a empresa do **operador** ou para os **clientes** que ele cadastra? | Produto | — |
| 4 | Haverá aprovação manual de novos cadastros antes de liberar o dashboard? | Produto | — |
| 5 | Login com Google (OAuth) entra no escopo da v1 ou fica para v2? | Produto | — |

---

## 14. Próximos passos

1. Responder as questões em aberto (seção 13).
2. Executar migration SQL para adicionar colunas à tabela `users`.
3. Criar as 5 rotas novas (ver seção 8 — Rotas novas).
4. Implementar fluxo de cadastro + confirmação de e-mail.
5. Implementar fluxo de recuperação de senha.
6. Implementar step de onboarding com créditos de boas-vindas.
7. Testes: cadastro completo, e-mail duplicado, senha fraca, reset de senha, expiração de token.
8. Revisar com o time antes de colocar em produção.

---

*PRD de cadastro de novos usuários — TransporteJá Dashboard. Atualizar conforme evolução do produto.*
