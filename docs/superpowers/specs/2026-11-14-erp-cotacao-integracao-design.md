# ERP de cotação no painel JCN

## Intenção e decisão

Substituir a experiência da aba Propostas pelo ERP JCN localizado em `C:/Users/Victor/Documents/Codex/2026-11-13/https-github-com-morluto-rea-https/ERP JCN`. A rota `/propostas` continua válida para links antigos, mas sua navegação passa a se chamar Cotação. A integração é nativa no painel Next.js e usa a sessão e os cargos atuais; não cria outro login nem importa o esquema de organizações independente do protótipo.

## Abordagens consideradas

- Aplicativo Vite separado ou embutido: acelera a cópia visual, mas cria dois builds, duas sessões e duas bases de autorização.
- **Adaptação nativa (escolhida):** portar recursos do ERP para componentes e serviços do painel e reutilizar a API de rota, o gerador A4 e as permissões existentes. Exige mais adaptação, mas mantém uma única operação.

## Experiência

1. Colar pedido de WhatsApp/e-mail, extrair os campos reconhecidos e corrigir manualmente origem, destino, carga, contato e nota fiscal.
2. Calcular distância pela API existente `/api/rotas/distancia`, com aviso claro quando não houver rota. Permitir distância manual identificada como tal no histórico.
3. Exibir ocupação dos veículos, comparação fracionado/dedicado e memória dos custos com as versões de regras aprovadas pelo administrador.
4. Salvar e reabrir cotações do próprio autor; administradores podem consultar o histórico da equipe. Exportar histórico em CSV e cada análise em JSON.
5. Gerar proposta A4/PDF para cada cenário aprovado, texto copiável ao cliente, link voluntário de WhatsApp e texto de anúncio. Nenhum envio automático.
6. Configuração administrativa de veículos, coeficientes de piso, componentes fiscais, seguro, custos, margens, datas de vigência e revisão. Alterações criam versões; análises antigas preservam o retrato das entradas usadas.
7. A engrenagem da Cotação aparece somente para o cargo admin e abre uma janela com abas de tributos e seguro, preço e frota, e mensagens. ICMS-T, PIS/COFINS e CSLL/IRPJ LP são preenchidos separadamente e sua soma gera o percentual de tributos da revisão. Seguro é configurado à parte. O administrador pode editar o título e o corpo de cada mensagem; os títulos são rótulos e não mudam a regra de disponibilidade de mensagens com preço.

## Regra de segurança comercial

Os coeficientes e percentuais fixos do ERP local são exemplos, não configurações aprovadas. Sem conjunto completo e aprovado para a data e operação, o painel mostra extração, rota, carga e rascunho, mas bloqueia valor final, proposta/PDF com preço e mensagem de valores. Não migrar nem ativar os números de exemplo. A tela identifica quais regras estão pendentes. A aprovação administrativa é registrada com autor e data.

## Dados e acesso

Criar tabelas novas de cotações, análises e revisões de preços no Supabase da VPS. RLS: usuário autenticado lê e edita seus rascunhos; administrador lê todos e altera configurações; ninguém acessa por sessão anônima. O cálculo final valida a configuração aprovada no servidor e grava snapshot imutável dos parâmetros e resultado. Não modificar `routes`, fretes, comissões ou metas existentes.

## Compatibilidade e verificação

O editor A4 manual anterior não pode permanecer acessível nesta aba: ele aceita preço sem passar pelas regras aprovadas. Preservar seu código no histórico Git para eventual reaproveitamento seguro. Testar parser, cenários, ausência de regras, versão histórica, RLS por cargo, rota, PDF/CSV e a navegação desktop/mobile. Não publicar antes de migração verificada na VPS e prévia autenticada; seguir a regra de commit/push de `CLAUDE.md`.
