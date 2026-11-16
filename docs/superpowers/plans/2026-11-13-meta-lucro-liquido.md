# Meta de Lucro Líquido Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar uma meta mensal individual de lucro líquido, exibida em verde junto da meta de faturamento azul no Dashboard.

**Architecture:** A tabela existente `monthly_sales_goals` ganha uma coluna opcional `net_amount`, protegida pelas mesmas políticas RLS já utilizadas. Serviço, hook e Permissões passam a manipular os dois campos como uma única edição por usuário. O Dashboard recebe o lucro líquido do mês da métrica financeira existente e o apresenta em arco concêntrico interno.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Supabase Postgres/RLS, SVG.

**Spec:** `docs/superpowers/specs/2026-11-13-meta-lucro-liquido-design.md`

## Global Constraints

- Não alterar valores históricos, cálculo de frete, comissão, meta azul existente ou permissões de cargos.
- Apenas administradores podem inserir ou alterar metas; usuários consultam apenas as próprias metas.
- Não fazer commit, push ou deploy sem nova autorização explícita do usuário.
- Usar migração Supabase versionada; não desabilitar ou ampliar RLS.

## Review Focus

- Meta verde ausente: meta azul continua funcionando e a interface informa “A definir”.
- Meta verde inválida: zero, número não finito e valor maior que o limite são recusados antes da gravação.
- Isolamento: usuário não administrador só busca a própria meta.
- Valores ocultos: os dois resultados e metas não aparecem quando “Ocultar valores” estiver ativo.
- Alteração de meta: salvar a linha preserva a meta azul quando apenas a verde é editada, e vice-versa.

---

### Task 1: Persistência segura da meta líquida

**Files:**
- Create: `supabase/migrations/<timestamp>_monthly_sales_goals_net_amount.sql`
- Modify: `lib/services/monthly-sales-goals.ts`
- Test: `lib/services/monthly-sales-goals.test.mjs`

**Interfaces:**
- Produces: `MonthlySalesGoal { user_id, month, amount, net_amount }` e `saveMonthlySalesGoal(userId, month, amount, netAmount)`.

- [x] **Step 1: Escrever teste que falha**

Cobrir leitura de `net_amount` e validação independente de uma meta líquida positiva, sem aceitar zero ou valores fora do limite.

- [x] **Step 2: Executar o teste e confirmar falha**

Run: `node lib/services/monthly-sales-goals.test.mjs`

Expected: FAIL porque `net_amount` e o quarto argumento ainda não existem.

- [x] **Step 3: Criar a migração e estender o serviço**

Adicionar `net_amount numeric(14,2)` opcional, com `CHECK` permitindo `NULL` ou valor positivo finito. Manter a tabela e políticas existentes; o upsert envia os dois valores, preservando o identificador de conflito `user_id,month`.

- [x] **Step 4: Executar o teste e confirmar sucesso**

Run: `node lib/services/monthly-sales-goals.test.mjs`

Expected: PASS.

### Task 2: Meta verde na tela Permissões

**Files:**
- Modify: `app/(painel)/usuarios/page.tsx`
- Test: `scripts/test-dashboard-privacy.cjs` ou teste dedicado de renderização da página de usuários

**Interfaces:**
- Consumes: `MonthlySalesGoal.net_amount` e `saveMonthlySalesGoal(..., netAmount)` da Task 1.
- Produces: rascunho por usuário para `net_amount`, salvo pelo botão já existente.

- [x] **Step 1: Escrever teste que falha**

Verificar que a linha de um usuário elegível oferece “Meta de lucro líquido”, que somente admin a edita e que o botão Salvar inclui a alteração verde no cálculo de pendências.

- [x] **Step 2: Executar o teste e confirmar falha**

Run: comando do teste escolhido.

Expected: FAIL porque o campo/meta verde não existe.

- [x] **Step 3: Implementar o segundo campo na linha existente**

Manter o campo “Meta mensal” como faturamento e adicionar “Meta lucro líquido” ao lado, usando o mesmo mês, estado de salvamento e botão final da linha. Não criar botão adicional.

- [x] **Step 4: Executar o teste e confirmar sucesso**

Run: comando do teste escolhido.

Expected: PASS.

### Task 3: Métrica mensal e cartão de dois arcos

**Files:**
- Modify: `lib/utils/dashboard-metrics.ts`
- Modify: `app/(painel)/inicio/page.tsx`
- Modify: `components/dashboard/MonthlyGoalCard.tsx`
- Modify: `scripts/test-dashboard.cjs`
- Modify: `scripts/test-dashboard-privacy.cjs`

**Interfaces:**
- Consumes: `current.net` filtrado no mês vigente e `MonthlySalesGoal.net_amount`.
- Produces: `monthlyNet` para `MonthlyGoalCard` e visualização com arco azul externo/faturamento e verde interno/lucro líquido.

- [x] **Step 1: Escrever testes que falham**

Cobrir lucro líquido mensal calculado pela fórmula já existente, progresso verde separado do azul, estado sem meta verde e ocultação de ambos os valores.

- [x] **Step 2: Executar testes e confirmar falha**

Run: `node scripts/test-dashboard.cjs; node scripts/test-dashboard-privacy.cjs`

Expected: FAIL porque não há `monthlyNet` nem conteúdo/meta verde.

- [x] **Step 3: Implementar dados e visualização**

Expor `monthlyNet` a partir da soma já calculada no período mensal. Passá-lo ao cartão e desenhar um segundo arco SVG interno em verde, com textos distintos para faturamento e lucro líquido. Reutilizar `monthlyGoalProgress`; não duplicar fórmulas financeiras.

- [x] **Step 4: Executar testes e confirmar sucesso**

Run: `node scripts/test-dashboard.cjs; node scripts/test-dashboard-privacy.cjs`

Expected: PASS.

### Task 4: Verificação integrada e prévia

**Files:**
- Verify: arquivos das Tasks 1–3.

- [x] **Step 1: Rodar verificação estática e testes**

Run: `npx tsc --noEmit; node lib/services/monthly-sales-goals.test.mjs; node scripts/test-dashboard.cjs; node scripts/test-dashboard-privacy.cjs; git diff --check`

Expected: todos os comandos encerram com código 0.

- [x] **Step 2: Validar a prévia no navegador**

Confirmar arcos azul/verde, rótulos distintos, estado sem meta verde e campos na aba Permissões. Nenhuma publicação é feita nesta etapa.

## Self-review

- Cobertura da especificação: Tasks 1–3 implementam persistência, administração e exibição; Task 4 verifica a integração.
- Consistência: `net_amount` é o único nome persistido, propagado por tipo, serviço, tela e cartão.
- Foco de revisão: os cinco riscos listados são cobertos nas Tasks 1–3.
- Proporção: o plano define interfaces, testes e limites sem antecipar implementação detalhada.
