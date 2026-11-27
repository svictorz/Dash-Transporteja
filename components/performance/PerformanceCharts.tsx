'use client'

import { useMemo, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import type { Route } from '@/lib/services/routes'
import { useMonthlySalesGoals } from '@/lib/hooks/useMonthlySalesGoals'
import { MonthlyGoalView } from '@/components/dashboard/MonthlyGoalCard'
import { dashboardFreightValue, dashboardMonthKey } from '@/lib/utils/dashboard-metrics'
import { formatBRL, getRouteNetFreightValue } from '@/lib/utils/freight-financials'
import { getRouteOperationalDate } from '@/lib/utils/route-period-filter'
import { isPerformanceSellerRole } from '@/lib/utils/roles'
import { smoothChartPath } from '@/lib/utils/chart-path'

type Seller = { id: string; name: string | null; email: string; role: string }
type Point = { key: string; date: Date; total: number; count: number; bySeller: Record<string, { value: number; count: number }> }
type Series = { id: string; name: string; color: string }

const panel = 'rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
const colors = ['#3b82f6', '#10b981', '#a855f7', '#f97316', '#e11d48', '#06b6d4', '#eab308', '#8b5cf6', '#14b8a6', '#f43f5e']
const dateKey = (date: Date, monthly: boolean) => monthly
  ? dashboardMonthKey(date).slice(0, 7)
  : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const dateLabel = (date: Date, monthly: boolean) => date.toLocaleDateString('pt-BR', monthly ? { month: 'long', year: 'numeric' } : { day: '2-digit', month: '2-digit', year: 'numeric' })
const shortMoney = (value: number) => new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(value)

function makePoints(routes: Route[], bounds: { start: Date | null; end: Date | null }, monthly: boolean, activity: boolean): Point[] {
  const dated = routes.map(route => ({ route, date: activity
    ? (route.created_at && Number.isFinite(new Date(route.created_at).getTime()) ? new Date(route.created_at) : getRouteOperationalDate(route))
    : getRouteOperationalDate(route) })).filter((item): item is { route: Route; date: Date } => item.date !== null)
  const now = new Date()
  const first = bounds.start ?? (dated.length ? new Date(Math.min(...dated.map(item => item.date.getTime()))) : now)
  const last = bounds.end ?? (dated.length ? new Date(Math.max(...dated.map(item => item.date.getTime()))) : now)
  const cursor = monthly ? new Date(first.getFullYear(), first.getMonth(), 1) : new Date(first.getFullYear(), first.getMonth(), first.getDate())
  const points: Point[] = []
  while (cursor <= last && points.length < 366) {
    points.push({ key: dateKey(cursor, monthly), date: new Date(cursor), total: 0, count: 0, bySeller: {} })
    if (monthly) cursor.setMonth(cursor.getMonth() + 1)
    else cursor.setDate(cursor.getDate() + 1)
  }
  const pointByKey = new Map(points.map(point => [point.key, point]))
  for (const { route, date } of dated) {
    const point = pointByKey.get(dateKey(date, monthly))
    if (!point) continue
    const id = route.created_by_user_id ?? '__sem_responsavel__'
    const seller = point.bySeller[id] ?? (point.bySeller[id] = { value: 0, count: 0 })
    point.count += 1
    seller.count += 1
    if (!activity) {
      if (route.status === 'cancelled') continue
      const value = dashboardFreightValue(route)
      point.total += value
      seller.value += value
    }
  }
  return points
}

function RevenueChart({ points, series, monthly, showValues }: { points: Point[]; series: Series[]; monthly: boolean; showValues: boolean }) {
  const [active, setActive] = useState<number | null>(null)
  const max = Math.max(1, ...points.map(point => Math.max(point.total, ...Object.values(point.bySeller).map(item => item.value))))
  const x = (index: number) => points.length < 2 ? 380 : 52 + index / (points.length - 1) * 696
  const y = (value: number) => 204 - value / max * 166
  const selected = active === null ? null : points[active]
  const labelStep = Math.max(1, Math.ceil(points.length / 6))
  return <section className={panel}>
    <div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold">Evolução do faturamento</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Data de coleta · na ausência, data de entrega</p></div><span className="rounded-lg bg-blue-50 px-2 py-1 text-xs text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">{points.reduce((sum, point) => sum + point.count, 0)} fretes</span></div>
    {showValues ? <>
      <div className="relative mt-5">
        {selected && <div role="status" className="pointer-events-none absolute top-2 z-10 min-w-[145px] rounded-lg border border-slate-200 bg-white p-2 text-xs shadow-xl dark:border-slate-600 dark:bg-slate-800" style={{ left: `${Math.min(86, Math.max(14, x(active!) / 760 * 100))}%`, transform: 'translateX(-50%)' }}><strong>{dateLabel(selected.date, monthly)}</strong><div className="mt-1 font-semibold">{formatBRL(selected.total)} · {selected.count} fretes</div>{series.length > 1 && series.map(seller => <div key={seller.id} className="mt-1 flex justify-between gap-3"><span className="truncate" style={{ color: seller.color }}>{seller.name}</span><span>{formatBRL(selected.bySeller[seller.id]?.value ?? 0)}</span></div>)}</div>}
        <svg viewBox="0 0 800 245" className="w-full overflow-visible" role="img" aria-label="Faturamento por data e por vendedor" onPointerLeave={() => setActive(null)}>
          {[0, 1, 2, 3].map(index => { const value = max * index / 3; return <g key={index}><line x1="52" x2="748" y1={y(value)} y2={y(value)} stroke="currentColor" className="text-slate-200 dark:text-slate-700" strokeDasharray="4 5" /><text x="43" y={y(value) + 4} textAnchor="end" fill="currentColor" className="text-[10px] text-slate-500 dark:text-slate-400">{shortMoney(value)}</text></g> })}
          {series.map(seller => <path key={seller.id} d={smoothChartPath(points.map((point, index) => ({ x: x(index), y: y(point.bySeller[seller.id]?.value ?? 0) })))} fill="none" stroke={seller.color} strokeWidth="2.8" strokeLinejoin="round" strokeLinecap="round" />)}
          {points.map((point, index) => <g key={point.key}>{(index % labelStep === 0 || index === points.length - 1) && <text x={x(index)} y="239" textAnchor="middle" fill="currentColor" className="text-[10px] text-slate-500 dark:text-slate-400">{point.date.toLocaleDateString('pt-BR', monthly ? { month: 'short', year: '2-digit' } : { day: '2-digit', month: '2-digit' })}</text>}{series.map(seller => <circle key={seller.id} cx={x(index)} cy={y(point.bySeller[seller.id]?.value ?? 0)} r="3" fill={seller.color} />)}<rect x={x(index) - Math.max(7, 696 / Math.max(points.length, 1) / 2)} y="20" width={Math.max(14, 696 / Math.max(points.length, 1))} height="193" fill="transparent" tabIndex={0} onPointerEnter={() => setActive(index)} onFocus={() => setActive(index)} onClick={() => setActive(index)} aria-label={`${dateLabel(point.date, monthly)}: ${formatBRL(point.total)}, ${point.count} fretes`} /></g>)}
        </svg>
      </div>
      {series.length > 1 && <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs">{series.map(seller => <span key={seller.id} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: seller.color }} />{seller.name}</span>)}</div>}
    </> : <div className="mt-5 flex h-[245px] items-center justify-center text-sm text-slate-500 dark:text-slate-400">Valores do gráfico ocultos</div>}
  </section>
}

function FreightActivity({ points, series, monthly }: { points: Point[]; series: Series[]; monthly: boolean }) {
  const [active, setActive] = useState<string | null>(null)
  const max = Math.max(1, ...points.map(point => point.count))
  return <section className={panel}>
    <div className="flex items-start justify-between gap-2"><div><h2 className="text-sm font-semibold">Fretes por {monthly ? 'mês' : 'dia'}</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Cadastros no período selecionado</p></div><CalendarDays className="h-4 w-4 text-slate-400" aria-hidden="true" /></div>
    <p className="mt-4 flex items-baseline gap-2"><strong className="text-3xl">{points.reduce((sum, point) => sum + point.count, 0)}</strong><span className="text-xs text-slate-500 dark:text-slate-400">fretes no período</span></p>
    <div className="mt-5 overflow-x-auto pb-2"><div className="grid min-w-[280px] gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.max(points.length, 1)}, minmax(28px, 1fr))`, width: points.length > 12 ? Math.max(280, points.length * 36) : undefined }} role="list" aria-label={`Fretes por ${monthly ? 'mês' : 'dia'}`}>
      {points.map(point => <div key={point.key} role="listitem" className="group relative min-w-0 text-center" onPointerEnter={() => setActive(point.key)} onPointerLeave={() => setActive(null)} onFocus={() => setActive(point.key)} onBlur={() => setActive(null)} tabIndex={0} aria-label={`${dateLabel(point.date, monthly)}: ${point.count} fretes`}><span className="text-[11px] font-semibold">{point.count}</span><div className="mt-2 flex h-24 flex-col justify-end" style={{ height: 96 }}>{point.count > 0 ? <div className="flex w-full flex-col justify-end overflow-hidden rounded-t-xl" style={{ height: `${point.count / max * 100}%` }}>{series.map(seller => { const count = point.bySeller[seller.id]?.count ?? 0; return count ? <div key={seller.id} style={{ height: `${count / point.count * 100}%`, backgroundColor: seller.color }} /> : null })}</div> : <div className="h-[3px] w-full rounded-t bg-slate-200 dark:bg-slate-800" />}</div><span className="mt-2 block truncate text-[10px] text-slate-500 dark:text-slate-400">{point.date.toLocaleDateString('pt-BR', monthly ? { month: 'short' } : { weekday: 'short' })}</span><span className="block text-[10px] text-slate-400">{point.date.toLocaleDateString('pt-BR', monthly ? { month: '2-digit', year: '2-digit' } : { day: '2-digit', month: '2-digit' })}</span>{active === point.key && <div role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 w-max max-w-[220px] -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-2 text-left text-xs shadow-xl dark:border-slate-600 dark:bg-slate-800"><strong>{dateLabel(point.date, monthly)}: {point.count} fretes</strong>{series.length > 1 && series.map(seller => <div key={seller.id} style={{ color: seller.color }}>{seller.name}: {point.bySeller[seller.id]?.count ?? 0}</div>)}</div>}</div>)}
    </div></div>
  </section>
}

function MonthlyGoalTrend({ routes, month, revenueGoal, netGoal, showValues }: { routes: Route[]; month: Date; revenueGoal: number | null; netGoal: number | null; showValues: boolean }) {
  const [activeDay, setActiveDay] = useState<number | null>(null)
  const today = new Date()
  const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const latestBooked = routes.reduce((max, route) => Math.max(max, getRouteOperationalDate(route)?.getDate() ?? 0), 0)
  const visibleDays = month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth()
    ? Math.min(lastDay, Math.max(today.getDate(), latestBooked))
    : lastDay
  let revenueTotal = 0
  let netTotal = 0
  const points = Array.from({ length: visibleDays }, (_, index) => {
    const day = index + 1
    const daily = routes.filter(route => getRouteOperationalDate(route)?.getDate() === day)
    revenueTotal += daily.reduce((sum, route) => sum + dashboardFreightValue(route), 0)
    netTotal += daily.reduce((sum, route) => sum + getRouteNetFreightValue(route), 0)
    return { day, revenue: revenueTotal, net: netTotal }
  })
  const hasRevenueGoal = revenueGoal !== null && revenueGoal > 0
  const hasNetGoal = netGoal !== null && netGoal > 0
  const maxPercent = Math.max(100, ...points.map(point => Math.max(hasRevenueGoal ? point.revenue / revenueGoal * 100 : 0, hasNetGoal ? point.net / netGoal * 100 : 0)))
  const x = (index: number) => points.length < 2 ? 380 : 52 + index / (points.length - 1) * 696
  const y = (percent: number) => 204 - percent / maxPercent * 166
  const line = (kind: 'revenue' | 'net', goal: number) => smoothChartPath(points.map((point, index) => ({ x: x(index), y: y(point[kind] / goal * 100) })))
  const selected = activeDay === null ? null : points[activeDay]
  return <section className={panel}>
    <h2 className="text-sm font-semibold">Evolução das metas do mês</h2>
    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Acumulado até cada dia · linha pontilhada = 100% da meta</p>
    {!showValues ? <div className="flex h-40 items-center justify-center text-sm text-slate-500 dark:text-slate-400">Valores do gráfico ocultos</div> : !hasRevenueGoal && !hasNetGoal ? <div className="flex h-40 items-center justify-center text-sm text-slate-500 dark:text-slate-400">Defina uma meta mensal para acompanhar a evolução.</div> : <>
      <div className="relative mt-5">
        {selected && <div role="tooltip" className="pointer-events-none absolute top-2 z-10 min-w-[170px] rounded-lg border border-slate-200 bg-white p-2 text-xs shadow-xl dark:border-slate-600 dark:bg-slate-800" style={{ left: `${Math.min(86, Math.max(14, x(activeDay!) / 800 * 100))}%`, transform: 'translateX(-50%)' }}><strong>{String(selected.day).padStart(2, '0')}/{String(month.getMonth() + 1).padStart(2, '0')}/{month.getFullYear()}</strong><p className="mt-1 text-blue-600 dark:text-blue-300">Faturamento: {formatBRL(selected.revenue)}{hasRevenueGoal ? ` · ${(selected.revenue / revenueGoal * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : ''}</p><p className="text-emerald-600 dark:text-emerald-300">Lucro líquido: {formatBRL(selected.net)}{hasNetGoal ? ` · ${(selected.net / netGoal * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : ''}</p></div>}
        <svg viewBox="0 0 800 245" className="w-full overflow-visible" role="img" aria-label="Evolução diária das metas de faturamento e lucro líquido" onPointerLeave={() => setActiveDay(null)}>
          {[0, 50, 100].map(percent => <g key={percent}><line x1="52" x2="748" y1={y(percent)} y2={y(percent)} stroke="currentColor" strokeDasharray={percent === 100 ? '5 4' : '3 5'} className="text-slate-300 dark:text-slate-700" /><text x="43" y={y(percent) + 4} textAnchor="end" fill="currentColor" className="text-[10px] text-slate-500 dark:text-slate-400">{percent}%</text></g>)}
          {hasRevenueGoal && <path d={line('revenue', revenueGoal)} fill="none" stroke="#3b82f6" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />}
          {hasNetGoal && <path d={line('net', netGoal)} fill="none" stroke="#22c55e" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />}
          {points.map((point, index) => <g key={point.day}>{(index === 0 || point.day % 5 === 0 || index === points.length - 1) && <text x={x(index)} y="239" textAnchor="middle" fill="currentColor" className="text-[10px] text-slate-500 dark:text-slate-400">{String(point.day).padStart(2, '0')}/{String(month.getMonth() + 1).padStart(2, '0')}</text>}<rect x={x(index) - Math.max(7, 696 / Math.max(points.length, 1) / 2)} y="20" width={Math.max(14, 696 / Math.max(points.length, 1))} height="193" fill="transparent" tabIndex={0} aria-label={`${point.day}/${month.getMonth() + 1}: faturamento ${formatBRL(point.revenue)}, lucro líquido ${formatBRL(point.net)}`} onPointerEnter={() => setActiveDay(index)} onFocus={() => setActiveDay(index)} onClick={() => setActiveDay(index)} /></g>)}
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs"><span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" />Faturamento</span><span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-green-500" />Lucro líquido</span></div>
    </>}
  </section>
}

function usePerformanceGoals({ rows, sellers, selectedSeller, userId, role, month }: { rows: Route[]; sellers: Seller[]; selectedSeller: string; userId: string | null; role: string | null; month: Date }) {
  const monthKey = dashboardMonthKey(month)
  const isAdmin = role === 'admin'
  const { goals, loading, error, refresh } = useMonthlySalesGoals(userId, monthKey, isAdmin)
  const monthRows = rows.filter(route => {
    const date = getRouteOperationalDate(route)
    return date && date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth() && (selectedSeller === 'all' || (route.created_by_user_id ?? '__sem_responsavel__') === selectedSeller)
  })
  const financialMonthRows = monthRows.filter(route => route.status !== 'cancelled')
  const revenue = financialMonthRows.reduce((sum, route) => sum + dashboardFreightValue(route), 0)
  const netRevenue = financialMonthRows.reduce((sum, route) => sum + getRouteNetFreightValue(route), 0)
  const sellerIds = new Set(sellers.filter(seller => isPerformanceSellerRole(seller.role)).map(seller => seller.id))
  const relevant = selectedSeller === 'all' ? goals.filter(goal => sellerIds.has(goal.user_id)) : goals.filter(goal => goal.user_id === selectedSeller)
  const amount = relevant.length ? relevant.reduce((sum, goal) => sum + goal.amount, 0) : null
  const netAmount = relevant.some(goal => goal.net_amount != null) ? relevant.reduce((sum, goal) => sum + (goal.net_amount ?? 0), 0) : null
  return { monthRows, revenue, netRevenue, amount, netAmount, loading, error, refresh }
}

function PerformanceGoal({ revenue, netRevenue, amount, netAmount, loading, error, refresh, selectedSeller, month, showValues }: ReturnType<typeof usePerformanceGoals> & { selectedSeller: string; month: Date; showValues: boolean }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div className="relative" onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)}>
      <MonthlyGoalView revenue={revenue} amount={amount} netRevenue={netRevenue} netAmount={netAmount} monthLabel={`${month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}${selectedSeller === 'all' ? ' · Geral' : ''}`} loading={loading} error={error} onRetry={() => void refresh()} showValues={showValues} goalLabel={selectedSeller === 'all' ? 'Meta geral' : 'Sua meta'} />
      {hovered && showValues && !loading && !error && <div role="tooltip" className="pointer-events-none absolute right-3 top-12 z-20 rounded-lg border border-slate-200 bg-white p-2 text-xs shadow-lg dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"><strong>{month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</strong><p>Faturamento: {formatBRL(revenue)}</p><p>Lucro líquido: {formatBRL(netRevenue)}</p></div>}
    </div>
  )
}

export function PerformanceCharts({ rows, activityRows, allRows, sellers, selectedSeller, userId, role, bounds, period, showRevenue, showGoal }: { rows: Route[]; activityRows: Route[]; allRows: Route[]; sellers: Seller[]; selectedSeller: string; userId: string | null; role: string | null; bounds: { start: Date | null; end: Date | null }; period: string; showRevenue: boolean; showGoal: boolean }) {
  const now = new Date()
  const month = period === 'mesPassado' ? new Date(now.getFullYear(), now.getMonth() - 1, 1) : period === 'custom' && bounds.start && bounds.end && bounds.start.getMonth() === bounds.end.getMonth() && bounds.start.getFullYear() === bounds.end.getFullYear() ? bounds.start : now
  const monthly = period === 'tudo' || (bounds.start !== null && bounds.end !== null && bounds.end.getTime() - bounds.start.getTime() > 60 * 86400000)
  const currentMonth = period === 'mesAtual' && bounds.end !== null
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  const latestBooked = rows.reduce((max, route) => Math.max(max, getRouteOperationalDate(route)?.getTime() ?? 0), now.getTime())
  const revenueBounds = currentMonth ? { ...bounds, end: new Date(Math.min(bounds.end!.getTime(), Math.max(endOfToday.getTime(), latestBooked))) } : bounds
  const activityBounds = currentMonth ? { ...bounds, end: new Date(Math.min(bounds.end!.getTime(), endOfToday.getTime())) } : bounds
  const activity = useMemo(() => makePoints(activityRows, activityBounds, monthly, true), [activityRows, activityBounds.start, activityBounds.end, monthly])
  const series = useMemo(() => {
    const ids = selectedSeller === 'all' ? Array.from(new Set([...rows.map(route => route.created_by_user_id ?? '__sem_responsavel__'), ...activity.flatMap(point => Object.keys(point.bySeller))])) : [selectedSeller]
    const orderedIds = Array.from(new Set(['__sem_responsavel__', ...sellers.map(seller => seller.id), ...ids])).sort((a, b) => (sellers.find(s => s.id === a)?.name ?? a).localeCompare(sellers.find(s => s.id === b)?.name ?? b))
    return ids.sort((a, b) => orderedIds.indexOf(a) - orderedIds.indexOf(b)).map(id => {
      const index = orderedIds.indexOf(id)
      return { id, name: id === '__sem_responsavel__' ? 'Sem responsável' : sellers.find(s => s.id === id)?.name || sellers.find(s => s.id === id)?.email || 'Vendedor', color: colors[index] ?? `hsl(${(index * 137.508) % 360} 70% 50%)` }
    })
  }, [rows, activity, sellers, selectedSeller])
  const fallbackSeries = [{ id: selectedSeller, name: 'Vendedor', color: colors[0] }]
  const revenueSeries = series.filter(seller => rows.some(route => (route.created_by_user_id ?? '__sem_responsavel__') === seller.id))
  const activitySeries = series.filter(seller => activity.some(point => (point.bySeller[seller.id]?.count ?? 0) > 0))
  const revenue = useMemo(() => makePoints(rows, revenueBounds, monthly, false), [rows, revenueBounds.start, revenueBounds.end, monthly])
  const goals = usePerformanceGoals({ rows: allRows.filter(route => route.status !== 'cancelled'), sellers, selectedSeller, userId, role, month })
  return <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]"><div className="grid gap-4"><RevenueChart points={revenue} series={revenueSeries.length ? revenueSeries : fallbackSeries} monthly={monthly} showValues={showRevenue} />{!goals.loading && !goals.error && <MonthlyGoalTrend routes={goals.monthRows} month={month} revenueGoal={goals.amount} netGoal={goals.netAmount} showValues={showGoal} />}</div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1"><FreightActivity points={activity} series={activitySeries.length ? activitySeries : fallbackSeries} monthly={monthly} /><PerformanceGoal {...goals} selectedSeller={selectedSeller} month={month} showValues={showGoal} /></div></div>
}
