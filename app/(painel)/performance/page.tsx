'use client'

import { useEffect, useMemo, useState } from 'react'
import { BarChart3, CalendarDays, ChevronDown, Eye, EyeOff, Filter, Truck, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

type Periodo = 'essaSemana' | 'mesAtual' | '30d' | 'mesPassado' | 'custom'
type UserRole = 'admin' | 'comercial' | 'financeiro' | 'driver' | 'operator' | null

interface ComercialUser {
  id: string
  name: string | null
  email: string
  role: string
}

interface RoutePerformanceRow {
  id: string
  freight_id: number | null
  company_name: string | null
  origin: string | null
  origin_state: string | null
  destination: string | null
  destination_state: string | null
  status: 'pending' | 'inTransit' | 'pickedUp' | 'delivered' | 'cancelled'
  nf_value: number | null
  freight_value: number | null
  driver_value: number | null
  taxes_value: number | null
  net_freight_value: number | null
  commission_value: number | null
  distance_km: number | null
  created_at: string
  created_by_user_id: string | null
}

interface UserPerfAgg {
  userId: string
  userName: string
  userEmail: string
  totalFretes: number
  entregues: number
  emAndamento: number
  cancelados: number
  totalNf: number
  totalFreightValue: number
  totalDriverValue: number
  totalTaxesValue: number
  totalNetFreightValue: number
  totalCommissionValue: number
  totalKm: number
}

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatNumber(value: number): string {
  return value.toLocaleString('pt-BR')
}

const MONEY_FIELD_STORAGE_KEY = 'performance:visibleMoneyFields'
const MONEY_FIELD_KEYS = ['freight', 'driver', 'taxes', 'netFreight', 'commission', 'nfTable'] as const
type MoneyFieldKey = (typeof MONEY_FIELD_KEYS)[number]

const ALL_MONEY_VISIBLE: Record<MoneyFieldKey, boolean> = {
  freight: true,
  driver: true,
  taxes: true,
  netFreight: true,
  commission: true,
  nfTable: true,
}

function parseStoredMoneyVisibility(): Record<MoneyFieldKey, boolean> {
  if (typeof window === 'undefined') return { ...ALL_MONEY_VISIBLE }
  try {
    const raw = window.localStorage.getItem(MONEY_FIELD_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Record<MoneyFieldKey, boolean>>
      return { ...ALL_MONEY_VISIBLE, ...parsed }
    }
    const legacy = window.localStorage.getItem('performance:showValues')
    if (legacy === 'false') {
      return Object.fromEntries(MONEY_FIELD_KEYS.map((k) => [k, false])) as Record<MoneyFieldKey, boolean>
    }
  } catch {
    /* ignore */
  }
  return { ...ALL_MONEY_VISIBLE }
}

function MoneyValueRow({
  value,
  visible,
  onToggle,
}: {
  value: number
  visible: boolean
  onToggle: () => void
}) {
  const label = visible ? 'Ocultar este valor' : 'Mostrar este valor'
  return (
    <div className="mt-1 flex items-center justify-between gap-2 min-w-0">
      <p className="text-2xl font-bold text-slate-900 truncate" aria-hidden={!visible}>
        {visible ? formatBRL(value) : 'R$ ••••••'}
      </p>
      <button
        type="button"
        onClick={onToggle}
        className="shrink-0 rounded-lg border border-gray-200 bg-white p-1.5 text-gray-600 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-800/20"
        aria-pressed={visible}
        aria-label={label}
        title={label}
      >
        {visible ? <Eye className="w-4 h-4" aria-hidden /> : <EyeOff className="w-4 h-4" aria-hidden />}
      </button>
    </div>
  )
}

function toNumberOrNull(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  return null
}

/** Ex.: SP > RJ (só UF, para coluna compacta na performance). */
function routeStatesShort(originState: string | null, destState: string | null): string {
  const o = originState?.trim().toUpperCase() || '—'
  const d = destState?.trim().toUpperCase() || '—'
  return `${o} > ${d}`
}

function endOfTodayIso(): string {
  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  return end.toISOString()
}

function toIsoRange(periodo: Periodo, customStart: string, customEnd: string): { fromIso: string; toIso: string } {
  const now = new Date()

  if (periodo === 'custom') {
    const fromDate = customStart ? new Date(`${customStart}T00:00:00`) : new Date(now.getFullYear(), now.getMonth(), 1)
    const toDate = customEnd ? new Date(`${customEnd}T23:59:59`) : now
    return { fromIso: fromDate.toISOString(), toIso: toDate.toISOString() }
  }

  if (periodo === 'essaSemana') {
    // Considera semana iniciando em segunda-feira (padrão BR).
    const day = now.getDay() // 0 = dom, 1 = seg, ..., 6 = sáb
    const diff = (day + 6) % 7 // dias desde a última segunda-feira
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff, 0, 0, 0, 0)
    return { fromIso: from.toISOString(), toIso: endOfTodayIso() }
  }

  if (periodo === 'mesAtual') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0)
    return { fromIso: from.toISOString(), toIso: endOfTodayIso() }
  }

  if (periodo === 'mesPassado') {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0)
    const to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999) // último dia do mês anterior
    return { fromIso: from.toISOString(), toIso: to.toISOString() }
  }

  // '30d' - últimos 30 dias rolling
  const from = new Date()
  from.setDate(now.getDate() - 29)
  from.setHours(0, 0, 0, 0)
  return { fromIso: from.toISOString(), toIso: endOfTodayIso() }
}

