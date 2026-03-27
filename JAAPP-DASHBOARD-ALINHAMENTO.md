# Alinhamento JaAPP (app motorista) e Dashboard

**Unificação:** App e dashboard passaram a usar **as mesmas tabelas** (`routes`, `checkins`, `drivers`, `location_updates`). O app grava nelas via RPCs; o dashboard já lê com Realtime.

---

## 0. Como ficou a unificação

- **Login do motorista:** RPC `validate_driver_login(placa, código)` lê em **routes** + **drivers** (código = `freight_id`).
- **Coleta (pickup):** RPC `confirm_pickup` insere em **checkins** e atualiza **routes** (status `pickedUp`).
- **Entrega (delivery):** RPC `confirm_delivery` insere em **checkins** e atualiza **routes** (status `delivered`).
- **Rastreio contínuo:** RPC `start_route_tracking` atualiza **routes** para `inTransit`; RPC `insert_location_update` insere em **location_updates**.
- **Fotos:** continuam no bucket `transport-photos`; as URLs são salvas em **checkins** (photo_url).

**No Supabase (dashboard):**
1. Rodar `supabase/rastreio-continuo-setup.sql` se ainda não tiver a tabela **location_updates**.
2. Rodar `supabase/unificar-app-dashboard.sql` (cria os RPCs acima).

---

## 1. Estrutura do JaAPP (app motorista)

- **Stack:** React + Vite + Capacitor (mobile), Supabase.
- **Local:** `D:\Saas\JaAPP`

### 1.1 Tabelas e RPCs usados pelo app (mesmas do dashboard)

| Recurso | Uso no app |
|--------|-------------|
| **routes** | Lido pelo RPC `validate_driver_login`; status atualizado por `confirm_pickup`, `confirm_delivery`, `start_route_tracking`. |
| **checkins** | Inserção via `confirm_pickup` e `confirm_delivery` (foto + coords). |
| **location_updates** | Inserção via `insert_location_update`; Realtime para tela de rastreio. |
| **Storage** | Bucket `transport-photos` para fotos (URLs vão em checkins.photo_url). |

### 1.2 Arquivos relevantes no JaAPP

- `src/services/supabase.ts` – cliente e tipos (`TransportData` com `route_id`, `driver_id`, `freight_id`).
- `src/services/auth.service.ts` – RPC `validate_driver_login`; `getTransportDetails` lê de **routes**.
- `src/services/tracking.service.ts` – Realtime em **location_updates**; leitura de **routes** (por freight_id) e **location_updates**.
- `src/services/location.service.ts` – RPCs `start_route_tracking` e `insert_location_update`.
- `src/pages/PickupPage.tsx` – RPC `confirm_pickup`.
- `src/pages/DeliveryPage.tsx` – RPC `confirm_delivery`.

---

## 2. Estrutura do Dashboard (Dash-Transporteja)

- **Stack:** Next.js 14, Supabase.
- **Local:** `D:\Saas\Dash-Transporteja`

### 2.1 Tabelas usadas pelo dashboard

| Tabela | Uso |
|--------|-----|
| **routes** | Listagem de rotas/fretes, status (`pending`, `inTransit`, `pickedUp`, `delivered`, `cancelled`), vínculo com motorista e cliente. |
| **checkins** | Listagem de check-ins (pickup/delivery), fotos, coordenadas, estatísticas (hoje/semana/mês). |
| **drivers** | Cadastro e listagem de motoristas. |
| **clients** | Cadastro e listagem de clientes. |
| **users** | Autenticação e perfis (admin/operator/driver). |

### 2.2 Schema do dashboard

- **routes:** `id`, `freight_id`, `driver_id`, `origin`, `destination`, `status`, `vehicle`, `plate`, etc.
- **checkins:** `id`, `type` (pickup/delivery), `timestamp`, `photo_url`, `coords_lat/lng`, `freight_id`, `driver_id`, `route_id`, etc.

---

## 3. Diferença de schemas (app vs dashboard)

