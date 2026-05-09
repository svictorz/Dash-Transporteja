/**
 * Rotas do painel (CRM). Todas vivem dentro do route group `app/(painel)/`,
 * que não aparece na URL. Mantido como fonte única de verdade para o
 * middleware (auth + redirects 301) e qualquer outra checagem server-side.
 */
export const PAINEL_ROUTES = [
  '/inicio',
  '/rotas',
  '/clientes',
  '/calendario',
  '/performance',
  '/propostas',
  '/relatorios',
  '/usuarios',
  '/configuracoes',
  '/cotacao',
  '/motoristas',
  '/dados-pessoais',
  '/bem-vindo',
] as const

export type PainelRoute = (typeof PAINEL_ROUTES)[number]

/**
 * Retorna true se o pathname pertence ao painel (rota exata ou descendente).
 */
export function isPainelPath(pathname: string): boolean {
  return PAINEL_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  )
}

/**
 * Converte uma URL legada `/dashboard/...` para o novo formato `/...`.
 * Retorna `null` se o pathname não pertence ao prefixo legado.
 */
export function legacyDashboardRewrite(pathname: string): string | null {
  if (pathname === '/dashboard' || pathname === '/dashboard/') {
    return '/inicio'
  }
  if (pathname.startsWith('/dashboard/')) {
    return '/' + pathname.slice('/dashboard/'.length)
  }
  return null
}
