# Plano: Créditos e Segurança (TransporteJá)

Documento de planejamento para sistema de créditos e reforço contra dados falsos/fraudes. **Nenhuma alteração no Supabase foi feita ainda** — este projeto usa ao máximo o que já existe; as mudanças no banco serão feitas em seguida quando necessário.

---

## 1. Sistema de Créditos

### Objetivo
Guardar no Supabase quantos créditos cada usuário/empresa tem e atualizar conforme o uso (ex.: criar rota = debitar 1 crédito).

### O que já existe
- Tabela `public.users`: `id`, `email`, `name`, `role`, `created_at`, `updated_at`
- Não há coluna de créditos hoje

### Opção A — Coluna na tabela `users` (recomendado para MVP)
- Adicionar em `users`: `credits_balance INTEGER NOT NULL DEFAULT 0`
- Regra: ao criar uma rota (ou outro consumo definido), decrementar `credits_balance` do usuário logado
- Se `credits_balance < 1`, bloquear criação de rota e exibir mensagem

### Opção B — Tabela separada (para múltiplos planos no futuro)
- Tabela `user_credits` ou `company_plans`: `user_id`, `credits_balance`, `plan_type`, `updated_at`
- Permite histórico, recargas e planos diferentes depois

### Quando debitar
- **Criar rota**: 1 crédito por rota (definir se é por frete ou por viagem)
- Opcional: envio de link de rastreio, relatórios, etc. (definir depois)

### O que foi implementado no código (sem mudar Supabase)
- **Serviço** `lib/services/credits.ts`: `fetchUserCredits(userId)` e `canCreateRoute(userId)`
- Exibição no dashboard (TopBar ou sidebar) com fallback “—” ou “Créditos em breve” se não houver dado
- Lógica de “debitar ao criar rota” preparada no frontend; a persistência real será feita no Supabase (trigger ou API) quando a coluna/tabela existir

---

## 2. Registro e Validação de Empresas (Clientes)

### Objetivo
Reduzir nomes e e-mails falsos, validar empresas reais e preencher dados a partir do CNPJ.

### O que já existe
- `lib/utils/validation.ts`: `validateCNPJ`, `validateEmail`, `validateName`, `validatePhone`, `validateCEP`
- Bloqueio de alguns e-mails temporários (tempmail, 10minutemail, etc.)
- Formulário de clientes com CNPJ obrigatório e validação de dígitos verificadores

### Melhorias implementadas

#### 2.1 Consulta CNPJ (auto-preenchimento)
- **Serviço**: `lib/services/cnpj.ts` — consulta à **Brasil API** (`GET https://brasilapi.com.br/api/cnpj/v1/{cnpj}`), gratuita e com CORS.
- No formulário de clientes: botão **“Buscar por CNPJ”** ao lado do campo CNPJ.
- Ao buscar: preenchimento de razão social, endereço (logradouro, número, complemento, bairro, município, UF, CEP) e, se a API retornar, telefone e e-mail.
- Mantém validação de CNPJ (dígitos verificadores) antes de chamar a API.

#### 2.2 Validação de nome da empresa
- Nova função `validateCompanyName`: mínimo de caracteres, rejeição de apenas números ou caracteres suspeitos, para evitar nomes fictícios óbvios.

#### 2.3 Mais bloqueio de e-mails temporários / descartáveis
- Ampliação da lista de domínios em `validateEmail` para incluir outros serviços conhecidos de e-mail descartável/fake.

#### 2.4 CEP
- Já existe CEP com ViaCEP e preenchimento de endereço; mantido e integrado ao fluxo “Buscar por CNPJ” (o CEP vindo da API do CNPJ preenche também o campo CEP do formulário).

---

## 3. Veículo e Placa

### Objetivo
Validar placa e, se possível, preencher modelo/veículo automaticamente.

### O que já existe
- `validatePlate`: formato antigo (ABC-1234) e Mercosul (ABC1D23).

### Auto-preenchimento por placa
- APIs de consulta por placa no Brasil (ex.: FIPE, Placafipe) costumam ser **pagas** (token/plano).
- **Implementado**: validação e formatação de placa; campo “veículo” continua manual.
- **Documentado**: quando houver contrato com alguma API (ex.: FIPE), basta criar um serviço `lib/services/placa.ts` e chamar no formulário de motoristas/rotas para preencher marca/modelo/ano.

---

## 4. SQL para aplicar no Supabase

Foi gerado o arquivo **`supabase/credits-and-clients-setup.sql`** para colar no SQL Editor do Supabase. Ele:

- Adiciona a coluna `credits_balance` em `users` (default 0) e constraint para não ficar negativo.
- Adiciona a coluna `cnpj` em `clients` (se não existir).
- Cria a função `decrement_credits_on_route_insert()` e o trigger em `routes` que debita 1 crédito do usuário logado (`auth.uid()`) ao inserir uma rota; se não houver crédito, a inserção da rota é revertida.

Para ativar: **Dashboard Supabase → SQL Editor → New query → colar o conteúdo do arquivo → Run.**

Para dar créditos iniciais a usuários existentes, após rodar o script você pode executar, por exemplo:
`UPDATE public.users SET credits_balance = 10 WHERE credits_balance = 0;`

---

## 5. Placa/veículo (deixado para depois)

- Auto-preenchimento de veículo por placa permanece para uma fase futura (APIs consultadas são pagas).
- Validação e formatação de placa continuam no app.
