# Como Usar Criptografia e Rate Limiting

## 📋 Visão Geral

Este guia explica como usar a criptografia de dados sensíveis e rate limiting implementados no TransporteJá.

## 🔐 Criptografia de Dados Sensíveis

### 1. Executar Script SQL

1. Acesse o **Supabase Dashboard**
2. Vá em **SQL Editor**
3. Abra o arquivo `supabase/criptografia-dados-sensiveis.sql`
4. Copie todo o conteúdo
5. Cole no SQL Editor
6. Clique em **Run**

### 2. Configurar Chave de Criptografia

**IMPORTANTE:** Em produção, você DEVE usar uma chave segura!

#### Opção 1: Supabase Vault (Recomendado)
```sql
-- Armazenar chave no Supabase Vault
-- Acesse: Supabase Dashboard > Settings > Vault
-- Crie um secret chamado "encryption_key"
```

#### Opção 2: Variável de Ambiente
```sql
-- Configurar via SQL (apenas para desenvolvimento)
ALTER DATABASE postgres SET app.encryption_key = 'sua-chave-segura-aqui';
```

### 3. Migrar Dados Existentes

Após executar o script, migre os dados existentes:

```sql
-- Executar migração
SELECT migrate_existing_data_to_encrypted();
```

Isso irá:
- Criptografar todas as CNHs existentes
- Criptografar todos os telefones existentes
- Criptografar todos os emails existentes
- Criptografar CNPJs existentes

### 4. Usar Views Descriptografadas

No frontend, use as views descriptografadas:

```typescript
// Em vez de:
const { data } = await supabase.from('drivers').select('*')

// Use:
const { data } = await supabase.from('drivers_decrypted').select('*')
```

Ou use as funções helper:

```typescript
import { getDecryptedDriverData } from '@/lib/middleware/encryption'

const driver = await getDecryptedDriverData(driverId)
```

### 5. Como Funciona

- **Inserção/Atualização:** Dados são criptografados automaticamente via triggers
- **Leitura:** Use views `drivers_decrypted` ou `clients_decrypted`
- **Criptografia:** AES-256 via pgcrypto
- **Chave:** Armazenada de forma segura (Vault ou env var)

## 🚦 Rate Limiting

### 1. Executar Script SQL

1. Acesse o **Supabase Dashboard**
2. Vá em **SQL Editor**
3. Abra o arquivo `supabase/rate-limiting-setup.sql`
4. Copie todo o conteúdo
5. Cole no SQL Editor
6. Clique em **Run**

### 2. Configurar Limites

Os limites padrão são:

- **Login:** 5 tentativas/minuto, bloqueio de 15 minutos
- **Registro:** 3 tentativas/hora, bloqueio de 1 hora
- **Check-ins:** 60/minuto, bloqueio de 5 minutos
- **CRUDs:** 100 requisições/minuto
- **Exportação:** 5/hora
- **Exclusão:** 3/dia

Para alterar limites:

```sql
UPDATE public.rate_limit_config
SET max_requests = 200, window_seconds = 120
WHERE endpoint = '/api/drivers';
```

### 3. Usar no Frontend

#### Opção 1: Wrapper Automático

```typescript
import { withRateLimit } from '@/lib/middleware/rate-limiting'

// Envolver requisição
const data = await withRateLimit('/api/drivers', async () => {
  return await supabase.from('drivers').select('*')
})
```

#### Opção 2: Verificação Manual

```typescript
import { rateLimiter } from '@/lib/middleware/rate-limiting'

// Verificar antes de fazer requisição
const shouldBlock = await rateLimiter.shouldBlock('/api/drivers')
if (shouldBlock) {
  const message = await rateLimiter.getBlockMessage('/api/drivers')
  alert(message)
  return
}

// Fazer requisição normalmente
const { data } = await supabase.from('drivers').select('*')
```

#### Opção 3: Hook React