export default function PerformancePage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [role, setRole] = useState<UserRole>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserName, setCurrentUserName] = useState<string>('Usuário')
  const [periodo, setPeriodo] = useState<Periodo>('30d')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [rows, setRows] = useState<RoutePerformanceRow[]>([])
  const [comerciais, setComerciais] = useState<ComercialUser[]>([])
  const [selectedComercial, setSelectedComercial] = useState<'all' | string>('all')
  const [visibleMoney, setVisibleMoney] = useState<Record<MoneyFieldKey, boolean>>(ALL_MONEY_VISIBLE)

  useEffect(() => {
    setVisibleMoney(parseStoredMoneyVisibility())
  }, [])

  const toggleMoneyField = (key: MoneyFieldKey) => {
    setVisibleMoney((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(MONEY_FIELD_STORAGE_KEY, JSON.stringify(next))
      }
      return next
    })
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setError(null)

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()
        if (sessionError) throw new Error(sessionError.message)
        if (!session?.user?.id) throw new Error('Sessão não encontrada')

        const uid = session.user.id
        if (cancelled) return
        setCurrentUserId(uid)

        const { data: me, error: meError } = await supabase
          .from('users')
          .select('id, role, name, email')
          .eq('id', uid)
          .single()

        if (meError) {
          console.warn('Performance: não foi possível ler public.users:', meError.message)
        }
        if (cancelled) return

        const sessionEmail = session.user.email ?? ''
        const userRole = (!meError && me?.role ? (me.role as UserRole) : null) ?? null
        setRole(userRole)
        setCurrentUserName(me?.name || me?.email || sessionEmail || 'Usuário')

        const { fromIso, toIso } = toIsoRange(periodo, customStart, customEnd)

        const isAdmin = userRole === 'admin' || userRole === 'financeiro'
        const routesQuery = supabase
          .from('routes')
          .select(
            'id, freight_id, company_name, origin, origin_state, destination, destination_state, status, nf_value, freight_value, driver_value, taxes_value, net_freight_value, commission_value, distance_km, created_at, created_by_user_id',
          )
          .gte('created_at', fromIso)
          .lte('created_at', toIso)
          .order('created_at', { ascending: false })

        // Para admins/financeiro carregamos TODOS os usuários (não só comerciais),
        // para conseguir resolver o nome do vendedor mesmo quando o frete foi criado
        // por outro perfil (admin, etc.). O dropdown de filtro continua focado em
        // vendedores (comercial/operator) porque é o caso de uso principal.
        const usersQuery = isAdmin
          ? supabase
              .from('users')
              .select('id, name, email, role')
              .order('name', { ascending: true })
          : Promise.resolve({ data: [], error: null } as { data: ComercialUser[]; error: null })

        const [routesRes, usersRes] = await Promise.all([routesQuery, usersQuery])

        if (routesRes.error) throw new Error(routesRes.error.message)
        if (usersRes.error) throw new Error(usersRes.error.message)

        const rawRows = (routesRes.data as Record<string, unknown>[] | null) || []

        const normalizedRows: RoutePerformanceRow[] = rawRows.map((r) => ({
          id: String(r.id ?? ''),
          freight_id: typeof r.freight_id === 'number' ? r.freight_id : toNumberOrNull(r.freight_id),
          company_name: typeof r.company_name === 'string' ? r.company_name : null,
          origin: typeof r.origin === 'string' ? r.origin : null,
          origin_state: typeof r.origin_state === 'string' ? r.origin_state : null,
          destination: typeof r.destination === 'string' ? r.destination : null,
          destination_state: typeof r.destination_state === 'string' ? r.destination_state : null,
          status: (r.status as RoutePerformanceRow['status']) ?? 'pending',
          nf_value: toNumberOrNull(r.nf_value),
          freight_value: toNumberOrNull(r.freight_value),
          driver_value: toNumberOrNull(r.driver_value),
          taxes_value: toNumberOrNull(r.taxes_value),
          net_freight_value: toNumberOrNull(r.net_freight_value),
          commission_value: toNumberOrNull(r.commission_value),
          distance_km: toNumberOrNull(r.distance_km),
          created_at: String(r.created_at ?? ''),
          created_by_user_id:
            typeof r.created_by_user_id === 'string' ? r.created_by_user_id : null,
        }))

        /**
         * Admin: todos os fretes do período (visão do time).
         * Demais perfis do painel: mesmos fretes retornados pela query — o RLS já limita o que o usuário pode ver.
         * Antes filtrávamos só por created_by_user_id; fretes antigos ou sem responsável zeravam a tela.
         */
        const scopedRows = isAdmin ? normalizedRows : normalizedRows

        if (cancelled) return
        setRows(scopedRows)
        setComerciais((usersRes.data as ComercialUser[]) || [])
      } catch (err: unknown) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : 'Erro ao carregar performance'
        setError(msg)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [periodo, customStart, customEnd])

  const filteredRows = useMemo(() => {
    if (selectedComercial === 'all') return rows
    if (selectedComercial === '__sem_responsavel__') {
      return rows.filter((r) => !r.created_by_user_id)
    }
    return rows.filter((r) => r.created_by_user_id === selectedComercial)
  }, [rows, selectedComercial])

  const byUser = useMemo(() => {
    const map = new Map<string, UserPerfAgg>()
    const commercialById = new Map(comerciais.map((u) => [u.id, u]))

    filteredRows.forEach((r) => {
      const ownerId = r.created_by_user_id ?? '__sem_responsavel__'
      const user = commercialById.get(ownerId)
      const name = user?.name || user?.email || (ownerId === '__sem_responsavel__' ? 'Sem responsável' : 'Comercial')
      const email = user?.email || '-'

      const existing = map.get(ownerId)
      if (existing) {
        existing.totalFretes += 1
        if (r.status === 'delivered') existing.entregues += 1
        if (r.status === 'cancelled') existing.cancelados += 1
        if (r.status === 'pending' || r.status === 'inTransit' || r.status === 'pickedUp') existing.emAndamento += 1
        existing.totalNf += r.nf_value ?? 0
        existing.totalFreightValue += r.freight_value ?? r.nf_value ?? 0
        existing.totalDriverValue += r.driver_value ?? 0
        existing.totalTaxesValue += r.taxes_value ?? 0
        existing.totalNetFreightValue += r.net_freight_value ?? 0
        existing.totalCommissionValue += r.commission_value ?? 0
        existing.totalKm += r.distance_km ?? 0
        return
      }

      map.set(ownerId, {
        userId: ownerId,
        userName: name,
        userEmail: email,
        totalFretes: 1,
        entregues: r.status === 'delivered' ? 1 : 0,
        cancelados: r.status === 'cancelled' ? 1 : 0,
        emAndamento: r.status === 'pending' || r.status === 'inTransit' || r.status === 'pickedUp' ? 1 : 0,
        totalNf: r.nf_value ?? 0,
        totalFreightValue: r.freight_value ?? r.nf_value ?? 0,
        totalDriverValue: r.driver_value ?? 0,
        totalTaxesValue: r.taxes_value ?? 0,
        totalNetFreightValue: r.net_freight_value ?? 0,
        totalCommissionValue: r.commission_value ?? 0,
        totalKm: r.distance_km ?? 0,
      })
    })

    return Array.from(map.values()).sort((a, b) => b.totalFretes - a.totalFretes)
  }, [filteredRows, comerciais])

  const totals = useMemo(() => {
    const totalFretes = filteredRows.length
    const entregues = filteredRows.filter((r) => r.status === 'delivered').length
    const cancelados = filteredRows.filter((r) => r.status === 'cancelled').length
    const emAndamento = filteredRows.filter((r) => r.status === 'pending' || r.status === 'inTransit' || r.status === 'pickedUp').length
    const totalNf = filteredRows.reduce((sum, r) => sum + (r.nf_value ?? 0), 0)
    const totalFreightValue = filteredRows.reduce((sum, r) => sum + (r.freight_value ?? r.nf_value ?? 0), 0)
    const totalDriverValue = filteredRows.reduce((sum, r) => sum + (r.driver_value ?? 0), 0)
    const totalTaxesValue = filteredRows.reduce((sum, r) => sum + (r.taxes_value ?? 0), 0)
    const totalNetFreightValue = filteredRows.reduce((sum, r) => sum + (r.net_freight_value ?? 0), 0)
    const totalCommissionValue = filteredRows.reduce((sum, r) => sum + (r.commission_value ?? 0), 0)
    const totalKm = filteredRows.reduce((sum, r) => sum + (r.distance_km ?? 0), 0)
    const taxaEntrega = totalFretes > 0 ? (entregues / totalFretes) * 100 : 0
    return { totalFretes, entregues, cancelados, emAndamento, totalNf, totalFreightValue, totalDriverValue, totalTaxesValue, totalNetFreightValue, totalCommissionValue, totalKm, taxaEntrega }
  }, [filteredRows])

  const selectedComercialLabel = useMemo(() => {
    if (selectedComercial === 'all') return 'Todos os vendedores'
    if (selectedComercial === '__sem_responsavel__') return 'Sem responsável'
    const u = comerciais.find((c) => c.id === selectedComercial)
    return u?.name || u?.email || 'Vendedor'
  }, [selectedComercial, comerciais])

  // Map id -> nome/email para resolver o vendedor de cada frete na tabela detalhada.
  const userById = useMemo(() => {
    const map = new Map<string, { name: string; email: string; role: string }>()
    comerciais.forEach((u) => {
      map.set(u.id, {
        name: u.name?.trim() || u.email,
        email: u.email,
        role: u.role,
      })
    })
    return map
  }, [comerciais])

  const detailedRows = useMemo(() => {
    return filteredRows.map((r) => {
      const owner = r.created_by_user_id ? userById.get(r.created_by_user_id) : null
      const isMine = r.created_by_user_id && r.created_by_user_id === currentUserId
      const sellerName = owner?.name || (isMine ? currentUserName : null) || 'Sem responsável'
      const sellerEmail = owner?.email || (isMine ? '' : '')
      const sellerRole = owner?.role || (isMine ? role || '' : '')
      return { route: r, sellerName, sellerEmail, sellerRole }
    })
  }, [filteredRows, userById, currentUserId, currentUserName, role])

  const hasSemResponsavel = useMemo(
    () => rows.some((r) => !r.created_by_user_id),
    [rows],
  )

  const isAdmin = role === 'admin' || role === 'financeiro'

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Performance</h1>
          <p className="text-sm text-gray-600 mt-1">
            {isAdmin
              ? selectedComercial === 'all'
                ? role === 'financeiro'
                  ? 'Visão financeira: performance de todos os comerciais'
                  : 'Visão da performance de todo o time comercial'
                : `Performance de ${selectedComercialLabel}`
              : `Métricas dos fretes no período — ${currentUserName}`}
          </p>
          {!isAdmin && (
            <p className="text-xs text-gray-500 mt-2 max-w-xl">
              Os totais refletem os fretes disponíveis para sua conta no período, incluindo registros antigos sem responsável definido.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <div className="relative">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" aria-hidden />
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" aria-hidden />
              <select
                value={selectedComercial}
                onChange={(e) => setSelectedComercial(e.target.value)}
                className="appearance-none rounded-xl border border-gray-200 bg-white/80 pl-9 pr-8 py-2 text-xs text-gray-700 hover:bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-slate-800/20 cursor-pointer"
                aria-label="Filtrar por vendedor"
              >
                <option value="all">Todos os vendedores ({rows.length})</option>
                {comerciais
                  .filter((u) => u.role === 'comercial' || u.role === 'operator' || u.role === 'admin')
                  .map((u) => {
                    const count = rows.filter((r) => r.created_by_user_id === u.id).length
                    const label = u.name || u.email
                    return (
                      <option key={u.id} value={u.id}>
                        {label} ({count})
                      </option>
                    )
                  })}
                {hasSemResponsavel && (
                  <option value="__sem_responsavel__">
                    Sem responsável ({rows.filter((r) => !r.created_by_user_id).length})
                  </option>
                )}
              </select>
            </div>
          )}
          <div className="relative">
            <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" aria-hidden />
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" aria-hidden />
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value as Periodo)}
              className="appearance-none rounded-xl border border-gray-200 bg-white/80 pl-9 pr-8 py-2 text-xs text-gray-700 hover:bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-slate-800/20 cursor-pointer"
              aria-label="Filtrar por período"
            >
              <option value="essaSemana">Essa semana</option>
              <option value="mesAtual">Mês atual</option>
              <option value="30d">Últimos 30 dias</option>
              <option value="mesPassado">Mês passado</option>
              <option value="custom">Personalizado</option>
            </select>
          </div>
        </div>
      </div>

      {periodo === 'custom' && (
        <div className="glass-card rounded-2xl border border-white/40 p-4 md:p-5 shadow-lg backdrop-blur-xl">
          <div className="flex items-center gap-2 text-gray-700 mb-3">
            <Filter className="w-4 h-4" aria-hidden />
            <span className="text-sm font-semibold">Período personalizado</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="perf-start-date">
                Data inicial
              </label>
              <input
                id="perf-start-date"
                type="date"
                value={customStart}
                max={customEnd || undefined}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-300 bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="perf-end-date">
                Data final
              </label>
              <input
                id="perf-end-date"
                type="date"
                value={customEnd}
                min={customStart || undefined}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-300 bg-white"
              />
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Erro ao carregar a performance: {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-white border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Total de fretes</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatNumber(totals.totalFretes)}</p>
        </div>
        <div className="rounded-2xl bg-white border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Entregues</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{formatNumber(totals.entregues)}</p>
        </div>
        <div className="rounded-2xl bg-white border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Em andamento</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{formatNumber(totals.emAndamento)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <div className="rounded-2xl bg-white border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Valor total dos fretes</p>
          <MoneyValueRow
            value={totals.totalFreightValue}
            visible={visibleMoney.freight}
            onToggle={() => toggleMoneyField('freight')}
          />
        </div>
        <div className="rounded-2xl bg-white border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Valor dos motoristas</p>
          <MoneyValueRow
            value={totals.totalDriverValue}
            visible={visibleMoney.driver}
            onToggle={() => toggleMoneyField('driver')}
          />
        </div>
        <div className="rounded-2xl bg-white border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Valor dos tribultos</p>
          <MoneyValueRow
            value={totals.totalTaxesValue}
            visible={visibleMoney.taxes}
            onToggle={() => toggleMoneyField('taxes')}
          />
        </div>
        <div className="rounded-2xl bg-white border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Valor dos fretes líquidos</p>
          <MoneyValueRow
            value={totals.totalNetFreightValue}
            visible={visibleMoney.netFreight}
            onToggle={() => toggleMoneyField('netFreight')}
          />
        </div>
        <div className="rounded-2xl bg-white border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Valor total de comissões</p>
          <MoneyValueRow
            value={totals.totalCommissionValue}
            visible={visibleMoney.commission}
            onToggle={() => toggleMoneyField('commission')}
          />
        </div>
      </div>

      {isAdmin ? (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-4 md:px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-gray-600" aria-hidden />
              <h2 className="text-sm font-semibold text-gray-800">
                {selectedComercial === 'all'
                  ? 'Performance por comercial'
                  : `Performance — ${selectedComercialLabel}`}
              </h2>
            </div>
            {selectedComercial !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedComercial('all')}
                className="text-xs text-slate-700 hover:text-slate-900 underline underline-offset-2"
              >
                Limpar filtro
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Comercial</th>
                  <th className="text-left px-4 py-3 font-semibold">Fretes</th>
                  <th className="text-left px-4 py-3 font-semibold">Entregues</th>
                  <th className="text-left px-4 py-3 font-semibold">Em andamento</th>
                  <th className="text-left px-4 py-3 font-semibold">Cancelados</th>
                  <th className="text-left px-4 py-3 font-semibold">
                    <div className="flex items-center justify-between gap-2 pr-0">
                      <span>NF total</span>
                      <button
                        type="button"
                        onClick={() => toggleMoneyField('nfTable')}
                        className="shrink-0 rounded-lg border border-gray-200 bg-white p-1.5 text-gray-600 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-800/20"
                        aria-pressed={visibleMoney.nfTable}
                        aria-label={visibleMoney.nfTable ? 'Ocultar valores de NF' : 'Mostrar valores de NF'}
                        title={visibleMoney.nfTable ? 'Ocultar valores de NF' : 'Mostrar valores de NF'}
                      >
                        {visibleMoney.nfTable ? (
                          <Eye className="w-4 h-4" aria-hidden />
                        ) : (
                          <EyeOff className="w-4 h-4" aria-hidden />
                        )}
                      </button>
                    </div>
                  </th>
                  <th className="text-left px-4 py-3 font-semibold">KM total</th>
                </tr>
              </thead>
              <tbody>
                {byUser.map((item) => (
                  <tr key={item.userId} className="border-t border-gray-100">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{item.userName}</p>
                      <p className="text-xs text-gray-500">{item.userEmail}</p>
                    </td>
                    <td className="px-4 py-3">{formatNumber(item.totalFretes)}</td>
                    <td className="px-4 py-3 text-green-700 font-medium">{formatNumber(item.entregues)}</td>
                    <td className="px-4 py-3 text-amber-700 font-medium">{formatNumber(item.emAndamento)}</td>
                    <td className="px-4 py-3 text-rose-700 font-medium">{formatNumber(item.cancelados)}</td>
                    <td className="px-4 py-3">
                      {visibleMoney.nfTable ? formatBRL(item.totalNf) : 'R$ ••••••'}
                    </td>
                    <td className="px-4 py-3">{formatNumber(item.totalKm)} km</td>
                  </tr>
                ))}
                {!loading && byUser.length === 0 && (
                  <tr>
                    <td className="px-4 py-8 text-gray-500" colSpan={7}>
                      Nenhum dado de performance para o período selecionado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* Lista detalhada de fretes com o vendedor responsável */}
      {!loading && detailedRows.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-4 md:px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-gray-600" aria-hidden />
              <h2 className="text-sm font-semibold text-gray-800">
                Lista de fretes — {detailedRows.length}{' '}
                {detailedRows.length === 1 ? 'frete' : 'fretes'}
              </h2>
            </div>
            <span className="text-xs text-gray-500">
              {selectedComercial === 'all'
                ? 'Todos os vendedores'
                : `Filtrado por: ${selectedComercialLabel}`}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">#</th>
                  <th className="text-left px-4 py-3 font-semibold">Cliente</th>
                  <th className="text-left px-4 py-3 font-semibold">Rota</th>
                  <th className="text-left px-4 py-3 font-semibold">Vendedor</th>
                  <th className="text-left px-4 py-3 font-semibold">Status</th>
                  <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Frete</th>
                  <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Comissão</th>
                  <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Data</th>
                </tr>
              </thead>
              <tbody>
                {detailedRows.map(({ route: r, sellerName, sellerEmail, sellerRole }) => {
                  const statusLabel =
                    r.status === 'delivered'
                      ? 'Entregue'
                      : r.status === 'inTransit'
                      ? 'Em trânsito'
                      : r.status === 'pickedUp'
                      ? 'Coletado'
                      : r.status === 'pending'
                      ? 'Pendente'
                      : 'Cancelado'
                  const statusClass =
                    r.status === 'delivered'
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : r.status === 'cancelled'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : r.status === 'inTransit' || r.status === 'pickedUp'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-gray-50 text-gray-700 border-gray-200'
                  const created = r.created_at
                    ? new Date(r.created_at).toLocaleDateString('pt-BR')
                    : '—'
                  return (
                    <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50/60">
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                        {r.freight_id ? `#${r.freight_id}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-900">{r.company_name?.trim() || '—'}</p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p
                          className="text-gray-900 text-sm font-semibold tabular-nums tracking-tight"
                          title={
                            [r.origin, r.origin_state].filter(Boolean).join(', ') +
                            ' → ' +
                            [r.destination, r.destination_state].filter(Boolean).join(', ')
                          }
                        >
                          {routeStatesShort(r.origin_state, r.destination_state)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{sellerName}</p>
                        {sellerEmail ? (
                          <p className="text-xs text-gray-500">{sellerEmail}</p>
                        ) : null}
                        {sellerRole ? (
                          <span className="inline-block mt-0.5 text-[10px] uppercase tracking-wide text-gray-500">
                            {sellerRole}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium ${statusClass}`}
                        >
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {visibleMoney.freight
                          ? formatBRL(r.freight_value ?? r.nf_value ?? 0)
                          : 'R$ ••••••'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {visibleMoney.commission
                          ? formatBRL(r.commission_value ?? 0)
                          : 'R$ ••••••'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                        {created}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {loading && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600 flex items-center gap-2">
          <Truck className="w-4 h-4 animate-pulse" aria-hidden />
          Carregando dados de performance...
        </div>
      )}

      {!loading && filteredRows.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-gray-500">
          Sem registros no período selecionado.
        </div>
      )}
    </div>
  )
}

