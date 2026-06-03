import { parseDateFlexible } from '@/lib/utils/date-format'

/** Campos mínimos para aplicar o filtro operacional de período. */
export type RouteForPeriodFilter = {
  status: string
  pickup_date?: string | null
  estimated_delivery?: string | null
  created_at?: string | null
}

/**
 * Data operacional usada nos filtros de dashboard e performance.
 *
 * - **Entregue** → `estimated_delivery` (quando o frete foi concluído no mês)
 * - **Coletado / em trânsito / pendente** → `pickup_date` (quando a coleta ocorreu)
 * - Fallback → `created_at` apenas se não houver datas operacionais
 */
export function getRouteOperationalDate(route: RouteForPeriodFilter): Date | null {
  const pickup = route.pickup_date?.trim() ? parseDateFlexible(route.pickup_date) : null
  const delivery = route.estimated_delivery?.trim() ? parseDateFlexible(route.estimated_delivery) : null

  if (route.status === 'delivered') {
    return delivery ?? pickup
  }

  return pickup ?? delivery
}

export function getRouteOperationalDateKind(route: RouteForPeriodFilter): 'coleta' | 'entrega' {
  return route.status === 'delivered' ? 'entrega' : 'coleta'
}

export function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function endOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

export function isRouteInDateRange(
  route: RouteForPeriodFilter,
  start: Date | null,
  end: Date | null,
): boolean {
  const d = getRouteOperationalDate(route)
  if (!d) return false
  if (start && d < start) return false
  if (end && d > end) return false
  return true
}

export function filterRoutesByDateRange<T extends RouteForPeriodFilter>(
  routes: T[],
  start: Date | null,
  end: Date | null,
): T[] {
  if (!start && !end) return routes
  return routes.filter((route) => isRouteInDateRange(route, start, end))
}

/** Texto curto para exibir junto ao seletor de período. */
export const ROUTE_PERIOD_FILTER_HINT =
  'Coletas pelo mês da data de coleta · entregues pelo mês da data de entrega'
