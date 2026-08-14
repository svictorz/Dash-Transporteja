# PRD — Limpeza e Refatoração do Dash-Transporteja

**Versão:** 1.0 · **Data:** 2026-08-01
**Baseline auditado:** 18.846 linhas TS/TSX · 12.247 linhas SQL · 53 commits

---

## 1. Objetivo

Deixar o sistema **vendável**: sem tela que promete e não entrega, sem código morto, sem
lógica duplicada em três lugares. Não é reescrita — é poda.

**Meta mensurável:**

| Métrica | Hoje | Meta |
|---|---|---|
| Linhas TS/TSX | 18.846 | ≤ 16.500 (−12%) |
| Linhas SQL | 12.247 | ≤ 7.200 (−41%) |
| Telas que não funcionam | 3 | 0 |
| Rotas de API mortas | 2 | 0 |
| Implementações de `formatBRL` | 3 | 1 |
| Implementações de `compressImage` | 2 | 1 |
| Implementações de rótulo de status | 4 | 1 |
| Sistemas de filtro de período | 3 | 1 |

**Fora de escopo:** multi-tenancy, billing, CT-e, novas features. Este PRD é só
limpeza. Feature nova entra depois, em base limpa.

---

## 2. Parte A — REMOVER (código morto)

### A1. Telas fantasma

| Arquivo | Situação | Ação |
|---|---|---|
| [`app/(painel)/cotacao/page.tsx`](app/(painel)/cotacao/page.tsx) | 5 linhas, só `redirect('/performance')` | **Decidir:** religar ou deletar |
| [`app/(painel)/cotacao/loading.tsx`](app/(painel)/cotacao/loading.tsx) | órfão do acima | Deletar junto |
| [`app/(painel)/motoristas/page.tsx`](app/(painel)/motoristas/page.tsx) | 6 linhas, `redirect('/rotas')` | Deletar |

Remover também as entradas correspondentes em
[`lib/constants/painel-routes.ts`](lib/constants/painel-routes.ts) e no
[`SidebarTransporteja`](components/transporteja/SidebarTransporteja.tsx).

> **Decisão necessária:** a tela de Cotação foi desligada mas o backend
> (`/api/cotacao/rota`, 179 linhas, com cálculo de diesel/pedágio via env vars)
> está pronto e funcional. Religar custa ~4h e é feature vendável. Deletar custa 20min.
> **Recomendação: religar.** Ver item C6.

### A2. Rotas de API mortas

| Rota | Linhas | Quem chama | Ação |
|---|---|---|---|
| `app/api/cotacao/rota/route.ts` | 179 | ninguém (só o rate-limit do middleware) | Religar via A1 ou deletar |
| `app/api/geocode/reverse/route.ts` | 111 | ninguém | Deletar |
| `app/api/calcular-distancia/route.ts` | 111 | `propostas/page.tsx` | **Deletar e migrar** — ver C5 |

Ao deletar, remover as entradas de rate limit correspondentes em
[`middleware.ts:11-13`](middleware.ts:11).

### A3. Feature de créditos (nunca saiu do papel)

- `WELCOME_CREDITS = 0` em [`bem-vindo/page.tsx:13`](app/(painel)/bem-vindo/page.tsx:13)
- `credits_balance` em [`lib/supabase/types.ts`](lib/supabase/types.ts) (3 ocorrências)
- `supabase/credits-and-clients-setup.sql` (91 linhas)
- `supabase/credits-10-per-route.sql` (38 linhas)
- Migration `010_disable_route_credit_debit.sql` já desligou o débito

A RPC `complete_onboarding` recebe `welcome_credits` como parâmetro sempre zerado.
**Ação:** remover o parâmetro da RPC (nova migration), tirar do tipo e do onboarding.

### A4. SQL solto — 5.060 linhas fora do controle de migrations

22 arquivos `.sql` na raiz de `supabase/`, sendo os maiores:

```
975  validacoes-backend-completo.sql
699  setup-completo.sql          ← recria as mesmas 6 tabelas das migrations
651  validacoes-backend-melhorias.sql
411  EXECUTAR-TUDO.sql
370  EXECUTAR-MELHORIAS-VALIDACOES.sql
366  criptografia-dados-sensiveis.sql
338  lgpd-setup.sql
270  rate-limiting-setup.sql
238  rastreio-publico-setup.sql   ← rastreio removido na migration 018
186  unificar-app-dashboard.sql
165  rastreio-continuo-setup.sql  ← idem
```

**Problema:** `supabase/migrations/` (37 arquivos) é a fonte de verdade, mas esses
scripts avulsos podem conter objetos aplicados em produção que **não estão** em
nenhuma migration. Deletar às cegas é perigoso.

