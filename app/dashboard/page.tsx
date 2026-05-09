'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import FadeIn from '@/components/animations/FadeIn'
import {
  CheckCircle2,
  MapPin,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  AlertTriangle,
  Route as RouteIcon,
  ArrowRight,
  Loader2,
  DollarSign,
  Wallet,
  Users as UsersIcon,
  Receipt,
  Coins,
  TrendingUp,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRoutes } from '@/lib/hooks/useRoutes'
import type { Route as RouteRecord } from '@/lib/services/routes'

interface Alert {
  id: string
  type: 'warning' | 'info' | 'success' | 'error'
  title: string
  message: string
  time: string
}

interface RoutePreview {
  id: string
  freightId: number
  companyName: string
  companyResponsible: string
  origin: string
  originState: string
  destination: string
  destinationState: string
  vehicle: string
  plate: string
  weight: string
  estimatedDelivery: string
  pickupDate: string
  status: 'pending' | 'inTransit' | 'pickedUp' | 'delivered' | 'cancelled'
}

type PeriodKey = 'today' | '7d' | '30d' | 'month' | 'year' | 'all'

const PERIOD_OPTIONS: { value: PeriodKey; label: string; short: string }[] = [
  { value: 'today', label: 'Hoje', short: 'Hoje' },
  { value: '7d', label: '7 dias', short: '7d' },
  { value: '30d', label: '30 dias', short: '30d' },
  { value: 'month', label: 'Este mês', short: 'Mês' },
  { value: 'year', label: 'Este ano', short: 'Ano' },
  { value: 'all', label: 'Tudo', short: 'Tudo' },
]

const PERIOD_STORAGE_KEY = 'dashboard:period'

const formatBRL = (value: number) =>
  value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })

const formatBRLShort = (value: number) => {
  if (Math.abs(value) >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1).replace('.', ',')}M`
  if (Math.abs(value) >= 1_000) return `R$ ${(value / 1_000).toFixed(1).replace('.', ',')}k`
  return formatBRL(value)
}

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function getRouteDate(r: RouteRecord): Date | null {
  const raw = r.created_at || r.pickup_date || r.estimated_delivery
  if (!raw) return null
  const d = new Date(raw)
  if (isNaN(d.getTime())) return null
  return d
}

function periodRange(period: PeriodKey, now = new Date()): { start: Date | null; end: Date; prevStart: Date | null; prevEnd: Date | null } {
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)

  if (period === 'all') {
    return { start: null, end, prevStart: null, prevEnd: null }
  }

  if (period === 'today') {
    const start = startOfDay(now)
    const prevEnd = new Date(start.getTime() - 1)
    const prevStart = startOfDay(new Date(now.getTime() - 86400000))
    return { start, end, prevStart, prevEnd }
  }

  if (period === '7d' || period === '30d') {
    const days = period === '7d' ? 7 : 30
    const start = startOfDay(new Date(now.getTime() - (days - 1) * 86400000))
    const prevEnd = new Date(start.getTime() - 1)
    const prevStart = startOfDay(new Date(start.getTime() - days * 86400000))
    return { start, end, prevStart, prevEnd }
  }

  if (period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0)
    const prevEnd = new Date(start.getTime() - 1)
    return { start, end, prevStart, prevEnd }
  }

  // year
  const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0)
  const prevStart = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0)
  const prevEnd = new Date(start.getTime() - 1)
  return { start, end, prevStart, prevEnd }
}

function filterByRange(routes: RouteRecord[], start: Date | null, end: Date | null): RouteRecord[] {
  if (!start && !end) return routes
  return routes.filter((r) => {
    const d = getRouteDate(r)
    if (!d) return false
    if (start && d < start) return false
    if (end && d > end) return false
    return true
  })
}

function sumBy(routes: RouteRecord[], field: keyof RouteRecord): number {
  let total = 0
  for (const r of routes) {
    const v = r[field]
    if (typeof v === 'number' && !isNaN(v)) total += v
    else if (typeof v === 'string') {
      const n = Number(v)
      if (!isNaN(n)) total += n
    }
  }
  return total
}

function sumIf(routes: RouteRecord[], field: keyof RouteRecord, predicate: (r: RouteRecord) => boolean): number {
  let total = 0
  for (const r of routes) {
    if (!predicate(r)) continue
    const v = r[field]
    if (typeof v === 'number' && !isNaN(v)) total += v
    else if (typeof v === 'string') {
      const n = Number(v)
      if (!isNaN(n)) total += n
    }
  }
  return total
}

function variation(current: number, previous: number): { delta: number; pct: number | null } {
  const delta = current - previous
  if (previous === 0) return { delta, pct: current === 0 ? 0 : null }
  return { delta, pct: (delta / Math.abs(previous)) * 100 }
}

/** Sparkline SVG: gera N buckets diários ao longo do range. */
function buildSparkline(routes: RouteRecord[], field: keyof RouteRecord, start: Date | null, end: Date | null, buckets = 14): number[] {
  const effectiveEnd = end ?? new Date()
  const effectiveStart =
    start ?? (() => {
      const dates = routes.map(getRouteDate).filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime())
      return dates[0] ?? new Date(effectiveEnd.getTime() - 13 * 86400000)
    })()

  const totalMs = Math.max(effectiveEnd.getTime() - effectiveStart.getTime(), buckets * 86400000)
  const step = totalMs / buckets
  const result = new Array<number>(buckets).fill(0)

  for (const r of routes) {
    const d = getRouteDate(r)
    if (!d) continue
    if (d < effectiveStart || d > effectiveEnd) continue
    const idx = Math.min(buckets - 1, Math.max(0, Math.floor((d.getTime() - effectiveStart.getTime()) / step)))
    const v = r[field]
    const num = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) || 0 : 0
    result[idx] += num
  }
  return result
}

interface SparklineProps {
  data: number[]
  color: string
  className?: string
}

function Sparkline({ data, color, className = '' }: SparklineProps) {
  if (!data.length) return null
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const w = 100
  const h = 32
  const stepX = w / (data.length - 1 || 1)
  const points = data.map((v, i) => {
    const x = i * stepX
    const y = h - ((v - min) / range) * h
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const path = `M ${points.join(' L ')}`
  const areaPath = `${path} L ${w},${h} L 0,${h} Z`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={`w-full h-8 ${className}`} aria-hidden>
      <defs>
        <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#spark-${color})`} />
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

