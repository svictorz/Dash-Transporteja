/** Perfis com acesso ao dashboard web (motorista é app). */
export type DashboardUserRole = 'admin' | 'comercial' | 'financeiro' | 'fiscal' | 'supervisor' | 'driver'

/** Perfis que podem operar o dashboard (excluindo motorista). */
export const PANEL_ROLES = ['admin', 'comercial', 'financeiro', 'fiscal', 'supervisor'] as const
export type PanelRole = typeof PANEL_ROLES[number]

/** E-mails com poderes totais de gerenciamento de permissões. */
export const SUPER_ADMIN_EMAILS = [
  'transporteja00@gmail.com',
  'jcnlogtransportes@gmail.com',
  'joaovictorpaiva89@gmail.com',
] as const

/** @deprecated Use SUPER_ADMIN_EMAILS. Mantido por compatibilidade. */
export const SUPER_ADMIN_EMAIL = SUPER_ADMIN_EMAILS[0]

export function dashboardRoleLabel(role: string | null | undefined): string {
  switch (role) {
    case 'admin':
      return 'Administrador'
    case 'financeiro':
      return 'Financeiro'
    case 'fiscal':
      return 'Fiscal'
    case 'supervisor':
      return 'Supervisor'
    case 'comercial':
    case 'operator':
      return 'Comercial'
    case 'driver':
      return 'Motorista'
    default:
      return 'Usuário'
  }
}

/** Vê dados de todos os comerciais na Performance. */
export function isGlobalPerformanceViewer(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'financeiro' || role === 'fiscal' || role === 'supervisor'
}

/** Pode editar dados operacionais/financeiros dentro da Performance. */
export function canEditPerformance(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'financeiro' || role === 'fiscal'
}

/** @deprecated Use isGlobalPerformanceViewer or canEditPerformance for new checks. */
export function isAdminOrFinanceiro(role: string | null | undefined): boolean {
  return canEditPerformance(role)
}

export function canViewRouteInRoutesPage(
  _role: string | null | undefined,
  currentUserId: string | null | undefined,
  routeOwnerId: string | null | undefined,
): boolean {
  return Boolean(currentUserId && routeOwnerId && currentUserId === routeOwnerId)
}

export function isComercial(role: string | null | undefined): boolean {
  return role === 'comercial' || role === 'operator'
}

/**
 * Perfis cujo acesso a dados operacionais (fretes, clientes, compromissos)
 * é limitado aos próprios registros.
 *
 * Espelha `public.is_owner_scoped_writer()` (migration 044). Ao mudar um,
 * mude o outro — quem manda é o RLS; isto aqui só evita oferecer na tela
 * uma ação que o banco vai recusar.
 */
export function shouldScopeOperationalDataToOwner(role: string | null | undefined): boolean {
  return isComercial(role) || role === 'supervisor'
}

/**
 * Espelha a policy "Clients - insert isolated" (migration 044):
 * fiscal enxerga clientes mas não cria.
 */
export function canCreateClients(role: string | null | undefined): boolean {
  return (
    role === 'admin' ||
    role === 'financeiro' ||
    role === 'supervisor' ||
    isComercial(role)
  )
}

/** Perfis exibidos como responsáveis no filtro de vendedores da Performance. */
export function isPerformanceSellerRole(role: string | null | undefined): boolean {
  return role === 'comercial' || role === 'operator' || role === 'admin' || role === 'supervisor'
}

const SUPERVISOR_ALLOWED_PANEL_PATHS = [
  '/inicio',
  '/clientes',
  '/rotas',
  '/propostas',
  '/calendario',
  '/performance',
  '/configuracoes',
  '/dados-pessoais',
] as const

export function canSupervisorAccessPanelPath(pathname: string | null): boolean {
  if (!pathname) return false
  return SUPERVISOR_ALLOWED_PANEL_PATHS.some(
    (route) => pathname === route || pathname.startsWith(route + '/'),
  )
}

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const normalized = email.trim().toLowerCase()
  return SUPER_ADMIN_EMAILS.includes(normalized as (typeof SUPER_ADMIN_EMAILS)[number])
}
