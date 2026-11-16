# ERP de Cotação no Painel JCN — Plano de implementação

**Objetivo:** substituir a aba Propostas pelo ERP JCN completo, integrado à autenticação do painel e sem emitir preços antes da aprovação das regras.

**Arquitetura:** componentes Next.js para o fluxo; serviços Supabase com RLS para cotações e configurações; API server-side para análise; snapshot imutável dos parâmetros aprovados. O protótipo Vite é referência funcional, não entra no bundle.

**Especificação:** `docs/superpowers/specs/2026-11-14-erp-cotacao-integracao-design.md`.

## Etapa 1 — Contratos e persistência

- [ ] Definir tipos de pedido, cotação, cenário, versão de regras e snapshot em `lib/types/cotacao-erp.ts`.
- [ ] Criar migração nova para cotações, revisões de regras e análises; habilitar RLS e grants mínimos. Aproveitar os cargos da tabela `public.users`.
- [ ] Testar leitura/escrita própria, leitura administrativa, bloqueio de outros usuários e anônimos; confirmar a migração no Supabase da VPS.

## Etapa 2 — Entrada e rota

- [ ] Portar e testar `parseFreightRequest`, incluindo formatos de moeda, cidades/UF e entradas ambíguas.
- [ ] Criar editor de cotação em `/propostas`, com extração revisável, validação e cálculo via `/api/rotas/distancia`.
- [ ] Distinguir distância automática e manual; evitar chamadas diretas do navegador ao Nominatim/OSRM do protótipo.

## Etapa 3 — Configuração e cálculo

- [ ] Criar editor administrativo versionado para veículos, coeficientes, tributos, seguro, custos e margem por vigência.
- [ ] Implementar análise no servidor que exige versão completa e aprovada; calcular cenários e gravar memória de cálculo e snapshot.
- [ ] Testar ausência/incompletude de regras, datas de vigência, carga acima da capacidade, arredondamento e preservação de análises antigas.

## Etapa 4 — Histórico e saídas

- [ ] Salvar/reabrir rascunhos, listar histórico autorizado, procurar similares e exportar CSV/JSON com escaping correto.
- [ ] Reutilizar a proposta A4 existente como base e gerar os PDFs de ambos cenários com identidade JCN e preço do snapshot aprovado.
- [ ] Criar mensagens e anúncio copiáveis, WhatsApp por clique do usuário, sem envio automático nem publicação externa.

## Etapa 5 — Integração e liberação

- [ ] Renomear navegação Propostas para Cotação mantendo `/propostas`; confirmar acesso para todos os cargos atuais sem alterar seus privilégios em fretes/performance.
- [ ] Rodar testes, TypeScript, build, teste visual mobile/desktop, teste de RLS e fluxo ponta a ponta com e sem configuração aprovada.
- [ ] Aplicar migração na VPS e verificar leitura pelo PostgREST real. Publicar somente após prévia autenticada e autorização de commit/push conforme `CLAUDE.md`.
