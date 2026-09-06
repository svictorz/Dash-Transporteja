# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Regras do Projeto

### Deploy
- **Nunca fazer commit/push sem aprovação explícita do usuário.**
- Sempre mostrar o resultado no browser preview primeiro.
- Perguntar "Quer que eu faça o deploy agora?" antes de qualquer `git commit` ou `git push`.

## Comandos

```bash
npm run dev          # inicia em http://localhost:3003
npm run dev:clean    # limpa cache do Next antes de iniciar
npm run build        # build de produção
npm run lint         # ESLint via next lint
```

Testes: arquivos `lib/utils/*.test.mjs` rodam com `node <arquivo>` (usam `node:test`,
sem framework). Não há script npm que rode todos. `npm run lint` **não está
configurado** — abre o wizard de setup do ESLint.

## Arquitetura

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase (Postgres + Auth + Storage + Realtime) · Framer Motion

### Estrutura de Pastas

```
app/
  (painel)/        # route group — painel CRM (sem prefixo na URL)
  api/             # Route Handlers do Next.js
  auth/callback/   # OAuth callback do Supabase
  login/           # páginas públicas de auth
  register/
  legal/
lib/
  supabase/        # client.ts (browser), server.ts (RSC/middleware), proxy.ts (updateSession), storage.ts
  services/        # acesso direto ao Supabase (routes, drivers, clients, cotacao-route…)
  hooks/           # React hooks que encapsulam os services (useRoutes, useDrivers, useClients…)
  utils/           # funções puras (roles, date-format, route-period-filter, rate-limit…)
  constants/       # painel-routes, brand, theme, proposta-*
  types/           # proposta.ts
components/
  transporteja/    # Sidebar, TopBar, BrandLoading, Logo, CEPInput, CommissionPaidStatus
  propostas/       # formulário + preview PDF de propostas comerciais
  animations/      # FadeIn, loading-animation (Lottie JSON)
```

### Autenticação e Autorização

- Auth via **Supabase Auth** com sessão mantida por cookie (SSR). O middleware em `middleware.ts` chama `updateSession` em todas as rotas não-estáticas em produção; em desenvolvimento passa direto.
- A tabela `public.users` sincroniza com `auth.users` e armazena `role`: `admin` | `comercial` | `financeiro` | `driver`.
- O layout `app/(painel)/layout.tsx` protege o CRM no cliente: verifica sessão (`useAuthState`) e role (`useCurrentUser`). Roles com acesso: `admin`, `comercial`, `financeiro` — motoristas usam um app separado.
- `SUPER_ADMIN_EMAIL` (hardcoded em `lib/utils/roles.ts`) tem acesso irrestrito mesmo com role inconsistente no banco.
- Visibilidade de dados por role: `admin`/`financeiro` veem todos os comerciais; `comercial` vê apenas seus próprios registros (filtrado por `created_by_user_id`).

### Padrão de Acesso a Dados

Camada de serviço em `lib/services/` faz queries ao Supabase e retorna dados tipados. Hooks em `lib/hooks/` consomem esses services, gerenciam estado local e assinam **Realtime** (`postgres_changes`) para manter a UI sincronizada sem reload. As páginas usam os hooks — nunca acessam o Supabase diretamente.

### Middleware

`middleware.ts` cobre três responsabilidades:
1. Redirect 308 de URLs legadas `/dashboard/*` → `/` (via `legacyDashboardRewrite`).
2. Rate limiting por IP em `/api/rotas/distancia`.
3. `updateSession` para renovação de cookie de sessão Supabase (apenas produção).

### Variáveis de Ambiente

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
# Opcional — identifica a aplicação no Nominatim:
COTACAO_NOMINATIM_USER_AGENT=
```

### Banco de Dados (Supabase)

Tabelas principais: `users`, `drivers`, `routes`, `checkins`, `clients`, `calendar_events`.

A tabela `routes` é a entidade central — representa um frete com `freight_id` (sequence do banco), campos financeiros (`freight_value`, `driver_value`, `taxes_percent`, `net_freight_value`, `commission_value`, `commission_paid`), status do pagamento e check-ins de coleta/entrega. Ao criar uma rota sem `freight_id`, omitir o campo no payload para que o banco use o `DEFAULT nextval(...)`.

### Propostas Comerciais

O módulo `app/(painel)/propostas/` + `components/propostas/` gera propostas em PDF diretamente no browser (sem backend). Os dados de emitente ficam em `lib/constants/proposta-emitentes.ts` e os cálculos em `lib/utils/proposta-calculo.ts`.

### Distância entre Cidades

`/api/rotas/distancia` resolve origem e destino via Nominatim e calcula a rota
rodoviária via OSRM, usando `lib/services/cotacao-route.ts`. Consumido por
`useDebouncedRouteDistance` (tela de Rotas).

A tela de Cotação de frete e a API de geocodificação reversa foram removidas.
