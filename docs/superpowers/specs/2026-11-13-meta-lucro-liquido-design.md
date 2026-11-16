# Meta mensal de lucro líquido

## Intenção

Mostrar a evolução individual de duas metas mensais no Dashboard: faturamento e lucro líquido. O usuário escolheu dois arcos concêntricos: azul externo para faturamento e verde interno para lucro líquido.

## Escopo

- Manter a meta atual de faturamento e seu cálculo sem alterações.
- Criar uma meta mensal adicional de lucro líquido por usuário e mês.
- Na tela **Permissões**, exibir os dois campos de meta na mesma linha do usuário e salvá-los pelo botão Salvar já existente.
- Somente administradores podem gravar metas; cada usuário pode consultar somente as próprias metas no Dashboard.
- Exibir no Dashboard os dois percentuais, valores realizados, metas e valores faltantes. A cor verde identifica lucro líquido.

## Fora de escopo

- Não alterar valores históricos dos fretes, fórmulas financeiras, comissões, metas de faturamento existentes ou permissões de outros cargos.
- Não usar a meta de lucro líquido para bloquear telas, pagamentos ou cálculos operacionais.

## Alternativas avaliadas

1. Dois arcos exatamente sobrepostos: mais compacto, mas as duas porcentagens seriam ambíguas.
2. **Escolhida:** arcos concêntricos, azul externo e verde interno: as duas métricas seguem legíveis e podem evoluir separadamente.

## Implementação proposta

- Acrescentar `net_amount` opcional à tabela `monthly_sales_goals`, com validação positiva equivalente a `amount` e políticas RLS existentes preservadas.
- Estender o serviço, hook e rascunho da tela de Permissões para ler e salvar os dois valores em uma operação por usuário.
- Calcular o lucro líquido mensal a partir da mesma regra financeira já usada no Dashboard (`metrics.monthlyNet`), sem recalcular nem regravar fretes.
- Atualizar `MonthlyGoalCard` com SVG de dois arcos e texto acessível para ambas as metas. Sem meta verde definida, o arco verde e seus detalhes exibem “A definir”, enquanto a meta azul continua normal.

## Verificação

- Testes das funções de meta e métricas, incluindo ausência de meta verde, metas separadas e isolamento por usuário.
- Teste de renderização: ambas as cores e textos, e ocultação de valores continuam funcionando.
- Checagem TypeScript e prévia no navegador antes de qualquer deploy.
