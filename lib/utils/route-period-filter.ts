import { parseDateFlexible } from '@/lib/utils/date-format'

/** Campos mínimos para aplicar o filtro operacional de período. */
export type RouteForPeriodFilter = {
  status: string
  pickup_date?: string | null
  estimated_delivery?: string | null
  created_at?: string | null
}

/**
 * Data operacional usada nos filtros de período.
 * Sempre usa pickup_date como referência principal.
 * Fallback para estimated_delivery se não houver pickup_date.
 */
export function getRouteOperationalDate(route: RouteForPeriodFilter): Date | null {
  const pickup = route.pickup_date?.trim() ? parseDateFlexible(route.pickup_date) : null
  const delivery = route.estimated_delivery?.trim() ? parseDateFlexible(route.estimated_delivery) : null
  return pickup ?? delivery
}

export function getRouteOperationalDateKind(_route: RouteForPeriodFilter): 'coleta' | 'entrega' {
  return 'coleta'
}

/**
 * Verifica se a data de entrega (estimated_delivery) está no intervalo.
 * Usado no filtro "Entregues" da Performance.
 */
export function isDeliveryInDateRange(
  route: RouteForPeriodFilter,
  start: Date | null,
  end: Date | null,
): boolean {
  if (route.status !== 'delivered') return false
  const d = route.estimated_delivery?.trim() ? parseDateFlexible(route.estimated_delivery) : null
  if (!d) return false
  if (start && d < start) return false
  if (end && d > end) return false
  return true
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
  'Filtrado pela data de coleta · "Entregues" usa a data de entrega'