interface KpiCardProps {
  label: string
  value: string
  hint?: string
  icon: React.ComponentType<{ className?: string }>
  iconBg: string
  iconColor: string
  delta?: { pct: number | null; positiveIsGood: boolean } | null
  spark?: { data: number[]; color: string }
  delay?: number
}

function KpiCard({ label, value, hint, icon: Icon, iconBg, iconColor, delta, spark, delay = 0 }: KpiCardProps) {
  const showDelta = delta && delta.pct !== null && Number.isFinite(delta.pct)
  const isUp = (delta?.pct ?? 0) >= 0
  const good = delta ? (delta.positiveIsGood ? isUp : !isUp) : false
  return (
    <FadeIn delay={delay} direction="up">
      <motion.div
        whileHover={{ y: -3 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        className="relative bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
      >
        <div className="flex items-start justify-between mb-3">
          <div className={`w-10 h-10 ${iconBg} rounded-xl flex items-center justify-center`}>
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>
          {showDelta ? (
            <div
              className={`flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${
                good ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'
              }`}
              title="Variação vs período anterior"
            >
              {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {Math.abs(delta!.pct as number).toFixed(0)}%
            </div>
          ) : null}
        </div>
        <div className="text-[11px] uppercase tracking-wider text-gray-500 font-medium">{label}</div>
        <div className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">{value}</div>
        {hint ? <div className="text-xs text-gray-500 mt-1">{hint}</div> : null}
        {spark ? (
          <div className="mt-3 -mx-1">
            <Sparkline data={spark.data} color={spark.color} />
          </div>
        ) : null}
      </motion.div>
    </FadeIn>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const { routes, loadRoutes } = useRoutes()
  const [mounted, setMounted] = useState(false)
  const [period, setPeriod] = useState<PeriodKey>('30d')

  useEffect(() => {
    setMounted(true)
    try {
      const saved = localStorage.getItem(PERIOD_STORAGE_KEY) as PeriodKey | null
      if (saved && PERIOD_OPTIONS.some((o) => o.value === saved)) {
        setPeriod(saved)
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (!mounted) return
    try {
      localStorage.setItem(PERIOD_STORAGE_KEY, period)
    } catch {}
  }, [period, mounted])

  const { start, end, prevStart, prevEnd } = useMemo(() => periodRange(period), [period])

  const currentRoutes = useMemo(() => filterByRange(routes, start, end), [routes, start, end])
  const previousRoutes = useMemo(() => filterByRange(routes, prevStart, prevEnd), [routes, prevStart, prevEnd])

  // ---------- KPIs ----------
  const isPaidFull = (r: RouteRecord) => (r.payment_status ?? '').trim() === '100%'
  const isDriverPaidFull = (r: RouteRecord) => (r.driver_payment_status ?? '').trim() === '100%'

  const kpis = useMemo(() => {
    const fat = sumBy(currentRoutes, 'freight_value')
    const fatPrev = sumBy(previousRoutes, 'freight_value')

    const liquido = sumBy(currentRoutes, 'net_freight_value')
    const liquidoPrev = sumBy(previousRoutes, 'net_freight_value')

    const comissoes = sumBy(currentRoutes, 'commission_value')
    const comissoesPrev = sumBy(previousRoutes, 'commission_value')

    const aPagar = sumIf(currentRoutes, 'driver_value', (r) => !isDriverPaidFull(r))
    const aPagarPrev = sumIf(previousRoutes, 'driver_value', (r) => !isDriverPaidFull(r))

    const tributos = sumBy(currentRoutes, 'taxes_value')
    const tributosPrev = sumBy(previousRoutes, 'taxes_value')

    const ticket = currentRoutes.length ? fat / currentRoutes.length : 0
    const ticketPrev = previousRoutes.length ? fatPrev / previousRoutes.length : 0

    const aReceber = sumIf(currentRoutes, 'freight_value', (r) => !isPaidFull(r))

    return {
      fat: { value: fat, prev: fatPrev },
      liquido: { value: liquido, prev: liquidoPrev },
      comissoes: { value: comissoes, prev: comissoesPrev },
      aPagar: { value: aPagar, prev: aPagarPrev },
      tributos: { value: tributos, prev: tributosPrev },
      ticket: { value: ticket, prev: ticketPrev },
      aReceber,
      count: currentRoutes.length,
    }
  }, [currentRoutes, previousRoutes])

  const sparkFat = useMemo(() => buildSparkline(currentRoutes, 'freight_value', start, end), [currentRoutes, start, end])
  const sparkLiquido = useMemo(() => buildSparkline(currentRoutes, 'net_freight_value', start, end), [currentRoutes, start, end])
  const sparkComissao = useMemo(() => buildSparkline(currentRoutes, 'commission_value', start, end), [currentRoutes, start, end])
  const sparkTributos = useMemo(() => buildSparkline(currentRoutes, 'taxes_value', start, end), [currentRoutes, start, end])

  // ---------- Status counts (mantém compatibilidade com o resto do dashboard) ----------
  const routeStats = useMemo(() => {
    const active = currentRoutes.filter((r) => r.status === 'inTransit' || r.status === 'pickedUp').length
    const completed = currentRoutes.filter((r) => r.status === 'delivered').length
    const pending = currentRoutes.filter((r) => r.status === 'pending').length
    const cancelled = currentRoutes.filter((r) => r.status === 'cancelled').length
    return { active, completed, pending, cancelled }
  }, [currentRoutes])

  // ---------- Recentes ----------
  const formatDateBR = (dateString: string) => {
    if (!dateString) return ''
    try {
      const date = new Date(dateString)
      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
      const day = date.getDate().toString().padStart(2, '0')
      const month = months[date.getMonth()]
      const year = date.getFullYear()
      return `${day} ${month}, ${year}`
    } catch {
      return dateString
    }
  }

  const recentRoutes = useMemo<RoutePreview[]>(() => {
    return currentRoutes.slice(0, 5).map((route) => ({
      id: route.id,
      freightId: route.freight_id,
      companyName: route.company_name?.trim() || '—',
      companyResponsible: route.company_responsible?.trim() || '—',
      origin: route.origin,
      originState: route.origin_state,
      destination: route.destination,
      destinationState: route.destination_state,
      vehicle: route.vehicle,
      plate: route.plate,
      weight: route.weight,
      estimatedDelivery: formatDateBR(route.estimated_delivery),
      pickupDate: formatDateBR(route.pickup_date),
      status: route.status,
    }))
  }, [currentRoutes])

  const alerts: Alert[] = []

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'inTransit':
        return { label: 'Em Trânsito', dotColor: 'bg-orange-500' }
      case 'delivered':
        return { label: 'Entregue', dotColor: 'bg-green-500' }
      case 'pickedUp':
        return { label: 'Coletado', dotColor: 'bg-gray-500' }
      case 'pending':
        return { label: 'Pendente', dotColor: 'bg-yellow-500' }
      case 'cancelled':
        return { label: 'Cancelado', dotColor: 'bg-red-500' }
      default:
        return { label: 'Desconhecido', dotColor: 'bg-gray-500' }
    }
  }

  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-slate-800" />
          <p className="text-gray-600">Carregando dashboard...</p>
        </div>
      </div>
    )
  }

  const periodLabel = PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? ''

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn delay={0.05}>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Resumo financeiro e operacional · <span className="font-medium text-gray-700">{periodLabel}</span>
              {kpis.count > 0 ? <span className="text-gray-400"> · {kpis.count} fretes no período</span> : null}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ rotate: 90 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => loadRoutes()}
              className="p-2 bg-white rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
              title="Atualizar dados"
            >
              <RefreshCw className="w-4 h-4 text-gray-600" />
            </motion.button>
          </div>
        </div>
      </FadeIn>

      {/* Filtro de período */}
      <FadeIn delay={0.1}>
        <div
          role="tablist"
          aria-label="Período"
          className="flex flex-wrap items-center gap-1 p-1 bg-white rounded-xl border border-gray-200 shadow-sm w-fit"
        >
          {PERIOD_OPTIONS.map((opt) => {
            const active = period === opt.value
            return (
              <button
                key={opt.value}
                role="tab"
                aria-selected={active}
                onClick={() => setPeriod(opt.value)}
                className={`relative px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors ${
                  active ? 'text-white' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="period-pill"
                    className="absolute inset-0 bg-slate-900 rounded-lg"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative">
                  <span className="hidden sm:inline">{opt.label}</span>
                  <span className="sm:hidden">{opt.short}</span>
                </span>
              </button>
            )
          })}
        </div>
      </FadeIn>

      {/* Alertas */}
      {alerts.length > 0 && (
        <FadeIn delay={0.15}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {alerts.map((alert, index) => (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.1 }}
                className={`bg-white rounded-xl p-4 border ${
                  alert.type === 'warning'
                    ? 'border-yellow-300/70'
                    : alert.type === 'error'
                    ? 'border-red-300/70'
                    : alert.type === 'success'
                    ? 'border-green-300/70'
                    : 'border-blue-300/70'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      alert.type === 'warning'
                        ? 'bg-yellow-100'
                        : alert.type === 'error'
                        ? 'bg-red-100'
                        : alert.type === 'success'
                        ? 'bg-green-100'
                        : 'bg-blue-100'
                    }`}
                  >
                    {alert.type === 'warning' || alert.type === 'error' ? (
                      <AlertTriangle
                        className={`w-5 h-5 ${
                          alert.type === 'warning'
                            ? 'text-yellow-600'
                            : alert.type === 'error'
                            ? 'text-red-600'
                            : 'text-gray-600'
                        }`}
                      />
                    ) : (
                      <CheckCircle2 className={`w-5 h-5 ${alert.type === 'success' ? 'text-green-600' : 'text-blue-600'}`} />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 text-sm">{alert.title}</h3>
                    <p className="text-xs text-gray-600 mt-1">{alert.message}</p>
                    <p className="text-xs text-gray-400 mt-1">{alert.time}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </FadeIn>
      )}

      {/* KPIs financeiros */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard
          label="Faturamento"
          value={formatBRLShort(kpis.fat.value)}
          hint={`${kpis.count} fretes · A receber ${formatBRLShort(kpis.aReceber)}`}
          icon={DollarSign}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          delta={{ pct: variation(kpis.fat.value, kpis.fat.prev).pct, positiveIsGood: true }}
          spark={{ data: sparkFat, color: '#10b981' }}
          delay={0.2}
        />
        <KpiCard
          label="Frete líquido"
          value={formatBRLShort(kpis.liquido.value)}
          hint={
            kpis.fat.value > 0
              ? `Margem ${((kpis.liquido.value / kpis.fat.value) * 100).toFixed(0)}% sobre faturamento`
              : 'Sem faturamento no período'
          }
          icon={Wallet}
          iconBg="bg-sky-50"
          iconColor="text-sky-600"
          delta={{ pct: variation(kpis.liquido.value, kpis.liquido.prev).pct, positiveIsGood: true }}
          spark={{ data: sparkLiquido, color: '#0ea5e9' }}
          delay={0.25}
        />
        <KpiCard
          label="Comissões"
          value={formatBRLShort(kpis.comissoes.value)}
          hint="Total a pagar aos comerciais"
          icon={TrendingUp}
          iconBg="bg-violet-50"
          iconColor="text-violet-600"
          delta={{ pct: variation(kpis.comissoes.value, kpis.comissoes.prev).pct, positiveIsGood: true }}
          spark={{ data: sparkComissao, color: '#8b5cf6' }}
          delay={0.3}
        />
        <KpiCard
          label="A pagar a motoristas"
          value={formatBRLShort(kpis.aPagar.value)}
          hint="Pagamentos do motorista ainda em aberto"
          icon={UsersIcon}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          delta={{ pct: variation(kpis.aPagar.value, kpis.aPagar.prev).pct, positiveIsGood: false }}
          delay={0.35}
        />
        <KpiCard
          label="Tributos"
          value={formatBRLShort(kpis.tributos.value)}
          hint={
            kpis.fat.value > 0
              ? `${((kpis.tributos.value / kpis.fat.value) * 100).toFixed(1)}% sobre faturamento`
              : 'Sem faturamento no período'
          }
          icon={Receipt}
          iconBg="bg-rose-50"
          iconColor="text-rose-600"
          delta={{ pct: variation(kpis.tributos.value, kpis.tributos.prev).pct, positiveIsGood: false }}
          spark={{ data: sparkTributos, color: '#f43f5e' }}
          delay={0.4}
        />
        <KpiCard
          label="Ticket médio"
          value={formatBRLShort(kpis.ticket.value)}
          hint={
            kpis.count
              ? `${routeStats.completed} entregues · ${routeStats.active} em trânsito · ${routeStats.pending} pendentes`
              : 'Sem fretes no período'
          }
          icon={Coins}
          iconBg="bg-indigo-50"
          iconColor="text-indigo-600"
          delta={{ pct: variation(kpis.ticket.value, kpis.ticket.prev).pct, positiveIsGood: true }}
          delay={0.45}
        />
      </div>

      {/* Lista de fretes recentes (mantida) */}
      <FadeIn delay={0.6}>
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-900">Fretes</h2>
              <span className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">
                {recentRoutes.length}
              </span>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => router.push('/dashboard/rotas')}
              className="text-sm text-gray-600 hover:text-gray-900 font-medium"
            >
              Ver todos →
            </motion.button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {recentRoutes.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <RouteIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Nenhum frete no período selecionado</p>
                <button
                  onClick={() => router.push('/dashboard/rotas')}
                  className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors font-medium"
                >
                  Abrir Fretes
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        ID do Frete
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Cliente
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Rota
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Veículo
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Previsão de Entrega
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {recentRoutes.map((route, index) => {
                      const statusDisplay = getStatusDisplay(route.status)
                      return (
                        <motion.tr
                          key={route.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.65 + index * 0.05 }}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm font-medium text-gray-900">#{route.freightId}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="text-sm text-gray-900">{route.companyName}</span>
                              <span className="text-xs text-gray-500 mt-1">{route.companyResponsible}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <MapPin className="w-4 h-4 text-gray-600" />
                                  <span className="text-sm text-gray-900">
                                    {route.origin}, {route.originState}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <ArrowRight className="w-4 h-4 text-gray-400" />
                                  <MapPin className="w-4 h-4 text-gray-600" />
                                  <span className="text-sm text-gray-900">
                                    {route.destination}, {route.destinationState}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="text-sm text-gray-900">{route.vehicle}</span>
                              <span className="text-xs text-gray-500 mt-1">
                                {route.plate} • {route.weight}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="text-sm text-gray-900">{route.estimatedDelivery}</span>
                              <span className="text-xs text-gray-500 mt-1">Coletado: {route.pickupDate}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${statusDisplay.dotColor}`}></div>
                              <span className="text-sm text-gray-900">{statusDisplay.label}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => router.push('/dashboard/rotas')}
                              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                            >
                              Ver mais
                            </motion.button>
                          </td>
                        </motion.tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </FadeIn>
    </div>
  )
}
