# Motor de Frete Fracionado JCN Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task.

**Goal:** Calcular fracionado por ocupação do Truck, com parâmetros internos versionados, sem alterar dedicado nem análises antigas.

**Architecture:** A função Postgres `numeric` calcula e registra a memória interna. Uma revisão imutável da configuração do Truck é publicada pela aba Preço e frota; a análise usa essa revisão quando existir. O cálculo dedicado continua com a regra atual.

**Tech Stack:** PostgreSQL/Supabase, Next.js 14, TypeScript, testes SQL.

**Spec:** `C:/Users/Victor/Documents/Codex/2026-11-15/abva/outputs/PRD-motor-frete-fracionado-JCN.md`

## Global Constraints

- Não usar ANTT no motor fracionado, nem divulgar a reserva de cubagem na proposta ou PDF.
- Preservar cotações e análises existentes; não alterar o motor dedicado.
- Não substituir parâmetros ausentes por valores implícitos.
- O cálculo monetário usa `numeric` e arredonda apenas o preço final.
- Não fazer commit, push ou deploy sem a aprovação exigida em `CLAUDE.md`.

## Review Focus

- Configuração do Truck ausente: manter o cálculo legado até a primeira publicação, sem forjar uma configuração V1.
- Ocupação acima de 100%: fracionado sem preço, dedicado continua analisável.
- Cubagem ausente: recusar novo cálculo fracionado; não aplicar zero silenciosamente.
- Edição de frota: nova revisão, análises antigas preservadas.
- Memória interna: não entrar no PDF nem na mensagem comercial.

---

### Task 1: Motor e revisão de configuração

**Files:** criar migração em `supabase/migrations/`, teste em `supabase/tests/`.

- [x] Criar revisão imutável do Truck e publicação administrada em uma transação.
- [x] Criar motor `numeric` com reserva de 10%, peso cubado, ocupação máxima, custo rateado, seguro exclusivo, impostos, markup atual e mínimo interno.
- [x] Testar peso, volume, linear, mínimo, excesso de capacidade, versionamento e ausência de ANTT em Postgres temporário.

### Task 2: Integração com a cotação

**Files:** `app/(painel)/propostas/page.tsx`, `components/cotacao/CotacaoAnalysisView.tsx`, `lib/types/cotacao-erp.ts`, migração em `supabase/migrations/`.

- [x] Acrescentar metros lineares e parâmetros obrigatórios do Truck à aba Preço e frota.
- [x] Usar o motor fracionado após publicação; manter dedicado e análises antigas.
- [x] Mostrar mínimo interno fracionado, sem expor parâmetros internos no PDF ou na mensagem.
- [x] Validar TypeScript, testes, build e prévia autenticada antes de considerar deploy.