| Conceito | No JaAPP (app motorista) | No Dashboard |
|----------|---------------------------|--------------|
| Frete/viagem | **transports** (id, code, status) | **routes** (id, freight_id, status) |
| Localização contínua | **locations** (transport_id, lat, lng, recorded_at) | Não existe tabela equivalente; dashboard usa **checkins** com coords |
| Check-in (foto + lugar) | Atualização em **transports** (foto + status) + opcionalmente pode haver registro em outra tabela | **checkins** (type, photo_url, coords, freight_id, driver_id) |

Ou seja: o app hoje escreve em **transports** e **locations**; o dashboard lê **routes** e **checkins**. Para o dashboard refletir em tempo real o que o app faz, é necessário **uma das** opções abaixo.

---

## 4. Como manter o dashboard atualizado em tempo real

### 4.1 Se o mesmo Supabase tiver as duas bases (transports + routes)

- **Opção A – App também escreve em routes/checkins**  
  - No JaAPP, além de atualizar `transports` e inserir em `locations`, passar a atualizar **routes** (status) e inserir **checkins** (pickup/delivery com foto e coords).  
  - No dashboard, foi adicionado **Supabase Realtime** nas tabelas **routes** e **checkins**. Assim, sempre que houver INSERT/UPDATE/DELETE nessas tabelas (pelo app ou pelo próprio dashboard), a lista e as estatísticas atualizam sozinhas.

- **Opção B – Sincronizar transports → routes no backend**  
  - Criar no Supabase triggers/funções (ou Edge Functions) que, ao atualizar `transports`, repliquem status (e dados necessários) em **routes** (por exemplo, mapeando `transport.id` ou `transport.code` a `route.freight_id` ou `route.id`).  
  - Se também houver “check-in” no app que deva virar linha em **checkins**, replicar isso no trigger/function.  
  - O dashboard continua usando apenas **routes** e **checkins** com Realtime, já implementado.

### 4.2 Se o app e o dashboard usarem apenas routes + checkins

- Garantir que o **JaAPP** passe a escrever em **routes** e **checkins** (em vez de ou além de transports/locations), com o mesmo formato que o dashboard espera.  
- O Realtime do dashboard em **routes** e **checkins** já deixa a tela atualizada em tempo real.

### 4.3 O que já foi feito no dashboard (tempo real)

O dashboard está com **Realtime em todas as listagens**:

| Recurso | Onde | Tabela |
|--------|------|--------|
| Rotas | Hook `useRoutes` | **routes** |
| Check-ins (home) | Página Dashboard | **checkins** |
| Motoristas | Hook `useDrivers` | **drivers** |
| Clientes | Hook `useClients` | **clients** |
| Check-ins (página) | Página Check-ins | **checkins** |
| Histórico | Página Histórico | **checkins** |
| Check-ins do frete | Página Rotas (modal) | **checkins** |

Qualquer INSERT/UPDATE/DELETE nessas tabelas atualiza a tela na hora, sem recarregar.

**Ativar Realtime no Supabase:** No painel do Supabase, em **Database → Replication**, habilite a publicação em tempo real para **routes**, **checkins**, **drivers** e **clients** (se ainda não estiverem na lista de “Realtime”). Se o app continuar só em **transports/locations**, é necessário o mapeamento/sync descrito acima (Opção B ou migração do app para routes/checkins).

---

## 5. Resumo

- **JaAPP:** usa **transports**, **locations**, Realtime em `locations`, bucket `transport-photos`.  
- **Dashboard:** usa **routes**, **checkins**, **drivers**, **clients**, **users**; Realtime em **routes**, **checkins**, **drivers** e **clients** em todas as telas que listam esses dados.  
- Para o dashboard acompanhar o app em tempo real, é preciso que as ações do app (status de frete, check-ins, etc.) estejam refletidas nas tabelas **routes** e **checkins** (por escrita direta do app ou por sync/trigger a partir de **transports/locations**).  
- A estrutura do JaAPP foi verificada em `D:\Saas\JaAPP`; o dashboard foi preparado para tempo real nas tabelas que ele já utiliza.