**Ação com portão de verificação:**
1. Rodar `supabase db diff` contra o banco de produção → listar objetos órfãos.
2. Todo objeto órfão vira uma migration nova (`038_consolida_objetos_legados.sql`).
3. Só então mover os 22 arquivos para `supabase/_legado/` (ou deletar).

⚠️ **Nunca execute o passo 3 antes do passo 1.**

### A5. Migrations de dados pontuais

`027`, `028`, `029` são transferências manuais de fretes entre dois usuários
específicos. Já rodaram, não são schema. Deixar como estão (histórico), mas
**documentar no README** que não devem ser replicadas em novo deploy — hoje um
`supabase db reset` num cliente novo tentaria transferir dados que não existem.

---

## 3. Parte B — CORRIGIR (promessas quebradas)

### B1. 🔴 CRÍTICO — Relatórios não gera relatório

[`app/(painel)/relatorios/page.tsx:92`](app/(painel)/relatorios/page.tsx:92):

```ts
// Simular geração de relatório
const report = { ... }
```

392 linhas de UI polida com um botão **"Gerar e Baixar Relatório"** que não baixa
nada. É o pior bug do sistema — não quebra, mente. Numa demo comercial isso mata a
venda.

**Duas saídas, escolha uma:**

**(a) Implementar** — os dados já estão todos no banco e a agregação já existe em
`performance/page.tsx`. Gerar CSV é trivial (`Blob` + `URL.createObjectURL`, zero
dependências). PDF exige lib nova — **não vale a pena**, CSV/Excel é o que
transportadora realmente usa. Estimativa: **1 dia**.

**(b) Remover a tela** inteira até ter tempo de fazer. 20 minutos.

> Recomendação: **(a) com CSV**. É a feature de menor esforço e maior valor
> percebido do repo inteiro.

### B2. Tipo `role` divergente entre banco e app

[`lib/supabase/types.ts:9`](lib/supabase/types.ts:9) declara:
```ts
role: 'admin' | 'comercial' | 'driver'
```

Mas o app usa `'financeiro'` e `'operator'` em toda parte
([`roles.ts`](lib/utils/roles.ts), `performance`, `usuarios`, RLS das migrations).
Resultado: cada tela faz o próprio *cast* e a própria normalização
`operator → comercial`.

**Ação:**
- `types.ts` passa a usar `DashboardUserRole` de [`roles.ts`](lib/utils/roles.ts).
- Criar `normalizeRole(role: string | null): DashboardUserRole | null` em `roles.ts`,
  que absorve o legado `operator → comercial`.
- Trocar as ~6 normalizações inline pelas chamadas.

### B3. `SUPER_ADMIN_EMAIL` hardcoded

[`lib/utils/roles.ts:9`](lib/utils/roles.ts:9) — e-mail fixo no código-fonte.
Impede qualquer venda sem recompilar. Mover para
`NEXT_PUBLIC_SUPER_ADMIN_EMAIL` com fallback para o valor atual.

### B4. Dados do emitente hardcoded

[`lib/constants/proposta-emitentes.ts`](lib/constants/proposta-emitentes.ts) tem
CNPJ, endereço e IE da Ágape e da JCN no código. Mesmo problema do B3.
**Ação mínima:** mover para env vars ou para uma tabela `emitentes`.
(Solução completa vem com multi-tenancy — fora deste PRD.)

---

## 4. Parte C — REFATORAR (duplicação medida)

> **Princípio:** só extrair o que está duplicado **de fato**, com evidência.
> Não vamos quebrar `rotas/page.tsx` em 20 arquivos porque tem 3.061 linhas —
> arquivo grande não é bug. Duplicação é.

### C1. `compressImage` + constantes de upload — duplicado literal

| Local | Linhas |
|---|---|
| [`rotas/page.tsx:103-150`](app/(painel)/rotas/page.tsx:103) | ~48 |
| [`performance/page.tsx:103-490`](app/(painel)/performance/page.tsx:455) | ~48 |

Cópia byte a byte: `SAFE_IMAGE_DIMENSION`, `IMAGE_COMPRESSION_QUALITY`,
`ALLOWED_IMAGE_TYPES`, `ALLOWED_DOCUMENT_TYPES`, `MAX_PDF_SIZE_BYTES` e a função.

**Ação:** `lib/utils/image-upload.ts`. **−48 linhas.**

### C2. Upload/listagem/remoção de documentos de frete — duplicado

`handleUploadDocuments`, `handleRemoveDocument`, `loadRouteDocuments` e o tipo
`RouteDocument` existem idênticos em `rotas` e `performance`, ambos batendo no
bucket `checkin-photos` com o prefixo `freteDocs-`.

