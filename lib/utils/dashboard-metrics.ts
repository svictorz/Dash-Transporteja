import type { Route } from '@/lib/services/routes'
import { filterRoutesByDateRange, getRouteOperationalDate, startOfDay, endOfDay } from './route-period-filter'
import { getRouteCommissionValue, getRouteDriverTotalValue, getRouteNetFreightValue, getRouteTaxesValue, getRouteSeguroValue } from './freight-financials'

export type DashboardPeriod = '7d' | '15d' | 'month' | 'lastMonth' | 'all' | 'custom'
export type DashboardCustomRange = { start: string; end: string }
export const DASHBOARD_PERIODS: { value: DashboardPeriod; label: string }[] = [
  { value: '7d', label: '7 dias' }, { value: '15d', label: '15 dias' },
  { value: 'month', label: 'Este mês' }, { value: 'lastMonth', label: 'Mês passado' },
  { value: 'all', label: 'Todo o período' }, { value: 'custom', label: 'Personalizado' },
]

function parseInputDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null
}

export function dashboardPeriodRange(period: DashboardPeriod, now: Date, customRange?: DashboardCustomRange) {
  if (period === 'all') return { start: null, end: null, prevStart: null, prevEnd: null }
  let start = startOfDay(now)
  let end = endOfDay(now)
  let prevStart: Date
  if (period === 'custom') {
    const from = customRange && parseInputDate(customRange.start)
    const to = customRange && parseInputDate(customRange.end)
    if (!from || !to || from > to) throw new Error('Informe um intervalo válido: a data inicial deve ser anterior ou igual à final.')
    start = from
    end = endOfDay(to)
    const days = Math.round((Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()) - Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())) / 86400000) + 1
    prevStart = new Date(start)
    prevStart.setDate(prevStart.getDate() - days)
  } else if (period === 'month' || period === 'lastMonth') {
    const offset = period === 'lastMonth' ? -1 : 0
    start = new Date(now.getFullYear(), now.getMonth() + offset, 1)
    end = endOfDay(new Date(now.getFullYear(), now.getMonth() + offset + 1, 0))
    prevStart = new Date(now.getFullYear(), now.getMonth() + offset - 1, 1)
  } else {
    const days = period === '7d' ? 7 : 15
    start.setDate(start.getDate() - days + 1)
    prevStart = new Date(start)
    prevStart.setDate(prevStart.getDate() - days)
  }
  return { start, end, prevStart, prevEnd: new Date(start.getTime() - 1) }
}

const finite = (value: number | null | undefined) => Number.isFinite(Number(value)) ? Number(value) : 0
export const dashboardFreightValue = (route: Route) => finite(route.freight_value ?? route.nf_value)
export const dashboardMonthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
const dayKey = (date: Date) => `${dashboardMonthKey(date).slice(0, 7)}-${String(date.getDate()).padStart(2, '0')}`
const getRouteActivityDate = (route: Route) => {
  const created = route.created_at ? new Date(route.created_at) : null
  return created && Number.isFinite(created.getTime()) ? created : getRouteOperationalDate(route)
}

export function summarizeDashboardRoutes(routes: Route[], rate?: number | null) {
  const total = routes.reduce((sum, route) => ({
    freight: sum.freight + dashboardFreightValue(route),
    commissions: sum.commissions + finite(getRouteCommissionValue(route, rate)),
    drivers: sum.drivers + finite(getRouteDriverTotalValue(route)),
    taxes: sum.taxes + finite(getRouteTaxesValue(route)),
    net: sum.net + finite(getRouteNetFreightValue(route)),
    insurance: sum.insurance + finite(getRouteSeguroValue(route)),
  }), { freight: 0, commissions: 0, drivers: 0, taxes: 0, net: 0, insurance: 0 })
  return { ...total, count: routes.length, ticket: routes.length ? total.freight / routes.length : 0 }
}

export function dashboardVariation(current: number, previous: number): number | null {
  return previous === 0 ? current === 0 ? 0 : null : (current - previous) / Math.abs(previous) * 100
}

export function monthlyGoalProgress(revenue: number, goal: number | null) {
  const validGoal = goal != null && Number.isFinite(goal) && goal > 0 ? goal : null
  const percentage = validGoal ? revenue / validGoal * 100 : null
  return {
    percentage,
    gauge: Math.min(100, Math.max(0, percentage ?? 0)),
    remaining: validGoal ? Math.max(0, validGoal - revenue) : null,
  }
}

export type DashboardPoint = { key: string; date: Date; value: number; count: number }

