# Diagnóstico: fotos do motorista não aparecem no frete

Quando a coleta/entrega já foi feita no app do motorista e a foto não aparece no dashboard ou na página de rastreio, siga estes passos.

---

## 1. Confirmar o código completo do frete

O sistema usa o **código completo do frete** (`freight_id`), não só os últimos dígitos.

- Exemplo: frete “com final 320” pode ser **930682320** (9 dígitos).
- No dashboard, ao abrir **Ver mais** no frete, aparece **Frete #930682320** (ou o número que for). Esse é o valor que importa.

---

## 2. Verificar no Supabase se existem check-ins para esse frete

No **Supabase** → **Table Editor** → tabela **`checkins`**:

1. Use o filtro na coluna **`freight_id`**:
   - Valor exato: ex. **930682320** (o código completo do frete).
2. Ou no **SQL Editor** rode:

```sql
-- Troque 930682320 pelo código completo do seu frete (o que aparece no dashboard como Frete #...)
SELECT id, type, freight_id, route_id, driver_id, photo_url, timestamp, created_at
FROM public.checkins
WHERE freight_id = 930682320
ORDER BY timestamp DESC;
```

**Resultado:**

- **Se retornar linhas:** os check-ins existem com o `freight_id` certo. O problema pode ser cache do navegador ou atraso do Realtime. Use **“Atualizar fotos”** no modal do frete (dashboard) e recarregue a página de rastreio.
- **Se não retornar nada:** os check-ins **não** foram gravados com esse `freight_id`. O problema está no **app do motorista** (veja seção 3).

---

## 3. Se não houver check-ins: conferir como o app grava

O dashboard busca fotos com:

- **Tabela:** `checkins`
- **Filtro:** `freight_id` = código do frete (ex.: 930682320)
- **Campos usados:** `type` ('pickup' ou 'delivery'), `photo_url`, `timestamp`, `address`

O app deve gravar o check-in de uma destas formas:

### Opção A – Usar o RPC (recomendado)

Chamar no Supabase:

- **Coleta:** `confirm_pickup(p_route_id, p_driver_id, p_photo_url, p_coords_lat, p_coords_lng)`
- **Entrega:** `confirm_delivery(p_route_id, p_driver_id, p_photo_url, p_coords_lat, p_coords_lng)`

O RPC pega o `freight_id` da rota (`route_id`) e grava no `checkins` automaticamente.  
É necessário enviar o **UUID da rota** (`route_id`) e do **motorista** (`driver_id`) corretos (os mesmos do login do frete).

### Opção B – Insert direto na tabela `checkins`

Se o app fizer `INSERT` direto em `checkins`, é **obrigatório** preencher:

- `freight_id` = código completo do frete (ex.: 930682320), **não** só 320
- `route_id` = UUID da rota
- `driver_id` = UUID do motorista
- `type` = 'pickup' ou 'delivery'
- `photo_url` = URL da foto (ex.: Supabase Storage)
- `coords_lat`, `coords_lng` = números
- `timestamp` = data/hora (ou usar default)

Se `freight_id` for `NULL`, ou só **320** em vez do código completo, o check-in **não** aparece no frete no dashboard.

---

## 4. Conferir rota no Supabase

Para ver o `freight_id` e o `id` (route_id) da rota:

```sql
SELECT id, freight_id, driver_id, status, origin, destination
FROM public.routes
WHERE freight_id::text LIKE '%320'
   OR id::text = 'UUID_DA_ROTA';
```

Use o **`freight_id`** que aparecer aí nas consultas da seção 2 e no app.

---

## 5. Resumo rápido

| Onde ver | O que fazer |
|----------|-------------|
| Dashboard → Fretes → Ver mais | Clicar em **“Atualizar fotos”** e ver o **Frete #XXXXX** (código completo). |
| Supabase → `checkins` | Filtrar por `freight_id` = código completo. Se não houver linhas, o app não está gravando com esse `freight_id`. |
| App motorista | Garantir que usa **confirm_pickup** / **confirm_delivery** com `route_id` e `driver_id` corretos, ou que o insert em `checkins` preenche **freight_id** com o código completo. |

Se após corrigir o app as fotos ainda não aparecerem, vale checar as políticas RLS da tabela `checkins` (permitir SELECT para o papel que o dashboard usa).
