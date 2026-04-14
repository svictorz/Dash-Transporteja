'use client'

import { useEffect, useMemo, useState } from 'react'
import { BarChart3, CalendarDays, Filter, Truck } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

type Periodo = '7d' | '30d' | '90d' | 'mesAtual' | 'custom'
type UserRole = 'admin' | 'comercial' | 'driver' | 'operator' | null

interface ComercialUser {
  id: string
  name: string | null
  email: string
  role: string
}

interface RoutePerformanceRow {
  id: string
  status: 'pending' | 'inTransit' | 'pickedUp' | 'delivered' | 'cancelled'
  nf_value: number | null
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
  totalKm: number
}

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatNumber(value: number): string {
  return value.toLocaleString('pt-BR')
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

  if (periodo === 'mesAtual') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0)
    return { fromIso: from.toISOString(), toIso: endOfTodayIso() }
  }

  const days = periodo === '7d' ? 7 : periodo === '30d' ? 30 : 90
  const from = new Date()
  from.setDate(now.getDate() - (days - 1))
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

        const isAdmin = userRole === 'admin'
        const routesQuery = supabase
          .from('routes')
          .select('id, status, nf_value, distance_km, created_at, created_by_user_id')
          .gte('created_at', fromIso)
          .lte('created_at', toIso)
          .order('created_at', { ascending: false })

        const usersQuery = isAdmin
          ? supabase
              .from('users')
              .select('id, name, email, role')
              .in('role', ['comercial', 'operator'])
              .order('name', { ascending: true })
          : Promise.resolve({ data: [], error: null } as { data: ComercialUser[]; error: null })

        const [routesRes, usersRes] = await Promise.all([routesQuery, usersQuery])

        if (routesRes.error) throw new Error(routesRes.error.message)
        if (usersRes.error) throw new Error(usersRes.error.message)

        const rawRows = (routesRes.data as Record<string, unknown>[] | null) || []

        const normalizedRows: RoutePerformanceRow[] = rawRows.map((r) => ({
          id: String(r.id ?? ''),
          status: (r.status as RoutePerformanceRow['status']) ?? 'pending',
          nf_value: toNumberOrNull(r.nf_value),
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

  const byUser = useMemo(() => {
    const map = new Map<string, UserPerfAgg>()
    const commercialById = new Map(comerciais.map((u) => [u.id, u]))

    rows.forEach((r) => {
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
        totalKm: r.distance_km ?? 0,
      })
    })

    return Array.from(map.values()).sort((a, b) => b.totalFretes - a.totalFretes)
  }, [rows, comerciais])

  const totals = useMemo(() => {
    const totalFretes = rows.length
    const entregues = rows.filter((r) => r.status === 'delivered').length
    const cancelados = rows.filter((r) => r.status === 'cancelled').length
    const emAndamento = rows.filter((r) => r.status === 'pending' || r.status === 'inTransit' || r.status === 'pickedUp').length
    const totalNf = rows.reduce((sum, r) => sum + (r.nf_value ?? 0), 0)
    const totalKm = rows.reduce((sum, r) => sum + (r.distance_km ?? 0), 0)
    const taxaEntrega = totalFretes > 0 ? (entregues / totalFretes) * 100 : 0
    return { totalFretes, entregues, cancelados, emAndamento, totalNf, totalKm, taxaEntrega }
  }, [rows])

  const periodoLabel = useMemo(() => {
    if (periodo === '7d') return 'Últimos 7 dias'
    if (periodo === '30d') return 'Últimos 30 dias'
    if (periodo === '90d') return 'Últimos 90 dias'
    if (periodo === 'mesAtual') return 'Mês atual'
    if (customStart || customEnd) return `${customStart || '...'} até ${customEnd || '...'}`
    return 'Período customizado'
  }, [periodo, customStart, customEnd])

  const isAdmin = role === 'admin'

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Performance</h1>
          <p className="text-sm text-gray-600 mt-1">
            {isAdmin
              ? 'Visão da performance de todo o time comercial'
              : `Métricas dos fretes no período — ${currentUserName}`}
          </p>
          {!isAdmin && (
            <p className="text-xs text-gray-500 mt-2 max-w-xl">
              Os totais refletem os fretes disponíveis para sua conta no período, incluindo registros antigos sem responsável definido.
            </p>
          )}
        </div>
        <div className="rounded-xl border border-gray-200 bg-white/80 px-3 py-2 text-xs text-gray-600 flex items-center gap-2">
          <CalendarDays className="w-4 h-4" aria-hidden />
          {periodoLabel}
        </div>
      </div>

      <div className="glass-card rounded-2xl border border-white/40 p-4 md:p-5 shadow-lg backdrop-blur-xl space-y-4">
        <div className="flex items-center gap-2 text-gray-700">
          <Filter className="w-4 h-4" aria-hidden />
          <span className="text-sm font-semibold">Filtro de período</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { key: '7d', label: '7 dias' },
            { key: '30d', label: '30 dias' },
            { key: '90d', label: '90 dias' },
            { key: 'mesAtual', label: 'Mês atual' },
            { key: 'custom', label: 'Personalizado' },
          ].map((p) => {
            const active = periodo === p.key
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => setPeriodo(p.key as Periodo)}
                className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                  active ? 'bg-slate-800 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {p.label}
              </button>
            )
          })}
        </div>

        {periodo === 'custom' && (
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
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Erro ao carregar a performance: {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
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
        <div className="rounded-2xl bg-white border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Taxa de entrega</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{totals.taxaEntrega.toFixed(1).replace('.', ',')}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Volume NF total</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{formatBRL(totals.totalNf)}</p>
        </div>
        <div className="rounded-2xl bg-white border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Quilometragem total</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{formatNumber(totals.totalKm)} km</p>
        </div>
      </div>

      {isAdmin ? (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-4 md:px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-gray-600" aria-hidden />
            <h2 className="text-sm font-semibold text-gray-800">Performance por comercial</h2>
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
                  <th className="text-left px-4 py-3 font-semibold">NF total</th>
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
                    <td className="px-4 py-3">{formatBRL(item.totalNf)}</td>
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

      {loading && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600 flex items-center gap-2">
          <Truck className="w-4 h-4 animate-pulse" aria-hidden />
          Carregando dados de performance...
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-gray-500">
          Sem registros no período selecionado.
        </div>
      )}
    </div>
  )
}

