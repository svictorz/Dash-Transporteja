/** Perfis com acesso ao dashboard web (motorista é app). */
export type DashboardUserRole = 'admin' | 'comercial' | 'driver'

export function dashboardRoleLabel(role: string | null | undefined): string {
  switch (role) {
    case 'admin':
      return 'Administrador'
    case 'comercial':
    case 'operator':
      return 'Comercial'
    case 'driver':
      return 'Motorista'
    default:
      return 'Usuário'
  }
}