export function buildDashboardMetrics(routes: Route[], userId: string | null, period: DashboardPeriod, now: Date, rate?: number | null, customRange?: DashboardCustomRange) {
  // A visão pessoal não se amplia com o cargo ou com as permissões da Performance.
  const owned = userId ? routes.filter(route => route.created_by_user_id === userId) : []
  const range = dashboardPeriodRange(period, now, customRange)
  const current = filterRoutesByDateRange(owned, range.start, range.end)
  const previous = period === 'all' ? [] : filterRoutesByDateRange(owned, range.prevStart, range.prevEnd)
  const monthRange = dashboardPeriodRange('month', now)
  const monthlyTotals = summarizeDashboardRoutes(filterRoutesByDateRange(owned, monthRange.start, monthRange.end), rate)
  const monthlyRevenue = monthlyTotals.freight
  const monthlyNet = monthlyTotals.net

  // A atividade acompanha o filtro do Dashboard, mas mede cadastros: created_at,
  // com fallback para a data operacional em registros antigos.
  const activityMonthly = period === 'all' || (period === 'custom' && range.start !== null && range.end !== null && range.end.getTime() - range.start.getTime() >= 60 * 86400000)
  const activityDates = owned.map(getRouteActivityDate).filter((date): date is Date => date !== null)
  const earliestActivity = activityDates.length ? new Date(Math.min(...activityDates.map(date => date.getTime()))) : startOfDay(now)
  const latestActivity = activityDates.length ? new Date(Math.max(...activityDates.map(date => date.getTime()))) : endOfDay(now)
  const activityStart = range.start ?? startOfDay(earliestActivity)
  const activityEnd = range.end
    ? period === 'month' ? new Date(Math.min(range.end.getTime(), endOfDay(now).getTime())) : range.end
    : endOfDay(latestActivity)
  const activityCursor = activityMonthly ? new Date(activityStart.getFullYear(), activityStart.getMonth(), 1) : startOfDay(activityStart)
  const activity: DashboardPoint[] = []
  while (activityCursor <= activityEnd) {
    activity.push({ key: activityMonthly ? dashboardMonthKey(activityCursor) : dayKey(activityCursor), date: new Date(activityCursor), value: 0, count: 0 })
    if (activityMonthly) activityCursor.setMonth(activityCursor.getMonth() + 1)
    else activityCursor.setDate(activityCursor.getDate() + 1)
  }
  const activityMap = new Map(activity.map(point => [point.key, point]))
  for (const route of owned) {
    const date = getRouteActivityDate(route)
    const point = date && activityMap.get(activityMonthly ? dashboardMonthKey(date) : dayKey(date))
    if (point) { point.count++; point.value += dashboardFreightValue(route) }
  }

  const monthly = period === 'all' || (period === 'custom' && range.start !== null && range.end !== null && range.end.getTime() - range.start.getTime() >= 60 * 86400000)
  const dates = current.map(getRouteOperationalDate).filter((date): date is Date => date !== null)
  const first = range.start ?? (dates.length ? new Date(Math.min(...dates.map(date => date.getTime()))) : startOfDay(now))
  // Evita desenhar dias futuros vazios como queda de faturamento. Fretes futuros
  // já agendados continuam no total e no gráfico, como no filtro da Performance.
  const lastBooked = dates.length ? Math.max(...dates.map(date => date.getTime())) : now.getTime()
  const last = range.end
    ? new Date(Math.min(range.end.getTime(), endOfDay(new Date(Math.max(now.getTime(), lastBooked))).getTime()))
    : new Date(lastBooked)
  const cursor = monthly ? new Date(first.getFullYear(), first.getMonth(), 1) : startOfDay(first)
  const series: DashboardPoint[] = []
  while (cursor <= last) {
    series.push({ key: monthly ? dashboardMonthKey(cursor) : dayKey(cursor), date: new Date(cursor), value: 0, count: 0 })
    if (monthly) cursor.setMonth(cursor.getMonth() + 1)
    else cursor.setDate(cursor.getDate() + 1)
  }
  const seriesMap = new Map(series.map(point => [point.key, point]))
  for (const route of current) {
    const date = getRouteOperationalDate(route)
    const point = date && seriesMap.get(monthly ? dashboardMonthKey(date) : dayKey(date))
    if (point) { point.value += dashboardFreightValue(route); point.count++ }
  }
  const recent = [...owned].sort((a, b) => {
    const time = (route: Route) => {
      const created = route.created_at ? new Date(route.created_at).getTime() : NaN
      return Number.isFinite(created) ? created : getRouteOperationalDate(route)?.getTime() ?? 0
    }
    return time(b) - time(a) || b.freight_id - a.freight_id
  }).slice(0, 7)
  return { current: summarizeDashboardRoutes(current, rate), previous: summarizeDashboardRoutes(previous, rate), series, activity, recent, monthlyRevenue, monthlyNet, range, monthly, activityMonthly }
}