```typescript
import { useRateLimit } from '@/lib/middleware/rate-limiting'

function MyComponent() {
  const { isBlocked, remaining, resetAt } = useRateLimit('/api/drivers')
  
  if (isBlocked) {
    return <div>Limite excedido. Tente novamente em {resetAt}</div>
  }
  
  return <div>Requisições restantes: {remaining}</div>
}
```

### 4. Integrar em Funções SQL

Para proteger funções SQL críticas:

```sql
CREATE OR REPLACE FUNCTION minha_funcao_critica()
RETURNS JSONB AS $$
DECLARE
  v_rate_limit JSONB;
BEGIN
  -- Verificar rate limit
  v_rate_limit := check_rate_limit(
    get_rate_limit_identifier(),
    '/api/minha-funcao'
  );
  
  -- Se bloqueado, retornar erro
  IF (v_rate_limit->>'allowed')::BOOLEAN = false THEN
    RAISE EXCEPTION 'Rate limit excedido: %', v_rate_limit->>'message';
  END IF;
  
  -- Continuar com função normal
  -- ...
END;
$$ LANGUAGE plpgsql;
```

### 5. Monitorar Rate Limits

Ver logs de rate limiting:

```sql
-- Ver requisições bloqueadas recentes
SELECT * FROM public.rate_limits
WHERE blocked_until > NOW()
ORDER BY created_at DESC
LIMIT 20;

-- Ver estatísticas por endpoint
SELECT 
  endpoint,
  COUNT(*) as total_requests,
  COUNT(*) FILTER (WHERE blocked_until IS NOT NULL) as blocked_count
FROM public.rate_limits
WHERE window_start > NOW() - INTERVAL '1 hour'
GROUP BY endpoint;
```

## 🔧 Manutenção

### Limpar Registros Antigos

```sql
-- Limpar registros antigos de rate limiting
SELECT cleanup_old_rate_limits();
```

### Verificar Criptografia

```sql
-- Verificar se dados estão criptografados
SELECT 
  id,
  name,
  cnh IS NOT NULL as has_cnh_plain,
  cnh_encrypted IS NOT NULL as has_cnh_encrypted
FROM public.drivers
LIMIT 10;
```

## ⚠️ Importante

### Segurança

1. **Chave de Criptografia:**
   - NUNCA commite a chave no código
   - Use Supabase Vault em produção
   - Gere chave forte (32+ caracteres aleatórios)

2. **Rate Limiting:**
   - Ajuste limites conforme necessário
   - Monitore logs regularmente
   - Considere limites diferentes por tipo de usuário

3. **Dados Criptografados:**
   - Views descriptografadas só funcionam para usuários autorizados
   - RLS protege acesso aos dados
   - Backups também estarão criptografados

### Performance

- Criptografia adiciona ~1-2ms por operação
- Rate limiting usa índices otimizados
- Cache no frontend reduz chamadas ao backend

## 🐛 Troubleshooting

### Erro: "function encrypt_sensitive_data does not exist"
**Causa:** Script SQL não foi executado
**Solução:** Execute `criptografia-dados-sensiveis.sql`

### Erro: "permission denied for function"
**Causa:** Função não tem SECURITY DEFINER
**Solução:** Verifique se funções têm `SECURITY DEFINER`

### Rate limit não funciona
**Causa:** Função não está sendo chamada
**Solução:** Verifique se `check_rate_limit()` está sendo chamada antes das operações

### Dados não estão criptografados
**Causa:** Migração não foi executada ou triggers não estão ativos
**Solução:** Execute `migrate_existing_data_to_encrypted()` e verifique triggers

## 📚 Arquivos Relacionados

- `supabase/criptografia-dados-sensiveis.sql` - Script de criptografia
- `supabase/rate-limiting-setup.sql` - Script de rate limiting
- `lib/middleware/encryption.ts` - Helpers de criptografia
- `lib/middleware/rate-limiting.ts` - Helpers de rate limiting

