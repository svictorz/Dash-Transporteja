# Revisão do Projeto – Transporte Já (Dash-Transporteja)

Revisão feita com base em:
- **Vercel React Best Practices** (performance e padrões Next.js/React)
- **Web Interface Guidelines** (acessibilidade, formulários, foco, UX)
- Varredura de **segurança**, **estrutura** e **qualidade**

---

## Resumo executivo

| Área        | Crítico | Alto | Médio | Baixo |
|------------|--------|------|-------|--------|
| Segurança  | 0      | 1    | 4     | 4      |
| Performance| 0      | 0    | 3     | 2      |
| Qualidade  | 0      | 0    | 3     | 1      |
| UI/A11y    | 0      | 0    | 5+    | -      |

---

## 1. Pontos críticos e segurança

### 1.1 [ALTO] Proteção de rotas apenas no cliente

- **Onde:** `app/dashboard/layout.tsx` – checagem de sessão com `getSession()` e `onAuthStateChange`; redirecionamento para `/login` só após o JS rodar.
- **Risco:** Até a hidratação, o HTML do dashboard pode ser acessível; usuário pode ver “flash” de conteúdo ou contornar redirecionamento desabilitando JS.
- **Recomendação:** Criar `middleware.ts` na raiz que valide a sessão (cookie Supabase) e redirecione para `/login` antes de servir a página. Alternativa: usar `createServerClient` no layout (Server Component) e checar sessão no servidor.

### 1.2 [MÉDIO] createServerClient não utilizado

- **Onde:** `lib/supabase/server.ts` exporta `createServerClient()` (cookies), mas nenhum arquivo do app usa.
- **Recomendação:** Usar no layout do dashboard (ou em Server Components) para validar sessão no servidor e evitar depender só do cliente.

### 1.3 [MÉDIO] Login sem validação de formato de e-mail

- **Onde:** `app/login/page.tsx` – só verifica “preencha todos os campos”; não valida formato do e-mail no cliente.
- **Recomendação:** Usar `lib/utils/validation.ts` (ex.: função de e-mail) ou regex/validação simples antes de chamar `signInWithPassword`.

### 1.4 [MÉDIO] Políticas RLS – rastreio e check-ins

- **Rastreio:** Em `rastreio-continuo-setup.sql`, política em `location_updates` com `USING (true)` para anon/authenticated – leitura ampla de localização.
- **Check-ins:** Em `001_initial_schema.sql`, qualquer usuário autenticado pode inserir check-ins.
- **Recomendação:** Revisar se a leitura pública de localizações é necessária; restringir por `freight_id` ou token; garantir que apenas motoristas/rotas corretos possam criar check-ins (por RLS ou validação server-side).

### 1.5 Variáveis de ambiente e localStorage

- **Env:** Uso correto de `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`; service role só em script (`create-admin-user.mjs`), não no bundle. **OK** desde que `.env.local` não seja commitado.
- **localStorage:** Nenhum token/senha armazenado; apenas preferências e consentimento. **OK**.

### 1.6 XSS

- Nenhum `dangerouslySetInnerHTML` ou `innerHTML` encontrado. **OK**.

---

## 2. Performance e padrões Next/React (Vercel Best Practices)

### 2.1 [MÉDIO] Waterfall de requests no rastreio

- **Onde:** `app/rastreio/[freightId]/page.tsx` – fetches em sequência: rotas → motoristas → check-ins → `getRouteTrack()`.
- **Recomendação:** Paralelizar com `Promise.all()` onde as operações forem independentes; ou mover parte do fetch para Server Component / server action.

### 2.2 [MÉDIO] Falta de loading por rota

- **Onde:** Nenhum `loading.tsx` em `app/` ou `app/dashboard/`.
- **Recomendação:** Adicionar `loading.tsx` nas rotas principais (ex.: `app/dashboard/loading.tsx`, `app/rastreio/[freightId]/loading.tsx`) e, onde fizer sentido, usar `<Suspense>` para streaming.

### 2.3 [MÉDIO] Data fetching quase todo no cliente

- **Onde:** Dashboard e demais páginas usam `'use client'` e carregam dados em `useEffect` com Supabase.
- **Recomendação:** Avaliar uso de Server Components para listagens iniciais (ex.: dashboard, rotas) e `createServerClient` para dados que dependem de auth, reduzindo tempo até primeiro conteúdo útil.

### 2.4 Boas práticas já presentes

- Sem barrel imports problemáticos; imports diretos por arquivo.
- `TOKEN_REFRESHED` ignorado no auth para evitar re-renders desnecessários.
- Uso de `useRef` para evitar duplo redirect no login.

---

## 3. Qualidade e manutenção

### 3.1 [MÉDIO] Error boundaries

- **Onde:** Não há `error.tsx` nem `global-error.tsx` em `app/`.
- **Recomendação:** Adicionar `app/error.tsx` e `app/global-error.tsx` para fallback de UI em erros não tratados.

### 3.2 [MÉDIO] Uso de `any`

