# Melhorias – Dashboard Transporte Já

Documento de **segurança**, **design**, **limpeza de código** e **desempenho**, mantendo todas as funcionalidades.

---

## Já implementado nesta rodada

| Melhoria | Onde | Benefício |
|---------|------|-----------|
| **Validação de e-mail no login** | `app/login/page.tsx` | Evita envio de formato inválido; usa `validateEmail` de `lib/utils/validation`. |
| **Formulário de login (UX/a11y)** | `app/login/page.tsx` | `autocomplete`, `name`, placeholder e `aria-label` no botão de mostrar senha; "Entrando…" com reticências. |
| **Loading por rota** | `app/loading.tsx`, `app/dashboard/loading.tsx` | Evita tela em branco; usuário vê "Carregando…" ao entrar no dashboard. |
| **Error boundaries** | `app/error.tsx`, `app/global-error.tsx` | Erros não tratados mostram fallback com "Tentar novamente" em vez de tela quebrada. |
| **Middleware de auth** | `middleware.ts`, `lib/supabase/proxy.ts` | Protege `/dashboard` no servidor; redireciona para `/login` sem sessão; usa `@supabase/ssr` e cookies. |
| **Página de teste removida** | ~~`app/test-supabase/page.tsx`~~ | Excluída; não expõe informações em produção. |
| **Acessibilidade** | Sidebar, TopBar, FadeIn | `aria-label` em botões só-ícone; `Link` no menu; `prefers-reduced-motion` nas animações. |
| **Hook useAuthState** | `lib/hooks/useAuthState.ts` | Login e layout do dashboard usam o mesmo hook; menos duplicação. |
| **Tipos** | Vários arquivos | `any` → `unknown` em catches; `UserInfo` na TopBar; `LucideIcon` no menu. |
| **Performance rastreio** | `app/rastreio/[freightId]/page.tsx` | Fetches em paralelo com `Promise.all` (rota + motorista + check-ins + trajeto). |

---

## Segurança

### Feito
- Validação de e-mail no login.
- Nenhum token/senha em localStorage (apenas preferências).
- Sem `dangerouslySetInnerHTML` (sem risco de XSS direto no código atual).
- **RLS em `location_updates`:** removida política "Public can read location updates for tracking" (`USING (true)`). Rastreio público usa apenas RPCs `get_route_track(p_freight_id)` e `get_last_route_location(p_freight_id)` — ver `supabase/rls-location-updates-tighten.sql`.

### Recomendado (próximos passos)

1. **Proteção de rotas no servidor**
   - Hoje a checagem de sessão é só no cliente (`app/dashboard/layout.tsx`). Até a hidratação, o HTML do dashboard pode ser acessível.
   - **Sugestão:** usar **middleware** para redirecionar `/dashboard` → `/login` quando não houver sessão. Isso exige sessão em **cookies** (ex.: `@supabase/ssr` com `createServerClient` no middleware). Hoje a sessão está em **localStorage**; migrar para cookies + middleware aumenta a segurança sem remover funcionalidades.

2. **RLS em routes / checkins / drivers**
   - Em `rastreio-publico-setup.sql`, as políticas "Public can read routes/checkins/drivers" usam `USING (true)` — anon pode ler todas as linhas. Para apertar: fazer a página de rastreio público usar apenas a RPC `get_tracking_data(p_freight_id)` e depois remover essas três políticas anon.

3. **Página de teste**
   - ~~`app/test-supabase/page.tsx`~~ **Removida** — não existe mais no projeto.

---

## Design e UX

### Feito
- Loading states nas rotas principais.
- Formulário de login com labels, autocomplete e acessibilidade básica.

### Recomendado

1. **Acessibilidade (Web Guidelines)**
   - Botões só com ícone (sidebar, topbar): adicionar `aria-label`.
   - Garantir que todos os interativos tenham foco visível (`focus-visible:ring-*`); já há em vários inputs.
   - Onde houver listas longas (>50 itens), considerar virtualização ou `content-visibility`.

2. **Animações**
   - Respeitar `prefers-reduced-motion`: variante reduzida ou desativar animações quando o usuário preferir.

3. **Navegação**
   - Trocar `button` + `router.push` por `<Link>` nos itens de menu da sidebar (melhor para Cmd+click e middle-click).

---

## Limpeza de código

### Recomendado (sem quebrar funcionalidade)

1. **Tipos em vez de `any`**
   - `catch (err: any)` → `catch (err: unknown)` e usar type guard ou `err instanceof Error`.
   - Props de ícone: tipar com `LucideIcon` onde fizer sentido.
   - Estado de usuário: criar tipo `User` em vez de `user: any`.

2. **Duplicação de lógica de auth**
   - `app/login/page.tsx` e `app/dashboard/layout.tsx` repetem padrão de `getSession()` + `onAuthStateChange` + redirect.
   - Extrair para um hook `useAuthRedirect()` ou helper compartilhado.

3. **Console**
   - Reduzir ou remover `console.log`/`console.warn` em produção; manter só `console.error` onde for útil para suporte.

4. **Páginas muito grandes**
   - `app/dashboard/rotas/page.tsx`: quebrar em subcomponentes (lista, modal de criação, modal de edição, detalhe do frete) para facilitar manutenção e testes.

---

## Desempenho

### Já em uso
- Realtime por tabela (evita polling).
- Imports diretos (sem barrel problemático).
- `TOKEN_REFRESHED` ignorado para evitar re-renders desnecessários.

### Recomendado

1. **Waterfalls**
   - `app/rastreio/[freightId]/page.tsx`: fetches em sequência; onde forem independentes, usar `Promise.all()`.

2. **Componentes pesados**
   - Páginas ou modais muito grandes: usar `next/dynamic` com `loading` para code-splitting (ex.: modal de rotas).

3. **Listas longas**
   - Se listas (rotas, check-ins, histórico) passarem de dezenas de itens, considerar virtualização (ex.: `@tanstack/react-virtual`) ou paginação no backend.

4. **Imagens**
   - Usar `next/image` onde houver imagens (fotos de check-in, logos) para otimização e dimensões explícitas (evita CLS).

---

## Checklist resumido

| Área | Ação | Prioridade |
|------|------|------------|
| Segurança | Middleware + sessão em cookies (@supabase/ssr) | Alta |
| Segurança | Revisar RLS de location_updates | Média |
| Segurança | Remover ou proteger test-supabase em produção | Média |
| Design | aria-label em botões só-ícone | Média |
| Design | prefers-reduced-motion em animações | Baixa |
| Código | Trocar `any` por tipos/unknown em catches | Média |
| Código | Hook useAuthRedirect para evitar duplicação | Baixa |
| Código | Quebrar página de rotas em componentes menores | Baixa |
| Performance | Promise.all no rastreio [freightId] | Média |
| Performance | next/dynamic em modais pesados | Baixa |
| Performance | next/image em fotos/check-ins | Baixa |

Todas as funcionalidades atuais do dashboard foram preservadas; as sugestões são incrementais e podem ser aplicadas aos poucos.
