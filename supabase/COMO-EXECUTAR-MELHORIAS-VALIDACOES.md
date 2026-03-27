# Como Executar Melhorias nas Validações do Backend

Este documento explica como aplicar as melhorias nas validações do backend do TransporteJá.

## 📋 O que são essas melhorias?

As melhorias adicionam camadas extras de segurança e validação:

1. **Sanitização de inputs** - Previne ataques XSS removendo tags HTML e JavaScript
2. **Validação de arquivos** - Verifica tipo, formato e tamanho de fotos
3. **Validação de coordenadas GPS do Brasil** - Garante que check-ins estão dentro do território brasileiro
4. **Validação de integridade referencial** - Impede exclusão de dados que estão em uso
5. **Verificação de duplicatas** - Evita cadastros duplicados (CNH, email, telefone, CNPJ)
6. **Cálculo de distância** - Função para calcular distância entre coordenadas GPS

## 🚀 Como executar

### Opção 1: Script único (recomendado)

1. Abra o **SQL Editor** no Supabase
2. Abra o arquivo `supabase/EXECUTAR-MELHORIAS-VALIDACOES.sql`
3. Copie todo o conteúdo
4. Cole no SQL Editor
5. Clique em **Run** (ou pressione `Ctrl+Enter`)

### Opção 2: Script completo (com comentários)

1. Abra o **SQL Editor** no Supabase
2. Abra o arquivo `supabase/validacoes-backend-melhorias.sql`
3. Copie todo o conteúdo
4. Cole no SQL Editor
5. Clique em **Run**

## ✅ Como verificar se funcionou

Execute o script de testes:

1. Abra o arquivo `supabase/testar-validacoes-melhorias.sql`
2. Copie todo o conteúdo
3. Cole no SQL Editor
4. Execute

Se todos os testes passarem, você verá mensagens como:
```
✅ Sanitização de texto: OK
✅ Validação de foto: OK
✅ Validação de coordenadas Brasil: OK
✅ Cálculo de distância: OK
✅ Validação de integridade referencial: OK
✅ Validação de duplicatas: OK
```

## 🔍 O que cada melhoria faz?

### 1. Sanitização de Inputs

**Função:** `sanitize_text()`

Remove caracteres perigosos que poderiam ser usados em ataques XSS:
- Remove tags HTML (`<script>`, `<img>`, etc)
- Remove `javascript:` de URLs
- Remove event handlers (`onclick`, `onload`, etc)

**Exemplo:**
```sql
SELECT sanitize_text('<script>alert("xss")</script>João Silva');
-- Retorna: "João Silva"
```

### 2. Validação de Arquivos

**Função:** `validate_photo_file()`

Valida URLs de fotos:
- Verifica extensão (apenas JPG, PNG, WEBP)
- Verifica se é uma URL válida (https://)
- Verifica tamanho máximo da URL

**Exemplo:**
```sql
SELECT validate_photo_file('https://exemplo.com/foto.jpg');
-- Retorna: true

SELECT validate_photo_file('foto.exe');
-- Retorna: false
```

### 3. Validação de Coordenadas do Brasil

**Função:** `validate_coordinates_brazil()`

Garante que coordenadas GPS estão dentro do território brasileiro:
- Latitude: entre -33.75 e 5.27
- Longitude: entre -74.0 e -32.4

**Exemplo:**
```sql
SELECT validate_coordinates_brazil(-23.5505, -46.6333); -- São Paulo
-- Retorna: true

SELECT validate_coordinates_brazil(40.7128, -74.0060); -- Nova York
-- Retorna: false
```

### 4. Integridade Referencial

**Função:** `validate_referential_integrity()`

Impede exclusão de dados que estão em uso:
- Não permite excluir motorista com rotas ativas
- Avisa ao excluir rota que tem check-ins relacionados

**Exemplo:**
```sql
-- Tentar excluir motorista com rota ativa
DELETE FROM drivers WHERE id = '...';
-- Erro: "Não é possível excluir motorista com rotas ativas"
```

### 5. Verificação de Duplicatas

**Funções:** `check_duplicate_driver()`, `check_duplicate_client()`

Evita cadastros duplicados:
- CNH duplicada em motoristas
- Email duplicado em motoristas/clientes
- Telefone duplicado em motoristas
- CNPJ duplicado em clientes

**Exemplo:**
```sql
-- Tentar cadastrar motorista com CNH já existente
INSERT INTO drivers (name, cnh, ...) VALUES ('João', '12345678901', ...);
-- Erro: "CNH já cadastrada para outro motorista"
```

### 6. Cálculo de Distância

**Função:** `calculate_distance()`

Calcula distância entre duas coordenadas GPS usando fórmula de Haversine.

**Exemplo:**
```sql
-- Distância entre São Paulo e Rio de Janeiro
SELECT calculate_distance(-23.5505, -46.6333, -22.9068, -43.1729);
-- Retorna: ~430.0 (km)
```

## 🔄 O que mudou nos triggers existentes?

Os triggers de validação foram atualizados para incluir:

1. **Sanitização automática** de todos os campos de texto
2. **Validação de coordenadas do Brasil** nos check-ins
3. **Validação de arquivos** nas URLs de fotos
4. **Validação de tamanhos máximos** mais rigorosa

## ⚠️ Importante

- As melhorias são **compatíveis** com as validações existentes
- Não é necessário migrar dados existentes
- Novos dados inseridos automaticamente passarão pelas novas validações
- Dados existentes não serão alterados automaticamente

## 🐛 Problemas comuns

### Erro: "function validate_coordinates does not exist"

**Solução:** Execute primeiro o script `validacoes-backend-completo.sql` para criar as funções base.

### Erro: "trigger already exists"

**Solução:** Os triggers são recriados automaticamente. Se o erro persistir, execute:
```sql
DROP TRIGGER IF EXISTS trigger_validate_checkin ON public.checkins;
DROP TRIGGER IF EXISTS trigger_validate_driver ON public.drivers;
DROP TRIGGER IF EXISTS trigger_validate_client ON public.clients;
DROP TRIGGER IF EXISTS trigger_validate_route ON public.routes;
```
E então execute novamente o script de melhorias.

### Erro ao tentar excluir motorista com rota ativa

**Isso é esperado!** A validação está funcionando. Você precisa:
1. Cancelar ou concluir todas as rotas do motorista
2. Depois excluir o motorista

## 📚 Arquivos relacionados

- `validacoes-backend-completo.sql` - Validações base (execute primeiro)
- `validacoes-backend-melhorias.sql` - Melhorias (versão completa com comentários)
- `EXECUTAR-MELHORIAS-VALIDACOES.sql` - Script único para executar tudo
- `testar-validacoes-melhorias.sql` - Script de testes

## ✅ Próximos passos

Após executar as melhorias:

1. Execute os testes para verificar se tudo está funcionando
2. Teste criando um novo motorista/cliente/rota para ver as validações em ação
3. Tente inserir dados inválidos para ver as mensagens de erro

---

**Dúvidas?** Verifique os comentários nos scripts SQL ou consulte a documentação do Supabase.

