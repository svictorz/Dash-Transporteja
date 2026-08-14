/** Perfis com acesso ao dashboard web (motorista é app). */
export type DashboardUserRole = 'admin' | 'comercial' | 'financeiro' | 'driver'

/** Perfis que podem operar o dashboard (excluindo motorista). */
export const PANEL_ROLES = ['admin', 'comercial', 'financeiro'] as const
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
    case 'comercial':
    case 'operator':
      return 'Comercial'
    case 'driver':
      return 'Motorista'
    default:
      return 'Usuário'
  }
}

/** Vê dados de todos os comerciais (admin e financeiro têm o mesmo escopo de visão). */
export function isAdminOrFinanceiro(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'financeiro'
}

export function isComercial(role: string | null | undefined): boolean {
  return role === 'comercial' || role === 'operator'
}

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const normalized = email.trim().toLowerCase()
  return SUPER_ADMIN_EMAILS.includes(normalized as (typeof SUPER_ADMIN_EMAILS)[number])
}