**Ação:** `lib/hooks/useRouteDocuments.ts` — encapsula `list`, `upload`, `remove` e
o estado de loading. **−~180 linhas** e mata a classe inteira de bug "corrigi no
Rotas e esqueci do Performance".

### C3. `formatBRL` em 3 lugares (e já existe em utils!)

| Local | Situação |
|---|---|
| [`lib/utils/freight-financials.ts:141`](lib/utils/freight-financials.ts:141) | ✅ a canônica |
| [`inicio/page.tsx:76`](app/(painel)/inicio/page.tsx:76) | duplicata local |
| [`performance/page.tsx:90`](app/(painel)/performance/page.tsx:90) | duplicata local |

`formatBRLShort` (inicio:83) e `formatNumber` (performance:94) são genuinamente
úteis — **mover para `freight-financials.ts`**, não deletar.
`formatBRLProposta` em [`proposta-calculo.ts:63`](lib/utils/proposta-calculo.ts:63)
tem formatação diferente por exigência do PDF — **manter, renomear o comentário**
explicando por que difere.

### C4. Rótulo de status do frete em 4 lugares

`statusDisplay` / `statusLabel` / blocos `switch` inline aparecem em
`controle-financeiro:57`, `performance:420` e `:1717`, `inicio:359`, `rotas`.
Cada um com sua própria cor e string. Já divergiram: nem todos tratam o status
`documentation`, adicionado no commit `ed223a5`.

**Ação:** `lib/constants/route-status.ts` com um único
`ROUTE_STATUS = { inTransit: { label, dot }, ... }`. **−~60 linhas** e corrige a
divergência de `documentation`. **Esse é um bug real, não só estética.**

### C5. Duas APIs de distância idênticas

- `app/api/calcular-distancia/route.ts` — Nominatim + OSRM **inline** (111 linhas)
- `app/api/rotas/distancia/route.ts` — Nominatim + OSRM **via serviço** (66 linhas)

Mesmo comportamento, duas implementações. A segunda é a correta (usa
[`lib/services/cotacao-route.ts`](lib/services/cotacao-route.ts)).

**Ação:** apontar [`propostas/page.tsx:65`](app/(painel)/propostas/page.tsx:65) para
`/api/rotas/distancia` e deletar `calcular-distancia`. **−111 linhas.**
Ganho extra: propostas passa a ter rate limiting, que hoje não tem.

### C6. Três sistemas de filtro de período incompatíveis

```
inicio:63        'today' | '7d' | '30d' | 'month' | 'year' | 'all'
rotas:52         '7d' | 'month' | 'prevMonth' | 'all' | 'custom'
performance:59   'tudo' | 'essaSemana' | 'mesAtual' | '30d' | 'mesPassado' | 'custom'
```

Três tipos, três `PERIOD_OPTIONS`, dois idiomas, mesma intenção. Já existe
[`lib/utils/route-period-filter.ts`](lib/utils/route-period-filter.ts) — subutilizado.

**Ação:** um único `PeriodKey` + `PERIOD_OPTIONS` + `resolvePeriodRange()` em
`route-period-filter.ts`. Cada tela escolhe **quais** opções exibe, não redefine o
tipo. **−~120 linhas.**

### C7. `localStorage` — 34 chamadas com chaves em string solta

`'performance:listColumns'`, `'performance:visibleMoneyFields'`, período salvo,
tema… espalhadas. Um typo = preferência perdida silenciosamente.

**Ação mínima:** um `lib/constants/storage-keys.ts` com as chaves.
**Não** criar um wrapper genérico de storage — [`useColumnPrefs`](lib/hooks/useColumnPrefs.ts)
já resolve o caso complexo.

### C8. Padrão de acesso a dados furado

O [`CLAUDE.md`](CLAUDE.md) diz *"as páginas usam os hooks — nunca acessam o Supabase
diretamente"*. Na prática **8 páginas** importam `@/lib/supabase/client` direto.

Nem todo caso é violação (Storage e a tabela `users` não têm service).
**Ação:** criar `lib/services/users.ts` + `lib/hooks/useUsers.ts` (usados por
`usuarios`, `performance`, `controle-financeiro`, `dados-pessoais`) e atualizar o
CLAUDE.md para descrever a regra real, incluindo a exceção de Storage.

---

## 5. Fases de execução

Cada fase é entregável e testável isoladamente. **Rode `npm run build` ao fim de
cada uma.**

### Fase 1 — Poda (0,5 dia) · risco baixo
- A1 telas fantasma (decidir Cotação antes)
- A2 APIs mortas
- A3 créditos
- C5 unificar API de distância

