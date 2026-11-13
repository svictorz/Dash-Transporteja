'use client'

import { useId, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowDownRight, ArrowUpRight, ArrowRight, CalendarDays, Coins, Eye, EyeOff, RefreshCw, Ticket, Truck } from 'lucide-react'
import type { Route } from '@/lib/services/routes'
import { DASHBOARD_PERIODS, dashboardFreightValue, dashboardVariation, type DashboardCustomRange, type DashboardPeriod, type DashboardPoint, type buildDashboardMetrics } from '@/lib/utils/dashboard-metrics'
import { formatBRL, formatFreightShare, getRouteCommissionValue } from '@/lib/utils/freight-financials'
import { formatDateDdMmYyyy } from '@/lib/utils/date-format'
import CommissionPaidStatus from '@/components/transporteja/CommissionPaidStatus'

type Metrics = ReturnType<typeof buildDashboardMetrics>
const panel = 'rounded-2xl border border-slate-200/80 bg-white dark:border-slate-700 dark:bg-slate-900'
const shortMoney = (value: number) => new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(value)

function Change({ value, previous, enabled }: { value: number; previous: number; enabled: boolean }) {
  if (!enabled) return <span className="text-xs text-slate-500 dark:text-slate-400">Todo o histórico</span>
  const percentage = dashboardVariation(value, previous)
  if (percentage === null) return <span className="text-xs text-slate-500 dark:text-slate-400">Sem base no período anterior</span>
  const Icon = percentage < 0 ? ArrowDownRight : ArrowUpRight
  return <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
    <span className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium ${percentage < 0 ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'}`}>
      <Icon className="h-3 w-3" aria-hidden="true" />{Math.abs(percentage).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
    </span><span className="text-slate-500 dark:text-slate-400">vs. período anterior</span>
  </div>
}

function RevenueChart({ points, monthly }: { points: DashboardPoint[]; monthly: boolean }) {
  const gradientId = useId().replace(/:/g, '')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const selected = points.find(point => point.key === selectedKey)
  const min = Math.min(0, ...points.map(point => point.value))
  const max = Math.max(1, ...points.map(point => point.value))
  const x = (index: number) => points.length === 1 ? 352 : 56 + index / (points.length - 1) * 592
  const y = (value: number) => 180 - (value - min) / (max - min) * 146
  const path = points.map((point, index) => `${index ? 'L' : 'M'} ${x(index)} ${y(point.value)}`).join(' ')
  const area = points.length ? `${path} L ${x(points.length - 1)} ${y(0)} L ${x(0)} ${y(0)} Z` : ''
  const label = (date: Date) => date.toLocaleDateString('pt-BR', monthly ? { month: 'short', year: '2-digit' } : { day: '2-digit', month: 'short' })
  const step = Math.max(1, Math.ceil((points.length - 1) / 5))
  return <div>
    <div className="mt-4 flex min-h-[24px] flex-wrap items-center gap-x-2 text-xs" aria-live="polite">
      {selected ? <><span className="text-slate-500 dark:text-slate-400">{label(selected.date)}</span><strong>{formatBRL(selected.value)}</strong><span className="text-slate-500 dark:text-slate-400">· {selected.count} frete{selected.count !== 1 ? 's' : ''}</span></> : <span className="text-slate-500 dark:text-slate-400">Toque ou passe sobre o gráfico para ver os valores.</span>}
    </div>
    <svg viewBox="0 0 672 218" className="mt-1 w-full overflow-visible" role="group" aria-label="Faturamento por data de coleta; na ausência, data de entrega">
      <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity=".22" /><stop offset="100%" stopColor="#3b82f6" stopOpacity=".01" /></linearGradient></defs>
      {[0, 1, 2, 3].map(index => {
        const value = min + (max - min) * index / 3
        return <g key={index}><line x1="56" x2="648" y1={y(value)} y2={y(value)} stroke="currentColor" className="text-slate-100 dark:text-slate-800" strokeDasharray="4 4" /><text x="44" y={y(value) + 4} textAnchor="end" fill="currentColor" className="text-[24px] text-slate-500 dark:text-slate-400 sm:text-[10px]">{shortMoney(value)}</text></g>
      })}
      <path d={area} fill={`url(#${gradientId})`} /><path d={path} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((point, index) => <g key={point.key}>
        {(index % step === 0 || index === points.length - 1) && <text x={x(index)} y="207" textAnchor="middle" fill="currentColor" className="text-[24px] text-slate-500 dark:text-slate-400 sm:text-[10px]">{label(point.date)}</text>}
        <circle cx={x(index)} cy={y(point.value)} r={selectedKey === point.key || points.length === 1 ? 4 : 2} fill="#3b82f6" />
        <circle cx={x(index)} cy={y(point.value)} r="10" fill="transparent" tabIndex={0} role="button" aria-label={`${label(point.date)}: ${formatBRL(point.value)}, ${point.count} fretes`} className="cursor-pointer outline-none focus:stroke-blue-600" onPointerEnter={() => setSelectedKey(point.key)} onFocus={() => setSelectedKey(point.key)} onClick={() => setSelectedKey(point.key)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedKey(point.key) } }}><title>{`${label(point.date)}: ${formatBRL(point.value)} · ${point.count} fretes`}</title></circle>
      </g>)}
    </svg>
  </div>
}

