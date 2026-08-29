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
  CalendarDays,
  Filter,
  Download,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useRoutes } from '@/lib/hooks/useRoutes'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import type { Route } from '@/lib/services/routes'
import { formatDateDdMmYyyy } from '@/lib/utils/date-format'
import { filterRoutesByDateRange } from '@/lib/utils/route-period-filter'
import { isSuperAdminEmail } from '@/lib/utils/roles'
import { useColumnPrefs, type ColumnDef } from '@/lib/hooks/useColumnPrefs'
import BrandLoading from '@/components/transporteja/BrandLoading'
import ColumnManager from '@/components/transporteja/ColumnManager'
import StickyScrollX from '@/components/transporteja/StickyScrollX'
import CommissionPaidStatus from '@/components/transporteja/CommissionPaidStatus'
import {
  TAXES_PERCENT_CHOICES,
  formatBRL,
  getRouteTaxesPercent,
  getRouteTaxesValue,
  getRouteNetFreightValue,
  getRouteCommissionValue,
  getRouteSeguroPercent,
  getRouteSeguroValue,
  normalizeTaxesPercent,
  normalizeSeguroPercent,
  calculateTaxesValue,
  calculateSeguroValue,
  calculateCommissionValue,
  SEGURO_PERCENT_DEFAULT,
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
const COLUMNS_STORAGE_KEY = 'controle-financeiro:columns'

/** Colunas de dados (a coluna de Ações é sempre a última e não entra aqui). */
const CF_DATA_COLUMNS: ColumnDef[] = [
  { key: 'frete', label: 'Frete', locked: true },
  { key: 'cliente', label: 'Cliente' },
  { key: 'rota', label: 'Rota' },
  { key: 'coleta', label: 'Coleta' },
  { key: 'valorFrete', label: 'Valor frete' },
  { key: 'nf', label: 'NF' },
  { key: 'cte', label: 'CTE' },
  { key: 'pedagio', label: 'Vale pedágio' },
  { key: 'motorista', label: 'Motorista' },
  { key: 'tributos', label: 'Tributos' },
  { key: 'seguro', label: 'Seguro' },
  { key: 'liquido', label: 'Líquido' },
  { key: 'comissao', label: 'Comissão' },
]
const CF_LEFT_COLS = new Set(['frete', 'cliente', 'rota', 'coleta'])
const CF_LABEL_BY_KEY = new Map(CF_DATA_COLUMNS.map((c) => [c.key, c.label]))

export default function ControleFinanceiroPage() {
  const { user: currentUser, loading: userLoading } = useCurrentUser()
  const { routes, loading: routesLoading, updateRoute } = useRoutes()

  const [sellers, setSellers] = useState<SellerInfo[]>([])
  const [search, setSearch] = useState('')
  const [selectedSeller, setSelectedSeller] = useState<'all' | string>('all')
  const [periodo, setPeriodo] = useState<'tudo' | 'mesAtual' | 'mesPassado' | 'custom'>('tudo')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const columnPrefs = useColumnPrefs(COLUMNS_STORAGE_KEY, CF_DATA_COLUMNS)
  const [showValues, setShowValues] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [commissionToggleId, setCommissionToggleId] = useState<string | null>(null)
  const [editFields, setEditFields] = useState({
    freightValue: '',
    nfValue: '',
    cteValue: '',
    valePedagioValue: '',
    valePedagioIncluso: 'false',
    driverValue: '',
    taxesPercent: '18',
    taxesValueManual: '',
    seguroPercent: String(SEGURO_PERCENT_DEFAULT),
    seguroValueManual: '',
  })

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

  // Limites de data conforme o período escolhido. Filtra pela data de coleta
  // (com fallback para a previsão de entrega), igual à Performance.
  const periodBounds = useMemo<{ start: Date | null; end: Date | null }>(() => {
    const now = new Date()
    if (periodo === 'mesAtual') {
      // Mês inteiro (inclui dias futuros do mês), não só até hoje.
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
      return { start, end }
    }
    if (periodo === 'mesPassado') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0)
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
      return { start, end }
    }
    if (periodo === 'custom') {
      const start = customStart ? new Date(`${customStart}T00:00:00`) : null
      const end = customEnd ? new Date(`${customEnd}T23:59:59`) : null
      return { start, end }
    }
    return { start: null, end: null } // 'tudo'
  }, [periodo, customStart, customEnd])

  const filteredRoutes = useMemo(() => {
    const term = search.trim().toLowerCase()
    const byDate = filterRoutesByDateRange(routes, periodBounds.start, periodBounds.end)
    return byDate.filter((r) => {
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
  }, [routes, selectedSeller, search, periodBounds])

  const totals = useMemo(() => {
    return filteredRoutes.reduce(
      (acc, r) => {
        const seller = r.created_by_user_id ? sellerById.get(r.created_by_user_id) : null
        acc.freight += r.freight_value ?? r.nf_value ?? 0
        acc.nf += r.nf_value ?? 0
        acc.cte += r.cte_value ?? 0
        acc.pedagio += r.vale_pedagio ?? 0
        acc.driver += r.driver_value ?? 0
        acc.taxes += getRouteTaxesValue(r)
        acc.seguro += getRouteSeguroValue(r)
        acc.net += getRouteNetFreightValue(r)
        acc.commission += getRouteCommissionValue(r, seller?.commission_rate ?? null)
        return acc
      },
      { freight: 0, nf: 0, cte: 0, pedagio: 0, driver: 0, taxes: 0, seguro: 0, net: 0, commission: 0 },
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

  const handleExportCsv = useCallback(() => {
    // Número no formato pt-BR (vírgula decimal), sem símbolo, para abrir no Excel.
    const num = (v: number | null | undefined) =>
      v == null ? '' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    // Escapa campos para CSV com separador ';'.
    const esc = (v: string | number) => {
      const s = String(v ?? '')
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }

    const headers = [
      'Frete',
      'Cliente',
      'Vendedor',
      'Rota',
      'Coleta',
      'Valor frete',
      'NF',
      'CTE',
      'Vale pedágio',
      'Vale pedágio incluso',
      'Motorista (R$)',
      'Motorista (nome)',
      'Tributos',
      'Tributos %',
      'Seguro',
      'Seguro %',
      'Líquido',
      'Comissão',
      'Comissão paga',
      'Status',
    ]

    const statusLabel = (s: Route['status']) => statusDisplay(s).label

    const lines = filteredRoutes.map((r) => {
      const seller = r.created_by_user_id ? sellerById.get(r.created_by_user_id) : null
      const baseFreight = r.freight_value ?? r.nf_value
      return [
        r.freight_id > 0 ? r.freight_id : '',
        r.company_name?.trim() || '',
        sellerName(r),
        routeStatesShort(r.origin_state, r.destination_state),
        formatDateDdMmYyyy(r.pickup_date) || '',
        num(baseFreight),
        num(r.nf_value),
        num(r.cte_value),
        num(r.vale_pedagio),
        r.vale_pedagio_incluso ? 'Incluso' : 'Não incluso',
        num(r.driver_value),
        r.driver_name?.trim() || '',
        num(getRouteTaxesValue(r)),
        getRouteTaxesPercent(r),
        num(getRouteSeguroValue(r)),
        getRouteSeguroPercent(r),
        num(getRouteNetFreightValue(r)),
        num(getRouteCommissionValue(r, seller?.commission_rate ?? null)),
        r.commission_paid ? 'Pago' : 'Pendente',
        statusLabel(r.status),
      ]
        .map(esc)
        .join(';')
    })

    // BOM (﻿) para o Excel reconhecer UTF-8 (acentos).
    const csv = '﻿' + [headers.map(esc).join(';'), ...lines].join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const stamp = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `controle-financeiro_${periodo}_${stamp}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [filteredRoutes, sellerById, sellerName, periodo])

  const startEdit = useCallback((route: Route) => {
    setEditingId(route.id)
    setEditFields({
      freightValue: route.freight_value != null ? String(route.freight_value).replace('.', ',') : '',
      nfValue: route.nf_value != null ? String(route.nf_value).replace('.', ',') : '',
      cteValue: route.cte_value != null ? String(route.cte_value).replace('.', ',') : '',
      valePedagioValue: route.vale_pedagio != null ? String(route.vale_pedagio).replace('.', ',') : '',
      valePedagioIncluso: route.vale_pedagio_incluso ? 'true' : 'false',
      driverValue: route.driver_value != null ? String(route.driver_value).replace('.', ',') : '',
      taxesPercent: String(getRouteTaxesPercent(route)),
      taxesValueManual: '',
      seguroPercent: String(getRouteSeguroPercent(route)),
      seguroValueManual: route.seguro_value != null ? String(route.seguro_value).replace('.', ',') : '',
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
        // Seguro só pode ser alterado por admin; financeiro mantém o valor atual.
        const seguroPercent = isStrictAdmin
          ? normalizeSeguroPercent(Number(editFields.seguroPercent))
          : getRouteSeguroPercent(route)
        const freightValue = parseCurrencyInput(editFields.freightValue)
        const nfValue = parseCurrencyInput(editFields.nfValue)
        const cteValue = parseCurrencyInput(editFields.cteValue)
        const valePedagioValue = parseCurrencyInput(editFields.valePedagioValue)
        const valePedagioIncluso = editFields.valePedagioIncluso === 'true'
        const driverValue = parseCurrencyInput(editFields.driverValue)
        // Base do frete usa o valor lançado ou, na ausência, a NF editada.
        const baseFreight = freightValue ?? nfValue
        // Tributos: usa o valor digitado manualmente em R$; se em branco, calcula pelo %.
        const manualTaxes = parseCurrencyInput(editFields.taxesValueManual)
        const taxesValue = manualTaxes != null ? manualTaxes : calculateTaxesValue(baseFreight, taxesPercent)
        // Seguro: admin pode digitar o valor em R$; se em branco, calcula pelo %.
        const manualSeguro = isStrictAdmin ? parseCurrencyInput(editFields.seguroValueManual) : null
        const seguroValue = manualSeguro != null ? manualSeguro : calculateSeguroValue(nfValue, seguroPercent)
        const valePedagioDiscount = valePedagioIncluso ? valePedagioValue ?? 0 : 0
        const netFreightValue =
          baseFreight == null
            ? null
            : Math.round((baseFreight - (taxesValue ?? 0) - (driverValue ?? 0) - (seguroValue ?? 0) - valePedagioDiscount) * 100) / 100
        const sellerRate = route.created_by_user_id
          ? sellerById.get(route.created_by_user_id)?.commission_rate ?? null
          : null
        const commissionValue = calculateCommissionValue(netFreightValue, sellerRate)

        await updateRoute(route.id, {
          freight_value: freightValue,
          nf_value: nfValue,
          cte_value: cteValue,
          vale_pedagio: valePedagioValue,
          vale_pedagio_incluso: valePedagioIncluso,
          driver_value: driverValue,
          taxes_percent: taxesPercent,
          taxes_value: taxesValue,
          seguro_percent: seguroPercent,
          seguro_value: seguroValue,
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
    [editFields, sellerById, updateRoute, isStrictAdmin],
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

  /** Conteúdo de uma célula por chave de coluna (exibição ou edição). */
  const renderCell = (
    key: string,
    r: Route,
    ctx: { seller: SellerInfo | null; baseFreight: number | null | undefined; pct: number },
    editing: boolean,
  ) => {
    const { seller, baseFreight, pct } = ctx
    const liveFreightValue = parseCurrencyInput(editFields.freightValue)
    const liveNfValue = parseCurrencyInput(editFields.nfValue)
    const liveBaseFreight = liveFreightValue ?? liveNfValue
    const liveTaxesAuto = calculateTaxesValue(liveBaseFreight, normalizeTaxesPercent(Number(editFields.taxesPercent)))
    const liveTaxesManual = parseCurrencyInput(editFields.taxesValueManual)
    const liveTaxes = liveTaxesManual != null ? liveTaxesManual : liveTaxesAuto
    const liveSeguroPct = isStrictAdmin
      ? normalizeSeguroPercent(Number(editFields.seguroPercent))
      : getRouteSeguroPercent(r)
    const liveSeguroAuto = calculateSeguroValue(liveNfValue, liveSeguroPct)
    const liveSeguroManual = isStrictAdmin ? parseCurrencyInput(editFields.seguroValueManual) : null
    const liveSeguro = liveSeguroManual != null ? liveSeguroManual : liveSeguroAuto
    const liveValePedagio = parseCurrencyInput(editFields.valePedagioValue)
    const liveValePedagioDiscount = editFields.valePedagioIncluso === 'true' ? liveValePedagio ?? 0 : 0
    const liveNet =
      liveBaseFreight == null
        ? null
        : Math.round(
            (
              liveBaseFreight -
              (liveTaxes ?? 0) -
              (parseCurrencyInput(editFields.driverValue) ?? 0) -
              (liveSeguro ?? 0) -
              liveValePedagioDiscount
            ) * 100,
          ) / 100

    switch (key) {
      case 'frete':
        return (
          <span className="font-medium text-gray-900 dark:text-slate-100">
            #{r.freight_id > 0 ? r.freight_id : '—'}
          </span>
        )
      case 'cliente':
        return editing ? (
          <span className="text-gray-700 dark:text-slate-200">{r.company_name?.trim() || '—'}</span>
        ) : (
          <div className="flex flex-col">
            <span className="text-gray-700 dark:text-slate-200">{r.company_name?.trim() || '—'}</span>
            <span className="text-xs text-gray-400 dark:text-slate-400">{sellerName(r)}</span>
          </div>
        )
      case 'rota':
        return <span className="text-gray-700 dark:text-slate-200">{routeStatesShort(r.origin_state, r.destination_state)}</span>
      case 'coleta':
        return <span className="text-gray-700 dark:text-slate-200">{formatDateDdMmYyyy(r.pickup_date) || '—'}</span>
      case 'valorFrete':
        return editing ? (
          <input
            inputMode="decimal"
            value={editFields.freightValue}
            onChange={(e) => setEditFields((p) => ({ ...p, freightValue: e.target.value }))}
            placeholder="0,00"
            className="w-28 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-right text-sm text-gray-900 dark:text-slate-100"
          />
        ) : (
          <span className="text-gray-900 dark:text-slate-100">{money(baseFreight)}</span>
        )
      case 'nf':
        return editing ? (
          <input
            inputMode="decimal"
            value={editFields.nfValue}
            onChange={(e) => setEditFields((p) => ({ ...p, nfValue: e.target.value }))}
            placeholder="0,00"
            className="w-24 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-right text-sm text-gray-900 dark:text-slate-100"
          />
        ) : (
          <span className="text-gray-700 dark:text-slate-200">{money(r.nf_value)}</span>
        )
      case 'cte':
        return editing ? (
          <input
            inputMode="decimal"
            value={editFields.cteValue}
            onChange={(e) => setEditFields((p) => ({ ...p, cteValue: e.target.value }))}
            placeholder="0,00"
            className="w-24 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-right text-sm text-gray-900 dark:text-slate-100"
          />
        ) : (
          <span className="text-gray-700 dark:text-slate-200">{money(r.cte_value)}</span>
        )
      case 'pedagio':
        return editing ? (
          <div className="flex items-end justify-end gap-2">
            <input
              inputMode="decimal"
              value={editFields.valePedagioValue}
              onChange={(e) => setEditFields((p) => ({ ...p, valePedagioValue: e.target.value }))}
              placeholder="0,00"
              className="w-24 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-right text-sm text-gray-900 dark:text-slate-100"
            />
            <label className="flex flex-col items-start gap-1 text-[11px] font-medium text-gray-500 dark:text-slate-400">
              Incluso
              <select
                value={editFields.valePedagioIncluso}
                onChange={(e) => setEditFields((p) => ({ ...p, valePedagioIncluso: e.target.value }))}
                className="h-8 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 text-sm text-gray-900 dark:text-slate-100"
                aria-label="Vale pedágio incluso"
              >
                <option value="true">✅</option>
                <option value="false">❌</option>
              </select>
            </label>
          </div>
        ) : (
          <div className="flex flex-col items-end">
            <span className="text-gray-700 dark:text-slate-200">{money(r.vale_pedagio)}</span>
            <span className="text-xs text-gray-400 dark:text-slate-400">Incluso {r.vale_pedagio_incluso ? '✅' : '❌'}</span>
          </div>
        )
      case 'motorista':
        return editing ? (
          <input
            inputMode="decimal"
            value={editFields.driverValue}
            onChange={(e) => setEditFields((p) => ({ ...p, driverValue: e.target.value }))}
            placeholder="0,00"
            className="w-24 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-right text-sm text-gray-900 dark:text-slate-100"
          />
        ) : (
          <>
            <span className="block text-gray-700 dark:text-slate-200">{money(r.driver_value)}</span>
            <span className="block text-xs text-gray-400 dark:text-slate-400 font-normal truncate max-w-[160px] ml-auto">
              {r.driver_name?.trim() || '—'}
            </span>
          </>
        )
      case 'tributos':
        return editing ? (
          <div className="flex items-center justify-end gap-1.5">
            <select
              value={editFields.taxesPercent}
              onChange={(e) => setEditFields((p) => ({ ...p, taxesPercent: e.target.value }))}
              className="rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm text-gray-900 dark:text-slate-100"
            >
              {TAXES_PERCENT_CHOICES.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}%
                </option>
              ))}
            </select>
            <input
              inputMode="decimal"
              value={editFields.taxesValueManual}
              onChange={(e) => setEditFields((p) => ({ ...p, taxesValueManual: e.target.value }))}
              placeholder={money(liveTaxesAuto ?? 0)}
              title="Deixe em branco para calcular pelo %, ou digite o valor em R$ para sobrescrever"
              className="w-24 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-right text-sm text-gray-900 dark:text-slate-100"
            />
          </div>
        ) : (
          <>
            <span className="text-gray-700 dark:text-slate-200">{money(getRouteTaxesValue(r))}</span>
            <span className="block text-xs text-gray-400 dark:text-slate-400">{pct}%</span>
          </>
        )
      case 'seguro':
        return editing ? (
          isStrictAdmin ? (
            <input
              inputMode="decimal"
              value={editFields.seguroValueManual}
              onChange={(e) => setEditFields((p) => ({ ...p, seguroValueManual: e.target.value }))}
              placeholder="0,00"
              title="Valor do seguro em R$"
              className="w-24 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-right text-sm text-gray-900 dark:text-slate-100"
            />
          ) : (
            <span className="text-xs text-gray-400 dark:text-slate-500" title="Somente admin edita o seguro">
              {money(calculateSeguroValue(r.nf_value, getRouteSeguroPercent(r)))}
            </span>
          )
        ) : (
          <>
            <span className="text-gray-700 dark:text-slate-200">{money(getRouteSeguroValue(r))}</span>
            <span className="block text-xs text-gray-400 dark:text-slate-400">{getRouteSeguroPercent(r)}%</span>
          </>
        )
      case 'liquido':
        return editing ? (
          <span className="text-gray-500 dark:text-slate-400">{money(liveNet)}</span>
        ) : (
          <span className="font-medium text-gray-900 dark:text-slate-100">{money(getRouteNetFreightValue(r))}</span>
        )
      case 'comissao':
        return editing ? (
          <span className="text-gray-500 dark:text-slate-400">
            {money(calculateCommissionValue(liveNet, seller?.commission_rate ?? null))}
          </span>
        ) : (
          <>
            <span className="text-gray-900 dark:text-slate-100">
              {money(getRouteCommissionValue(r, seller?.commission_rate ?? null))}
            </span>
            <span className="block mt-1">
              <CommissionPaidStatus
                paid={r.commission_paid === true}
                loading={commissionToggleId === r.id}
                editable={isStrictAdmin}
                onToggle={() => void handleToggleCommissionPaid(r)}
              />
            </span>
          </>
        )
      default:
        return null
    }
  }

  const cellClass = (key: string) =>
    CF_LEFT_COLS.has(key)
      ? 'px-4 py-3 whitespace-nowrap'
      : 'px-4 py-3 text-right tabular-nums'

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

  const colSpan = columnPrefs.visibleKeys.length + 1

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
            <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" aria-hidden />
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" aria-hidden />
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value as typeof periodo)}
              className="appearance-none rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-8 py-2 text-sm text-gray-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-800/20 cursor-pointer"
              aria-label="Filtrar por período"
            >
              <option value="tudo">Todo período</option>
              <option value="mesAtual">Mês atual</option>
              <option value="mesPassado">Mês passado</option>
              <option value="custom">Personalizado</option>
            </select>
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
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredRoutes.length === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-800 px-3 py-2 text-sm text-white hover:bg-slate-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Exportar os fretes filtrados para CSV (Excel)"
          >
            <Download className="w-4 h-4" aria-hidden />
            Exportar
          </button>
          <ColumnManager
            orderedColumns={columnPrefs.orderedColumns}
            isVisible={columnPrefs.isVisible}
            onToggle={columnPrefs.toggle}
            onMove={columnPrefs.move}
            onReset={columnPrefs.reset}
          />
        </div>
      </div>

      {periodo === 'custom' && (
        <div className="rounded-2xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-center gap-2 text-gray-700 dark:text-slate-200 mb-3">
            <Filter className="w-4 h-4" aria-hidden />
            <span className="text-sm font-semibold">Período personalizado</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 max-w-lg">
            <div>
              <label className="block text-xs text-gray-600 dark:text-slate-300 mb-1" htmlFor="cf-start">
                Data inicial
              </label>
              <input
                id="cf-start"
                type="date"
                value={customStart}
                max={customEnd || undefined}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-slate-300 mb-1" htmlFor="cf-end">
                Data final
              </label>
              <input
                id="cf-end"
                type="date"
                value={customEnd}
                min={customStart || undefined}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-slate-100"
              />
            </div>
          </div>
        </div>
      )}

      {/* Cards de totais */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-9 gap-3">
        {[
          { label: 'Frete', value: totals.freight },
          { label: 'NF', value: totals.nf },
          { label: 'CTE', value: totals.cte },
          { label: 'Vale pedágio', value: totals.pedagio },
          { label: 'Motorista', value: totals.driver },
          { label: 'Tributos', value: totals.taxes },
          { label: 'Seguro', value: totals.seguro },
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
      <div className="rounded-2xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900">
        <StickyScrollX>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-200">
              <tr>
                {columnPrefs.visibleKeys.map((key) => (
                  <th
                    key={key}
                    className={`${CF_LEFT_COLS.has(key) ? 'text-left' : 'text-right'} px-4 py-3 font-semibold whitespace-nowrap`}
                  >
                    {CF_LABEL_BY_KEY.get(key)}
                  </th>
                ))}
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
                const ctx = { seller: seller ?? null, baseFreight, pct }

                return (
                  <tr
                    key={r.id}
                    className={
                      isEditing
                        ? 'bg-amber-50/40 dark:bg-amber-950/10'
                        : 'hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors'
                    }
                  >
                    {columnPrefs.visibleKeys.map((key) => (
                      <td key={key} className={cellClass(key)}>
                        {renderCell(key, r, ctx, isEditing)}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      {isEditing ? (
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
                      ) : (
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
                      )}
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
        </StickyScrollX>
      </div>
    </div>
  )
}
