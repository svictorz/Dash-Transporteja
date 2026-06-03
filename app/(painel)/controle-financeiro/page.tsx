'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Wallet,
  ShieldAlert,
  Search,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Check,
  X,
  ChevronDown,
  Users as UsersIcon,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useRoutes } from '@/lib/hooks/useRoutes'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import type { Route } from '@/lib/services/routes'
import { formatDateDdMmYyyy } from '@/lib/utils/date-format'
import { isSuperAdminEmail } from '@/lib/utils/roles'
import BrandLoading from '@/components/transporteja/BrandLoading'
import CommissionPaidStatus from '@/components/transporteja/CommissionPaidStatus'
import {
  TAXES_PERCENT_OPTIONS,
  formatBRL,
  getRouteTaxesPercent,
  getRouteTaxesValue,
  getRouteNetFreightValue,
  getRouteCommissionValue,
  normalizeTaxesPercent,
  calculateTaxesValue,
  calculateNetFreightValue,
  calculateCommissionValue,
} from '@/lib/utils/freight-financials'

interface SellerInfo {
  id: string
  name: string | null
  email: string
  role: string
  commission_rate: number | null
}

function statusDisplay(status: Route['status']): { label: string; dot: string } {
  switch (status) {
    case 'inTransit':
      return { label: 'Em trânsito', dot: 'bg-orange-500' }
    case 'delivered':
      return { label: 'Entregue', dot: 'bg-green-500' }
    case 'pickedUp':
      return { label: 'Coletado', dot: 'bg-gray-500' }
    case 'pending':
      return { label: 'Pendente', dot: 'bg-yellow-500' }
    case 'cancelled':
      return { label: 'Cancelado', dot: 'bg-red-500' }
    default:
      return { label: status, dot: 'bg-gray-500' }
  }
}

function routeStatesShort(originState?: string | null, destState?: string | null): string {
  const o = originState?.trim().toUpperCase() || '—'
  const d = destState?.trim().toUpperCase() || '—'
  return `${o} > ${d}`
}