function FreightActivity({ points, monthly }: { points: DashboardPoint[]; monthly: boolean }) {
  const total = points.reduce((sum, point) => sum + point.count, 0)
  const max = Math.max(1, ...points.map(point => point.count))
  // Quinze dias ainda cabem no cartão; períodos maiores preservam barras e rótulos legíveis com rolagem horizontal.
  const minimumWidth = points.length > 15 ? `${Math.max(points.length * 42, 320)}px` : undefined
  const label = (date: Date) => monthly
    ? date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '')
    : date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
  const detail = (date: Date) => monthly
    ? date.toLocaleDateString('pt-BR', { month: '2-digit', year: '2-digit' })
    : date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  return <section className={`${panel} p-5 sm:p-6`}>
    <div className="flex items-start justify-between gap-2"><div><h2 className="text-sm font-semibold">Fretes por {monthly ? 'mês' : 'dia'}</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Cadastros no período selecionado</p></div><CalendarDays className="h-4 w-4 text-slate-400" aria-hidden="true" /></div>
    <p className="mt-4 flex items-baseline gap-2"><strong className="text-3xl font-semibold tracking-tight">{total}</strong><span className="text-xs text-slate-500 dark:text-slate-400">fretes no período</span></p>
    <div className="mt-5 overflow-x-auto touch-auto"><div className="grid min-w-[280px] gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(points.length, 1)}, minmax(32px, 1fr))`, width: minimumWidth }} role="list" aria-label={`Quantidade de fretes por ${monthly ? 'mês' : 'dia'} no período selecionado`}>
      {points.map(point => <div key={point.key} role="listitem" className="min-w-0 text-center" title={`${point.date.toLocaleDateString('pt-BR')}: ${point.count} fretes`}>
        <span className="block text-[11px] font-medium tabular-nums">{point.count}</span>
        <div className="mt-2 flex h-24 items-end"><div className={`w-full rounded-t-md ${point.count > 0 && point.count === max ? 'bg-blue-500' : 'bg-slate-100 dark:bg-slate-800'}`} style={{ height: point.count ? `${point.count / max * 100}%` : '3px' }} /></div>
        <span className="mt-2 block text-[10px] capitalize text-slate-500 dark:text-slate-400">{label(point.date)}</span><span className="block text-[10px] text-slate-400">{detail(point.date)}</span>
      </div>)}
    </div></div>
  </section>
}

const statusLabels: Record<Route['status'], string> = { pending: 'Pendente', inTransit: 'Em trânsito', pickedUp: 'Coletado', delivered: 'Entregue', documentation: 'Documentação', cancelled: 'Cancelado' }
const statusStyles: Record<Route['status'], string> = {
  pending: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', inTransit: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
  pickedUp: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300', delivered: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  documentation: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300', cancelled: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
}

