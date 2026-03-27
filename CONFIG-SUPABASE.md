# Configuração Supabase – Dashboard e App

Dashboard (Dash-Transporteja) e app motorista (JaAPP) **devem usar o mesmo projeto Supabase**: mesma URL e mesma chave anônima. Assim ambos acessam as mesmas tabelas (rotas, check-ins, motoristas, localizações).

---

## 1. Variáveis de ambiente

### Dashboard (Next.js)

Crie `.env.local` na raiz do projeto (copie de `.env.example`):

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anonima
```

- **Onde achar:** Supabase Dashboard → Project Settings → API → Project URL e `anon` public key.

### App motorista (JaAPP, Vite)

No projeto do app (ex.: `D:\Saas\JaAPP`), crie `.env` (ou use `.env.example` como base):

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anonima
```

**Use exatamente a mesma URL e a mesma chave anônima do dashboard.** Assim os dois sistemas leem e escrevem nas mesmas tabelas.

---

## 2. O que cada sistema usa no Supabase

| Recurso | Dashboard | App (JaAPP) |
|--------|-----------|-------------|
| **Auth** | Sim (login e-mail/senha, tabela `users`) | Não (login por placa + código via RPC) |
| **routes** | Leitura/escrita, Realtime | Leitura (por id/freight_id), RPCs para status |
| **checkins** | Leitura/escrita, Realtime | Inserção via RPCs `confirm_pickup`, `confirm_delivery` |
| **drivers** | Leitura/escrita | Leitura (por id), RPC `validate_driver_login` |
| **clients** | Leitura/escrita | — |
| **users** | Leitura/escrita (perfil, roles) | — |
| **location_updates** | Leitura (RPCs por freight_id), Realtime | Inserção via RPC `insert_location_update` |
| **RPCs** | `get_route_track`, `get_last_route_location` | `validate_driver_login`, `confirm_pickup`, `confirm_delivery`, `start_route_tracking`, `insert_location_update` |
| **Storage** | Avatares, fotos de check-in | Fotos de check-in (upload para URLs em checkins) |

---

## 3. Scripts SQL no Supabase (ordem sugerida)

Execute no **SQL Editor** do mesmo projeto Supabase, nesta ordem:

1. **Schema base**  
   `supabase/migrations/001_initial_schema.sql`  
   (ou o script que cria `users`, `drivers`, `clients`, `routes`, `checkins` e RLS básico.)

2. **Rastreio contínuo**  
   `supabase/rastreio-continuo-setup.sql`  
   Cria tabela `location_updates`, políticas RLS e funções `get_route_track`, etc.

3. **Rastreio público**  
   `supabase/rastreio-publico-setup.sql`  
   Políticas para anon ler rotas/check-ins/drivers (página de rastreio por link).

4. **Unificação app + dashboard**  
   `supabase/unificar-app-dashboard.sql`  
   Cria/atualiza RPCs: `validate_driver_login`, `confirm_pickup`, `confirm_delivery`, `start_route_tracking`, `insert_location_update`.

5. **Apertar RLS em location_updates**  
   `supabase/rls-location-updates-tighten.sql`  
   Remove leitura pública ampla; adiciona `get_last_route_location(p_freight_id)`.

(Opcionais: rate-limiting, LGPD, criptografia, storage – conforme sua stack.)

---

## 4. Conferir se está tudo conectado

- **Dashboard:** faça login; abra Rotas, Motoristas, Clientes, Check-ins. Tudo deve carregar sem erro de “Missing Supabase environment variables” ou “permission denied”.
- **App:** faça login com placa + código do frete; confirme que a rota aparece e que check-in e rastreio funcionam.
- **Rastreio público:** acesse `/rastreio/[freightId]` (com um `freight_id` válido) e confira se a página carrega e atualiza.

Se o dashboard e o app usam a mesma URL e a mesma anon key nesses arquivos de ambiente, estão conectados ao mesmo Supabase e compartilham as mesmas informações.