/** Converte "1.234,56" ou "1234.56" em número; vazio → null. */
function parseCurrencyInput(value: string): number | null {
  const normalized = value.trim().replace(/\./g, '').replace(',', '.')
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

const MONEY_STORAGE_KEY = 'controle-financeiro:showValues'

export default function ControleFinanceiroPage() {
  const { user: currentUser, loading: userLoading } = useCurrentUser()
  const { routes, loading: routesLoading, updateRoute } = useRoutes()

  const [sellers, setSellers] = useState<SellerInfo[]>([])
  const [search, setSearch] = useState('')
  const [selectedSeller, setSelectedSeller] = useState<'all' | string>('all')
  const [showValues, setShowValues] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [commissionToggleId, setCommissionToggleId] = useState<string | null>(null)
  const [editFields, setEditFields] = useState({ cteValue: '', valePedagioValue: '', driverValue: '', taxesPercent: '18' })

  const role = currentUser?.role ?? null
  const roleResolved = currentUser?.roleResolved ?? false
  const isStrictAdmin = role === 'admin' || isSuperAdminEmail(currentUser?.email)
  const hasAccess =
    role === 'admin' || role === 'financeiro' || isSuperAdminEmail(currentUser?.email)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(MONEY_STORAGE_KEY)
      if (raw === 'false') setShowValues(false)
    } catch {}
  }, [])

  const toggleShowValues = () => {
    setShowValues((prev) => {
      const next = !prev
      try {
        localStorage.setItem(MONEY_STORAGE_KEY, String(next))
      } catch {}
      return next
    })
  }

  // Carrega vendedores (nome + alíquota de comissão) para resolver o responsável
  // de cada frete e recalcular comissão ao editar. Só admin/financeiro acessam.
  useEffect(() => {
    if (!hasAccess) return
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, role, commission_rate')
        .order('name', { ascending: true })
      if (cancelled || error) return
      setSellers((data as SellerInfo[]) || [])
    })()
    return () => {
      cancelled = true
    }
  }, [hasAccess])

  const sellerById = useMemo(() => {
    const map = new Map<string, SellerInfo>()
    sellers.forEach((s) => map.set(s.id, s))
    return map
  }, [sellers])

  const sellerName = useCallback(
    (route: Route): string => {
      if (!route.created_by_user_id) return 'Sem responsável'
      const s = sellerById.get(route.created_by_user_id)
      return s?.name?.trim() || s?.email || 'Comercial'
    },
    [sellerById],
  )

  const filteredRoutes = useMemo(() => {
    const term = search.trim().toLowerCase()
    return routes.filter((r) => {
      if (selectedSeller === 'all') {
        // sem filtro de vendedor
      } else if (selectedSeller === '__sem_responsavel__') {
        if (r.created_by_user_id) return false
      } else if (r.created_by_user_id !== selectedSeller) {
        return false
      }
      if (!term) return true
      const haystack = [
        String(r.freight_id),
        r.company_name ?? '',
        r.origin,
        r.destination,
        r.origin_state ?? '',
        r.destination_state ?? '',
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(term)
    })
  }, [routes, selectedSeller, search])

  const totals = useMemo(() => {
    return filteredRoutes.reduce(
      (acc, r) => {
        const seller = r.created_by_user_id ? sellerById.get(r.created_by_user_id) : null
        acc.freight += r.freight_value ?? r.nf_value ?? 0
        acc.cte += r.cte_value ?? 0
        acc.pedagio += r.vale_pedagio ?? 0
        acc.driver += r.driver_value ?? 0
        acc.taxes += getRouteTaxesValue(r)
        acc.net += getRouteNetFreightValue(r)
        acc.commission += getRouteCommissionValue(r, seller?.commission_rate ?? null)
        return acc
      },
      { freight: 0, cte: 0, pedagio: 0, driver: 0, taxes: 0, net: 0, commission: 0 },
    )
  }, [filteredRoutes, sellerById])

  const money = useCallback(
    (value: number | null | undefined): string => {
      if (!showValues) return 'R$ ••••'
      if (value == null) return '—'
      return formatBRL(value)
    },
    [showValues],
  )

  const startEdit = useCallback((route: Route) => {
    setEditingId(route.id)
    setEditFields({
      cteValue: route.cte_value != null ? String(route.cte_value).replace('.', ',') : '',
      valePedagioValue: route.vale_pedagio != null ? String(route.vale_pedagio).replace('.', ',') : '',
      driverValue: route.driver_value != null ? String(route.driver_value).replace('.', ',') : '',
      taxesPercent: String(getRouteTaxesPercent(route)),
    })
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingId(null)
  }, [])

  const saveEdit = useCallback(
    async (route: Route) => {
      setSavingId(route.id)
      try {
        const taxesPercent = normalizeTaxesPercent(Number(editFields.taxesPercent))
        const cteValue = parseCurrencyInput(editFields.cteValue)
        const valePedagioValue = parseCurrencyInput(editFields.valePedagioValue)
        const driverValue = parseCurrencyInput(editFields.driverValue)
        const baseFreight = route.freight_value ?? route.nf_value
        const taxesValue = calculateTaxesValue(baseFreight, taxesPercent)
        const netFreightValue = calculateNetFreightValue(baseFreight, driverValue, taxesPercent)
        const sellerRate = route.created_by_user_id
          ? sellerById.get(route.created_by_user_id)?.commission_rate ?? null
          : null
        const commissionValue = calculateCommissionValue(netFreightValue, sellerRate)

        await updateRoute(route.id, {
          cte_value: cteValue,
          vale_pedagio: valePedagioValue,
          driver_value: driverValue,
          taxes_percent: taxesPercent,
          taxes_value: taxesValue,
          net_freight_value: netFreightValue,
          commission_value: commissionValue,
        })
        setEditingId(null)
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Erro ao salvar os valores.')
      } finally {
        setSavingId(null)
      }
    },
    [editFields, sellerById, updateRoute],
  )

  const handleToggleCommissionPaid = useCallback(
    async (route: Route) => {
      if (!isStrictAdmin) return
      setCommissionToggleId(route.id)
      try {
        await updateRoute(route.id, { commission_paid: !route.commission_paid })
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Erro ao atualizar a comissão.')
      } finally {
        setCommissionToggleId(null)
      }
    },
    [isStrictAdmin, updateRoute],
  )

  // ----- Gating de acesso -----
  if (userLoading && !roleResolved) {
    return <BrandLoading message="Verificando permissões…" fullScreen={false} />
  }

  if (roleResolved && !hasAccess) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-700 p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-7 h-7" aria-hidden />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Acesso restrito</h1>
          <p className="text-sm text-gray-600 dark:text-slate-400 mt-2 leading-relaxed">
            O Controle Financeiro está disponível apenas para administradores e o time financeiro.
          </p>
        </div>
      </div>
    )
  }

  const colSpan = 12

  return (
    <div className="max-w-[1500px] mx-auto space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Wallet className="w-6 h-6 text-slate-700 dark:text-slate-200" aria-hidden />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 tracking-tight">
              Controle Financeiro
            </h1>
          </div>
          <p className="text-sm text-gray-600 dark:text-slate-300 mt-1">
            Todos os valores de cada frete para conferência e gestão ·{' '}
            <span className="font-medium">{filteredRoutes.length} fretes</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" aria-hidden />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar frete, cliente, cidade…"
              className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-3 py-2 text-sm text-gray-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-800/20 w-56"
            />
          </div>
          <div className="relative">
            <UsersIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" aria-hidden />
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" aria-hidden />
            <select
              value={selectedSeller}
              onChange={(e) => setSelectedSeller(e.target.value)}
              className="appearance-none rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-8 py-2 text-sm text-gray-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-800/20 cursor-pointer"
              aria-label="Filtrar por vendedor"
            >
              <option value="all">Todos os vendedores</option>
              {sellers
                .filter((s) => s.role === 'comercial' || s.role === 'operator' || s.role === 'admin')
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name || s.email}
                  </option>
                ))}
              <option value="__sem_responsavel__">Sem responsável</option>
            </select>
          </div>
          <button
            type="button"
            onClick={toggleShowValues}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-gray-700 dark:text-slate-100 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
            aria-pressed={showValues}
          >
            {showValues ? <Eye className="w-4 h-4" aria-hidden /> : <EyeOff className="w-4 h-4" aria-hidden />}
            {showValues ? 'Ocultar valores' : 'Mostrar valores'}
          </button>
        </div>
      </div>

      {/* Cards de totais */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {[
          { label: 'Frete', value: totals.freight },
          { label: 'CTE', value: totals.cte },
          { label: 'Vale pedágio', value: totals.pedagio },
          { label: 'Motorista', value: totals.driver },
          { label: 'Tributos', value: totals.taxes },
          { label: 'Líquido', value: totals.net },
          { label: 'Comissão', value: totals.commission },
        ].map((c) => (
          <div
            key={c.label}
            className="rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-600 p-3"
          >
            <p className="text-xs text-gray-500 dark:text-slate-300">{c.label}</p>
            <p className="text-lg font-bold text-gray-900 dark:text-slate-100 mt-1 tabular-nums truncate">
              {money(c.value)}
            </p>
          </div>
        ))}
      </div>

      {/* Tabela */}
      <div className="rounded-2xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Frete</th>
                <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Cliente</th>
                <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Rota</th>
                <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Coleta</th>
                <th className="text-right px-4 py-3 font-semibold whitespace-nowrap">Frete</th>
                <th className="text-right px-4 py-3 font-semibold whitespace-nowrap">CTE</th>
                <th className="text-right px-4 py-3 font-semibold whitespace-nowrap">Vale pedágio</th>
                <th className="text-right px-4 py-3 font-semibold whitespace-nowrap">Motorista</th>
                <th className="text-right px-4 py-3 font-semibold whitespace-nowrap">Tributos</th>
                <th className="text-right px-4 py-3 font-semibold whitespace-nowrap">Líquido</th>
                <th className="text-right px-4 py-3 font-semibold whitespace-nowrap">Comissão</th>
                <th className="text-center px-4 py-3 font-semibold whitespace-nowrap">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {filteredRoutes.map((r) => {
                const seller = r.created_by_user_id ? sellerById.get(r.created_by_user_id) : null
                const pct = getRouteTaxesPercent(r)
                const baseFreight = r.freight_value ?? r.nf_value
                const isEditing = editingId === r.id
                const st = statusDisplay(r.status)

                if (isEditing) {
                  return (
                    <tr key={r.id} className="bg-amber-50/40 dark:bg-amber-950/10">
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900 dark:text-slate-100">
                        #{r.freight_id > 0 ? r.freight_id : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-slate-200">
                        {r.company_name?.trim() || '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700 dark:text-slate-200">
                        {routeStatesShort(r.origin_state, r.destination_state)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700 dark:text-slate-200">
                        {formatDateDdMmYyyy(r.pickup_date) || '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-slate-200">
                        {money(baseFreight)}
                      </td>
                      <td className="px-2 py-3 text-right">
                        <input
                          inputMode="decimal"
                          value={editFields.cteValue}
                          onChange={(e) => setEditFields((p) => ({ ...p, cteValue: e.target.value }))}
                          placeholder="0,00"
                          className="w-24 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-right text-sm text-gray-900 dark:text-slate-100"
                        />
                      </td>
                      <td className="px-2 py-3 text-right">
                        <input
                          inputMode="decimal"
                          value={editFields.valePedagioValue}
                          onChange={(e) => setEditFields((p) => ({ ...p, valePedagioValue: e.target.value }))}
                          placeholder="0,00"
                          className="w-24 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-right text-sm text-gray-900 dark:text-slate-100"
                        />
                      </td>
                      <td className="px-2 py-3 text-right">
                        <input
                          inputMode="decimal"
                          value={editFields.driverValue}
                          onChange={(e) => setEditFields((p) => ({ ...p, driverValue: e.target.value }))}
                          placeholder="0,00"
                          className="w-24 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-right text-sm text-gray-900 dark:text-slate-100"
                        />
                      </td>
                      <td className="px-2 py-3 text-right">
                        <select
                          value={editFields.taxesPercent}
                          onChange={(e) => setEditFields((p) => ({ ...p, taxesPercent: e.target.value }))}
                          className="rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm text-gray-900 dark:text-slate-100"
                        >
                          {TAXES_PERCENT_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}%
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-500 dark:text-slate-400">
                        {money(
                          calculateNetFreightValue(
                            baseFreight,
                            parseCurrencyInput(editFields.driverValue),
                            normalizeTaxesPercent(Number(editFields.taxesPercent)),
                          ),
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-500 dark:text-slate-400">
                        {money(
                          calculateCommissionValue(
                            calculateNetFreightValue(
                              baseFreight,
                              parseCurrencyInput(editFields.driverValue),
                              normalizeTaxesPercent(Number(editFields.taxesPercent)),
                            ),
                            seller?.commission_rate ?? null,
                          ),
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => saveEdit(r)}
                            disabled={savingId === r.id}
                            className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-60"
                            title="Salvar"
                          >
                            {savingId === r.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                            ) : (
                              <Check className="w-4 h-4" aria-hidden />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            disabled={savingId === r.id}
                            className="p-1.5 rounded-lg bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors disabled:opacity-60"
                            title="Cancelar"
                          >
                            <X className="w-4 h-4" aria-hidden />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                }

                return (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900 dark:text-slate-100">
                      #{r.freight_id > 0 ? r.freight_id : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-slate-200">
                      <div className="flex flex-col">
                        <span>{r.company_name?.trim() || '—'}</span>
                        <span className="text-xs text-gray-400 dark:text-slate-400">{sellerName(r)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700 dark:text-slate-200">
                      {routeStatesShort(r.origin_state, r.destination_state)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700 dark:text-slate-200">
                      {formatDateDdMmYyyy(r.pickup_date) || '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-900 dark:text-slate-100">
                      {money(baseFreight)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-slate-200">
                      {money(r.cte_value)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-slate-200">
                      {money(r.vale_pedagio)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-slate-200">
                      {money(r.driver_value)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-slate-200">
                      <span>{money(getRouteTaxesValue(r))}</span>
                      <span className="block text-xs text-gray-400 dark:text-slate-400">{pct}%</span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-gray-900 dark:text-slate-100">
                      {money(getRouteNetFreightValue(r))}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-900 dark:text-slate-100">
                      <span>{money(getRouteCommissionValue(r, seller?.commission_rate ?? null))}</span>
                      <span className="block mt-1">
                        <CommissionPaidStatus
                          paid={r.commission_paid === true}
                          loading={commissionToggleId === r.id}
                          editable={isStrictAdmin}
                          onToggle={() => void handleToggleCommissionPaid(r)}
                        />
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${st.dot}`} aria-hidden />
                          <span className="text-xs text-gray-500 dark:text-slate-300 whitespace-nowrap">{st.label}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => startEdit(r)}
                          className="p-1.5 rounded-lg border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                          title="Editar valores"
                        >
                          <Pencil className="w-4 h-4" aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}

              {!routesLoading && filteredRoutes.length === 0 && (
                <tr>
                  <td colSpan={colSpan} className="px-4 py-12 text-center text-gray-500 dark:text-slate-300">
                    Nenhum frete encontrado.
                  </td>
                </tr>
              )}

              {routesLoading && (
                <tr>
                  <td colSpan={colSpan} className="px-4 py-12 text-center text-gray-500 dark:text-slate-300">
                    <Loader2 className="w-5 h-5 animate-spin inline mr-2" aria-hidden />
                    Carregando fretes…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