export function DashboardOverview({ metrics, period, onPeriodChange, customRange, customDraft, customError, onCustomDraftChange, onApplyCustomRange, onRefresh, refreshing, goal, isAdmin, savingCommissionId, onToggleCommission, commissionRate, showValues, onToggleValues }: {
  metrics: Metrics; period: DashboardPeriod; onPeriodChange: (period: DashboardPeriod) => void; onRefresh: () => void; refreshing: boolean; goal: ReactNode;
  isAdmin: boolean; savingCommissionId: string | null; onToggleCommission: (route: Route) => void;
  commissionRate?: number | null;
  showValues: boolean; onToggleValues: () => void;
  customRange?: DashboardCustomRange; customDraft?: DashboardCustomRange; customError?: string | null;
  onCustomDraftChange?: (field: 'start' | 'end', value: string) => void; onApplyCustomRange?: () => void;
}) {
  const { current, previous } = metrics
  const money = (value: number) => showValues ? formatBRL(value) : 'R$ ••••••'
  const costs = [ { label: 'Motoristas', value: current.drivers, color: 'bg-blue-500' }, { label: 'Tributos', value: current.taxes, color: 'bg-amber-400' }, { label: 'Seguro', value: current.insurance, color: 'bg-violet-400' }, { label: 'Frete líquido', value: current.net, color: 'bg-emerald-400' } ]
  return <div className="mx-auto w-full max-w-[1600px] space-y-5 pb-4 text-slate-900 dark:text-slate-100">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Uma visão dos seus fretes e resultados.</p></div><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={onToggleValues} aria-label={showValues ? 'Ocultar valores do Dashboard' : 'Mostrar valores do Dashboard'} title={showValues ? 'Ocultar valores do Dashboard' : 'Mostrar valores do Dashboard'} aria-pressed={!showValues} className={`${panel} flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-slate-500 hover:text-blue-600`}>{showValues ? <Eye className="h-4 w-4" aria-hidden="true" /> : <EyeOff className="h-4 w-4" aria-hidden="true" />}<span className="hidden sm:inline">{showValues ? 'Ocultar valores' : 'Mostrar valores'}</span></button><label className={`${panel} flex items-center gap-2 px-3 py-2 text-xs`}><CalendarDays className="h-4 w-4 text-slate-400" aria-hidden="true" /><span className="sr-only">Período dos indicadores e faturamento</span><select value={period} onChange={event => onPeriodChange(event.target.value as DashboardPeriod)} className="max-w-[160px] bg-transparent font-medium outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-900">{DASHBOARD_PERIODS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><button type="button" onClick={onRefresh} disabled={refreshing} aria-label="Atualizar Dashboard" className={`${panel} p-2.5 text-slate-500 hover:text-blue-600 disabled:opacity-50`}><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" /></button></div></header>
    {period === 'custom' && customDraft && <div className={`${panel} flex flex-wrap items-end gap-3 p-3 sm:p-4`}>
      <label className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">De<input type="date" aria-label="Data inicial do Dashboard" value={customDraft.start} onChange={event => onCustomDraftChange?.('start', event.target.value)} className="rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:text-slate-100" /></label>
      <label className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">Até<input type="date" aria-label="Data final do Dashboard" value={customDraft.end} onChange={event => onCustomDraftChange?.('end', event.target.value)} className="rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:text-slate-100" /></label>
      <button type="button" onClick={onApplyCustomRange} disabled={!customRange || (customDraft.start === customRange.start && customDraft.end === customRange.end)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">Aplicar</button>
      {customError ? <p role="alert" className="w-full text-xs text-rose-600 dark:text-rose-300">{customError}</p> : customRange && (customDraft.start !== customRange.start || customDraft.end !== customRange.end) && <p className="w-full text-xs text-slate-500 dark:text-slate-400">Clique em Aplicar para atualizar os indicadores.</p>}
    </div>}
    <div className="grid gap-4 md:grid-cols-3">
      {[
        { label: 'Valor total dos fretes', value: current.freight, prev: previous.freight, icon: Truck, share: null },
        { label: 'Valor total de comissões', value: current.commissions, prev: previous.commissions, icon: Coins, share: formatFreightShare(current.commissions, current.freight) },
        { label: 'Ticket médio', value: current.ticket, prev: previous.ticket, icon: Ticket, share: null },
      ].map(item => <section key={item.label} className={`${panel} p-5 sm:p-6`}><div className="flex items-center justify-between gap-2"><h2 className="text-xs font-medium text-slate-500 dark:text-slate-400">{item.label}</h2><item.icon className="h-4 w-4 text-blue-500" aria-hidden="true" /></div><div className="my-3 flex flex-wrap items-baseline gap-x-2 gap-y-1"><strong className="text-[clamp(1.25rem,2vw,1.875rem)] font-semibold tracking-tight tabular-nums">{money(item.value)}</strong>{showValues && item.share && <span className="text-xs text-slate-500 dark:text-slate-400" title="Participação no valor total dos fretes">{item.share} do total</span>}</div>{showValues ? <Change value={item.value} previous={item.prev} enabled={period !== 'all'} /> : <span className="text-xs text-slate-500 dark:text-slate-400">Valores ocultos</span>}</section>)}
    </div>
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="contents xl:block xl:min-w-0 xl:space-y-5">
        <section className={`${panel} p-5 sm:p-6`}><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-semibold">Evolução do faturamento</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Data de coleta · na ausência, data de entrega</p></div><span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">{current.count} frete{current.count !== 1 ? 's' : ''}</span></div>{showValues ? <RevenueChart points={metrics.series} monthly={metrics.monthly} /> : <div className="flex h-[250px] items-center justify-center text-sm text-slate-500 dark:text-slate-400">Valores do gráfico ocultos</div>}
          <div className="mt-2 border-t border-slate-100 pt-5 dark:border-slate-800"><div className="mb-4 flex items-center justify-between gap-2"><h3 className="text-xs font-semibold">Composição do frete</h3><span className="text-[10px] text-slate-500 dark:text-slate-400">% do faturamento selecionado</span></div><div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">{costs.map(cost => <div key={cost.label} className="min-w-0"><div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400"><span className={`h-1.5 w-1.5 shrink-0 rounded-full ${cost.color}`} />{cost.label}</div><div className="mt-1 flex flex-wrap items-baseline gap-x-1.5"><span className="text-sm font-semibold tabular-nums">{money(cost.value)}</span><span className="text-[11px] text-slate-500 dark:text-slate-400">{showValues ? formatFreightShare(cost.value, current.freight) ?? '—' : '•••'}</span></div></div>)}</div><p className="mt-4 text-[10px] text-slate-400">A comissão é calculada sobre o frete líquido e está destacada no indicador acima.</p></div>
        </section>
        <section className={`${panel} order-2 overflow-hidden xl:order-none`}><div className="flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6"><div><h2 className="text-sm font-semibold">Seus últimos fretes</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Os 7 cadastros mais recentes · todos os períodos</p></div><Link href="/rotas" className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400">Ver todos<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link></div>
          {metrics.recent.length === 0 ? <div className="px-6 pb-8 pt-3 text-center text-sm text-slate-500 dark:text-slate-400">Você ainda não cadastrou fretes.</div> : <div className="overflow-x-auto touch-auto"><table className="w-full min-w-[960px] table-fixed text-left text-xs"><caption className="sr-only">Últimos sete fretes cadastrados por você</caption><colgroup><col className="w-[92px]" /><col className="w-[160px]" /><col className="w-[32%]" /><col className="w-[16%]" /><col className="w-[14%]" /><col /></colgroup><thead className="border-y border-slate-100 bg-slate-50/70 text-[10px] uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400"><tr>{['Frete', 'Cliente', 'Rota', 'Valor', 'Status', 'Comissão'].map(label => <th key={label} className="whitespace-nowrap px-4 py-3 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{metrics.recent.map(route => <tr key={route.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40"><td className="whitespace-nowrap px-4 py-4"><Link href="/rotas" className="font-semibold hover:text-blue-600">#{route.freight_id}</Link><span className="mt-1 block text-[10px] text-slate-400">{formatDateDdMmYyyy(route.created_at)}</span></td><td className="overflow-hidden px-4 py-4">
  <span className="block truncate font-medium" title={route.company_name ?? undefined}>{route.company_name?.trim() || 'Não informado'}</span>
</td>
<td className="px-4 py-4 font-medium leading-5">
  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
    <span>{route.origin?.trim() || 'Origem não informada'}{route.origin_state?.trim() ? `/${route.origin_state.trim()}` : ''}</span>
    <span className="text-slate-400" aria-hidden="true">→</span>
    <span>{route.destination?.trim() || 'Destino não informado'}{route.destination_state?.trim() ? `/${route.destination_state.trim()}` : ''}</span>
  </div>
</td><td className="whitespace-nowrap px-4 py-4 font-medium tabular-nums">{money(dashboardFreightValue(route))}</td><td className="whitespace-nowrap px-4 py-4"><span className={`rounded-md px-2 py-1 text-[10px] ${statusStyles[route.status]}`}>{statusLabels[route.status] ?? route.status}</span></td><td className="px-4 py-4"><div className="flex flex-col items-start gap-1"><span className="whitespace-nowrap font-medium tabular-nums">{money(getRouteCommissionValue(route, commissionRate))}</span><CommissionPaidStatus paid={route.commission_paid === true} loading={savingCommissionId === route.id} editable={isAdmin} onToggle={() => onToggleCommission(route)} /></div></td></tr>)}</tbody></table></div>}
        </section>
      </div><aside className="grid min-w-0 gap-5 sm:grid-cols-2 xl:grid-cols-1"><FreightActivity points={metrics.activity} monthly={metrics.activityMonthly} />{goal}</aside>
    </div>
  </div>
}
