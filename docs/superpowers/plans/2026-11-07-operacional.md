# Cargo Operacional

Goal: adicionar operacional, sem reutilizar operator (Comercial legado).

Architecture: visão global via helper existente; permissão de edição separada
para as duas seções do print. Policy UPDATE exclusiva do novo cargo com trigger
que rejeita qualquer coluna fora da lista. Valores derivados são calculados no
banco com as mesmas fórmulas e comissão do responsável. Demais cargos preservam
os helpers, policies e comportamento de escrita atuais.

- [x] Testar matriz dos helpers e cenário real RLS em transação com rollback.
- [x] Adicionar cargo às APIs, tipos, seleção e filtros de usuários.
- [x] Separar editar campos do print de editar status, observações e anexos.
- [x] Proteger whitelist de colunas, cálculos e perfil contra autoelevação.
- [x] Validar build e regressão antes de aplicar migration e trocar container.

Validação: npm test e next build aprovados; teste SQL aprovado com rollback.
Migração aplicada em transação após backup do schema e da imagem anterior.

Campos permitidos: cte_value, vale_pedagio, vale_pedagio_incluso, driver_value,
taxes_percent, seguro_percent, driver_name, driver_phone, driver_payment_status,
driver_payment_type, vehicle, plate. Derivados não são editáveis diretamente.
Operacional acessa Dashboard, Clientes, Rotas, Propostas, Calendário e Performance,
além de configurações e dados pessoais. Nas abas normais, cria/edita/exclui seus
próprios registros como o Comercial. Na Performance, mantém visão global e edição
limitada aos campos do print para fretes de terceiros. Não gerencia usuários nem
acessa Controle Financeiro. A atribuição do cargo segue as regras já existentes.
Nenhuma conta existente será convertida automaticamente.

Verificações: acesso global de leitura, update entre proprietários, bloqueio
de status/observação/valor do frete/dono/comissão/anexos, insert/delete bloqueados,
proteção do próprio cargo/comissão, fórmulas com pedágio incluso/não incluso,
matriz dos cargos antigos e build Next.js. Fixtures serão revertidas por rollback.