- **Onde:** Vários `catch (err: any)`, `user: any`, `subscription: any`, `icon: any`, `animationData: any`, etc. em login, dashboard, hooks, serviços e componentes.
- **Recomendação:** Usar `unknown` em catch e type guards; tipar props (ex.: `LucideIcon` para ícones); reduzir `any` em relatórios e eventos.

### 3.3 [MÉDIO] Duplicação da lógica de auth

- **Onde:** `app/login/page.tsx` e `app/dashboard/layout.tsx` repetem padrão de `getSession()` + `onAuthStateChange` + redirect.
- **Recomendação:** Extrair para um hook (ex.: `useAuthRedirect`) ou helper compartilhado.

### 3.4 Página de teste

- **Onde:** ~~`app/test-supabase/page.tsx`~~ **Removida** – página de teste excluída do projeto.
- **Recomendação:** Remover em produção ou proteger por variável de ambiente (ex.: só em desenvolvimento).

---

## 4. UI, acessibilidade e formulários (Web Interface Guidelines)

### 4.1 Acessibilidade

- **Botões só com ícone:** Vários botões (sidebar: Configurações, Dados Pessoais, Sair; topbar: menu, busca, refresh, configurações) não têm `aria-label`. Quando o texto some (sidebar recolhida), o botão fica só com ícone.
  - **Arquivos:** `SidebarTransporteja.tsx`, `TopBarTransporteja.tsx`.
- **Imagens:** Logo com `alt="Transporte Já"` / `alt="Transporte Já - Sistema de Rastreio"` – OK. Verificar ícones decorativos com `aria-hidden="true"` onde aplicável.
- **Navegação por teclado:** Garantir que todos os botões/links aceitem foco e que não haja `outline: none` sem substituto visível (ex.: `focus-visible:ring-*`).

### 4.2 Formulários

- **Login:** Campos de e-mail e senha têm `label` + `id`; falta `autocomplete` (ex.: `autocomplete="email"` e `autocomplete="current-password"`) e `name` para melhor comportamento de gerenciadores de senha.
- **Placeholders:** Preferir terminar com "…" e padrão de exemplo onde fizer sentido.
- **Erros:** Mensagens de erro no login estão presentes; ideal manter erro inline próximo do campo e, no submit, focar o primeiro campo com erro.

### 4.3 Foco

- **Regra:** Não usar `outline-none` sem substituto. Na maioria dos inputs há `focus:ring-*` ou `focus:ring-2` – OK. Em botões, garantir sempre anel de foco visível (ex.: `focus-visible:ring-2`).

### 4.4 Conteúdo e animação

- **Redução de movimento:** Onde houver animações (FadeIn, motion), considerar `prefers-reduced-motion` (variante reduzida ou desativar).
- **Transições:** Evitar `transition: all`; listar propriedades explicitamente (ex.: `transition-colors`, `transition-transform`).

### 4.5 Navegação

- **Links:** Onde a ação for navegação, usar `<Link>` em vez de `<button onClick={router.push}>` para suportar Cmd/Ctrl+click e middle-click. Sidebar usa `button` + `handleNavigation` – considerar `<Link>` para itens de menu.

---

## 5. Checklist de ações sugeridas

### Prioridade alta
- [ ] Implementar **middleware** de auth (validar sessão Supabase e redirecionar para `/login` nas rotas protegidas).
- [ ] Usar **createServerClient** no layout do dashboard (ou em Server Components) para checagem de sessão no servidor.

### Prioridade média
- [ ] Validação de **e-mail no login** (formato) no cliente.
- [ ] Revisar políticas RLS de **location_updates** e **check-ins** (quem pode ler/escrever).
- [ ] Paralelizar fetches em **rastreio/[freightId]** (ex.: `Promise.all`).
- [ ] Adicionar **loading.tsx** nas rotas principais.
- [ ] Adicionar **error.tsx** e **global-error.tsx**.
- [ ] **aria-label** em botões só-ícone (sidebar e topbar).
- [ ] **autocomplete** e **name** nos campos do formulário de login.

### Prioridade baixa
- [ ] Reduzir **any** (tipos mais específicos, `unknown` em catch).
- [ ] Extrair lógica de auth para **hook/helper** compartilhado.
- [ ] **prefers-reduced-motion** em animações.
- [ ] Substituir `button` + `router.push` por **Link** nos itens de menu da sidebar.
- [x] ~~Remover ou proteger **test-supabase** em produção.~~ **Feito** – página removida.

---

## 6. Skills utilizadas nesta revisão

| Skill | Uso |
|-------|-----|
| **vercel-react-best-practices** | Performance, data fetching, bundle, re-renders, padrões Next/React. |
| **web-design-guidelines** | Acessibilidade, formulários, foco, conteúdo, animação, anti-padrões. |
| **find-skills** | Referência para buscar skills adicionais em [skills.sh](https://skills.sh/) (ex.: testes, segurança). |

Para instalar outras skills (ex.: testes E2E, segurança):

```bash
npx add-skill <owner/repo> --skill <skill-name>
```

---

*Documento gerado com base na varredura do repositório e nas guidelines Vercel/Web Interface. Recomenda-se revisar e priorizar os itens conforme o roadmap do produto.*
