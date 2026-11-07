# Dashboard pessoal

Redesenhar a página inicial com três indicadores principais (fretes, comissões,
ticket médio), evolução do faturamento e participações financeiras calculadas pelos
mesmos helpers da Performance. Preservar filtros e comparações existentes. O
Dashboard permanece restrito aos registros do usuário, inclusive para administradores.

Mostrar contagem diária dos últimos sete dias e os sete fretes mais recentemente
cadastrados pelo usuário, independentemente do filtro principal. A atividade diária
considera a data de cadastro (fallback operacional para registros sem cadastro válido).
Gráficos financeiros
e meta usam a data operacional já utilizada na Performance (coleta, com fallback
para entrega). A meta mensal usa o mês corrente, independentemente do filtro.

Decisão do usuário: meta individual por vendedor, definida pelo administrador.
Guardar metas por usuário e mês em tabela própria, sem modificar fretes ou valores
históricos. RLS permite leitura própria; somente administradores podem gerenciar.
Sem meta cadastrada, mostrar estado explícito; nunca inventar um valor padrão.

Implementação: helpers de agregação testáveis, gráficos SVG sem nova dependência,
cartão de meta com editor administrativo, layout responsivo e modo escuro. Sem
blocos de clientes ou IA. Validar agregações, isolamento e RLS com rollback;
executar build e conferir visualmente antes de publicar.

## Validação

- `npm test`: permissões existentes e agregações do Dashboard (isolamento,
  legado financeiro, datas, meses, últimas rotas e progresso da meta).
- `scripts/test-monthly-goals.sql`: executar após a migração candidata dentro de
  `BEGIN`/`ROLLBACK`. Verifica leitura própria e escrita exclusiva de administradores
  para os seis cargos, além das restrições de valores e acesso anônimo.
- Build de produção, prévia local com um recorte real do próprio vendedor,
  filtros e detalhes do gráfico, tela de 390 px, modo escuro e período vazio.
- A prévia usa apenas os componentes finais, com uma barra local explícita. Seus
  arquivos de dados e a simulação da meta ficam fora do repositório de produção.

## Publicação

Aplicar `20261107213307_monthly_sales_goals.sql` em transação antes de disponibilizar
o frontend. Nenhuma meta é cadastrada por padrão. O administrador usa “Definir
metas” no Dashboard, escolhe mês e vendedor e informa o valor. Não altera políticas
ou dados de outras tabelas. O `CLAUDE.md` exige prévia e aprovação antes de commit/push.