**Ganho:** −350 linhas TS. **Aceite:** build passa, nenhuma rota 404, propostas
continua calculando distância.

### Fase 2 — Consertar o que mente (1 dia) · risco baixo
- B1 Relatórios com export CSV real
- C4 status unificado (corrige `documentation` faltando)

**Aceite:** botão de relatório baixa CSV com os dados do período/empresa.
Status `documentation` aparece corretamente nas 4 telas.

### Fase 3 — Deduplicar (1,5 dia) · risco médio
- C1 `image-upload.ts`
- C2 `useRouteDocuments`
- C3 `formatBRL`
- C6 período unificado
- C7 storage keys

**Ganho:** −500 linhas. **Aceite:** upload e remoção de documentos funcionam
idênticos em Rotas e Performance; filtros de período dão os mesmos números de antes
em cada tela.

### Fase 4 — Tipos e configuração (1 dia) · risco médio
- B2 `role` unificado + `normalizeRole`
- B3 super admin via env
- B4 emitente via env
- C8 `useUsers` + CLAUDE.md atualizado

**Aceite:** trocar `NEXT_PUBLIC_SUPER_ADMIN_EMAIL` muda quem gerencia permissões,
sem editar código.

### Fase 5 — SQL (0,5 dia) · risco ALTO ⚠️
- A4 com o portão de verificação
- A5 documentar migrations de dados

**Aceite:** `supabase db reset` num projeto limpo reproduz o schema de produção.
**Só execute com backup do banco.**

**Total: 4,5 dias.**

---

## 6. Rede de segurança (obrigatória antes da Fase 3)

Este repo **não tem nenhum teste**. Refatorar cálculo financeiro sem teste é como
trocar pneu andando.

Não estou pedindo suíte completa — pedindo **um arquivo**:

`lib/utils/freight-financials.test.ts` cobrindo `calculateTaxesValue`,
`calculateSeguroValue`, `calculateNetFreightValue` e `calculateCommissionValue`
com 3 casos cada (zero, típico, arredondamento).

É onde mora o dinheiro do cliente. Sem `vitest`/`jest`: um `assert` num script
Node rodado por `npm run check` já resolve. **Estimativa: 2h.**

---

## 7. Escopo negativo — o que NÃO fazer

Explicitamente fora, para ninguém "aproveitar a viagem":

| Não fazer | Por quê |
|---|---|
| Quebrar `rotas/page.tsx` (3.061 linhas) em 20 componentes | Arquivo grande não é bug. Extraia só o que for **reusado** (C1, C2). Fragmentar aumenta o custo de leitura sem reduzir complexidade. |
| Trocar Tailwind / Framer Motion / lucide | Funcionam. Zero valor para o comprador. |
| Adicionar Zustand / Redux / React Query | `useState` + hooks + Realtime dão conta. Dependência nova é dívida nova. |
| Criar camada de abstração sobre o Supabase | Você não vai trocar de banco. Interface com uma implementação é custo puro. |
| Migrar para Next 15 / App Router "mais moderno" | Não é pedido, não é problema, e quebra coisa. |
| Converter tudo para Server Components | Reescrita disfarçada de refatoração. |
| Adicionar lib de PDF para Relatórios | CSV resolve. PDF já existe onde importa (propostas), feito sem lib. |

---

## 8. Critérios de aceite globais

- [ ] `npm run build` passa sem warning novo
- [ ] `npm run lint` passa
- [ ] Nenhuma tela do menu leva a redirect ou a botão que não faz nada
- [ ] Nenhum `formatBRL` / `compressImage` / rótulo de status duplicado
- [ ] `grep -rn "Simular"` no `app/` retorna vazio
- [ ] Status `documentation` renderiza igual nas 4 telas
- [ ] Trocar o e-mail de super admin não exige editar código
- [ ] Existe pelo menos um teste rodável nos cálculos financeiros
- [ ] `supabase db reset` reproduz produção
- [ ] Linhas TS/TSX ≤ 16.500

---

## 9. Efeito na avaliação comercial

| Item | Efeito no preço |
|---|---|
| B1 (Relatórios funcionando) | Remove o pior bloqueio de demo |
| A4 (SQL consolidado) | Deploy para cliente novo deixa de ser artesanal |
| B3+B4 (config via env) | Pré-requisito de qualquer white-label |
| §6 (teste financeiro) | O item que mais pesa em due diligence |
| C1–C8 | Reduz custo de manutenção — argumento direto na negociação |

Este PRD **não** adiciona feature. Ele transforma "um sistema interno bem feito"
em "um produto que dá para entregar a terceiro". É pré-requisito para o
multi-tenancy, não substituto dele.
