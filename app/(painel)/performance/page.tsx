'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import {
  BarChart3,
  Building2,
  Calendar,
  CalendarDays,
  ChevronDown,
  Eye,
  EyeOff,
  Filter,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Search,
  Route as RouteIcon,
  Truck,
  Upload,
  Users,
  X,
} from 'lucide-react'
import type { Route } from '@/lib/services/routes'
import { formatCNPJDisplay } from '@/lib/services/cnpj'
import { getClients } from '@/lib/services/clients'
import { validateCNPJ } from '@/lib/utils/validation'
import { supabase } from '@/lib/supabase/client'
import CEPInput from '@/components/transporteja/CEPInput'
import { DATE_BR_NUMERIC, formatDateDdMmYyyy } from '@/lib/utils/date-format'
import {
  ROUTE_PERIOD_FILTER_HINT,
  filterRoutesByDateRange,
} from '@/lib/utils/route-period-filter'
import {
  canEditPerformance,
  canEditPerformanceOperationalFields,
  isGlobalPerformanceViewer,
  isPerformanceSellerRole,
} from '@/lib/utils/roles'
import {
  SEGURO_PERCENT_CHOICES,
  TAXES_PERCENT_CHOICES,
  calculateCommissionValue,
  calculateNetFreightValue,
  calculateSeguroValue,
  calculateTaxesValue,
  formatBRL,
  formatFreightShare,
  getRouteNetFreightValue,
  getRouteDriverTotalValue,
  getRouteSeguroPercent,
  getRouteSeguroValue,
  getRouteTaxesPercent,
  isValePedagioIncluso,
  normalizeSeguroPercent,
  normalizeTaxesPercent,
} from '@/lib/utils/freight-financials'
import { getWhatsAppWebUrl } from '@/lib/utils/whatsapp'
import { useColumnPrefs, type ColumnDef } from '@/lib/hooks/useColumnPrefs'
import ColumnManager from '@/components/transporteja/ColumnManager'
import StickyScrollX from '@/components/transporteja/StickyScrollX'
import CommissionPaidStatus from '@/components/transporteja/CommissionPaidStatus'
import { createFreightDocumentService, type FreightDocument } from '@/lib/services/freight-documents'
import FreightDocumentGallery from '@/components/transporteja/FreightDocumentGallery'
import { PerformanceCharts } from '@/components/performance/PerformanceCharts'

/** Colunas da "Lista de fretes" (a coluna Detalhes fica fora do organizador). */
const PERF_LIST_COLUMNS: ColumnDef[] = [
  { key: 'idFrete', label: 'ID do Frete', locked: true },
  { key: 'pgtoComissao', label: 'Pgto. comissão' },
  { key: 'cliente', label: 'Cliente' },
  { key: 'rota', label: 'Rota' },
  { key: 'vendedor', label: 'Vendedor' },
  { key: 'status', label: 'Status' },
  { key: 'frete', label: 'Frete' },
  { key: 'comissao', label: 'Comissão' },
  { key: 'data', label: 'Data' },
]
const PERF_LABEL_BY_KEY = new Map(PERF_LIST_COLUMNS.map((c) => [c.key, c.label]))
const PERF_LIST_COLUMNS_STORAGE_KEY = 'performance:listColumns'

type Periodo = 'tudo' | 'essaSemana' | 'mesAtual' | '30d' | 'mesPassado' | 'custom'
type UserRole = 'admin' | 'comercial' | 'financeiro' | 'fiscal' | 'supervisor' | 'operacional' | 'driver' | 'operator' | null
type DocumentKey = 'freteDocs'
type RouteDocument = FreightDocument
type RouteStatus = Route['status']
type PaymentStatusFilter = 'all' | 'Pendente' | '50%' | '70%' | '100%'

const PAYMENT_STATUS_FILTER_OPTIONS = ['Pendente', '50%', '70%', '100%'] as const

function paymentStatusFilterValue(status?: string | null): Exclude<PaymentStatusFilter, 'all'> {
  const normalized = status?.trim()
  switch (normalized) {
    case 'pending':
      return 'Pendente'
    case 'paid':
      return '100%'
    case 'partial':
      return '50%'
    default:
      return PAYMENT_STATUS_FILTER_OPTIONS.includes(normalized as Exclude<PaymentStatusFilter, 'all'>)
        ? (normalized as Exclude<PaymentStatusFilter, 'all'>)
        : 'Pendente'
  }
}

const PERF_ROUTE_STATUS_OPTIONS: RouteStatus[] = [
  'pending',
  'pickedUp',
  'inTransit',
  'delivered',
  'documentation',
  'cancelled',
]

interface ComercialUser {
  id: string
  name: string | null
  email: string
  role: string
  commission_rate: number | null
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

function formatNumber(value: number): string {
  return value.toLocaleString('pt-BR')
}

const MONEY_FIELD_STORAGE_KEY = 'performance:visibleMoneyFields'
const MONEY_FIELD_KEYS = ['freight', 'driver', 'taxes', 'netFreight', 'commission', 'nfTable'] as const
type MoneyFieldKey = (typeof MONEY_FIELD_KEYS)[number]

const EMPTY_DOCUMENTS: Record<DocumentKey, RouteDocument[]> = { freteDocs: [] }
const freightDocuments = createFreightDocumentService(supabase.storage.from('checkin-photos'))

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
  totalFreightValue,
}: {
  value: number
  visible: boolean
  onToggle: () => void
  totalFreightValue?: number
}) {
  const label = visible ? 'Ocultar este valor' : 'Mostrar este valor'
  const percentage = visible ? formatFreightShare(value, totalFreightValue) : null
  return (
    <div className="mt-1 flex items-center justify-between gap-2 min-w-0">
      <div className="min-w-0 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
        <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 truncate" aria-hidden={!visible}>
          {visible ? formatBRL(value) : 'R$ ••••••'}
        </p>
        {percentage !== null && (
          <span
            className="text-[11px] font-medium tabular-nums text-gray-400 dark:text-slate-400 whitespace-nowrap"
            title="Percentual sobre o valor total dos fretes filtrados"
          >
            {percentage}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={onToggle}
        className="shrink-0 rounded-lg border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-800 p-1.5 text-gray-600 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-800/20"
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

function toIsoRange(periodo: Periodo, customStart: string, customEnd: string): { fromIso: string; toIso: string } {
  const now = new Date()

  if (periodo === 'tudo') {
    return { fromIso: '2000-01-01T00:00:00.000Z', toIso: endOfTodayIso() }
  }

  if (periodo === 'custom') {
    const fromDate = customStart ? new Date(`${customStart}T00:00:00`) : new Date(now.getFullYear(), now.getMonth(), 1)
    const toDate = customEnd ? new Date(`${customEnd}T23:59:59`) : now
    return { fromIso: fromDate.toISOString(), toIso: toDate.toISOString() }
  }

  if (periodo === 'essaSemana') {
    // Semana inteira (segunda a domingo), incluindo dias futuros da semana —
    // não corta em "hoje", senão fretes com data futura na semana somem.
    const day = now.getDay() // 0 = dom, 1 = seg, ..., 6 = sáb
    const diff = (day + 6) % 7 // dias desde a última segunda-feira
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff, 0, 0, 0, 0)
    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff + 6, 23, 59, 59, 999)
    return { fromIso: from.toISOString(), toIso: to.toISOString() }
  }

  if (periodo === 'mesAtual') {
    // Mês inteiro (inclui dias futuros do mês), não só até hoje.
    const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0)
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    return { fromIso: from.toISOString(), toIso: to.toISOString() }
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

function endOfTodayIso(): string {
  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  return end.toISOString()
}

function periodBoundsFromSelection(
  periodo: Periodo,
  customStart: string,
  customEnd: string,
): { start: Date | null; end: Date | null } {
  const { fromIso, toIso } = toIsoRange(periodo, customStart, customEnd)
  if (periodo === 'tudo') {
    return { start: null, end: null }
  }
  return { start: new Date(fromIso), end: new Date(toIso) }
}

const PERIODO_LABELS: Record<Periodo, string> = {
  tudo: 'Todo período',
  essaSemana: 'Essa semana',
  mesAtual: 'Mês atual',
  '30d': 'Últimos 30 dias',
  mesPassado: 'Mês passado',
  custom: 'Personalizado',
}

function strField(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v)
}

function nullableStr(v: unknown): string | null {
  if (v == null) return null
  const s = typeof v === 'string' ? v : String(v)
  return s.trim() === '' ? null : s
}

function normalizeRouteFromApi(r: Record<string, unknown>): Route {
  const statusRaw = r.status
  const status: Route['status'] =
    statusRaw === 'inTransit' ||
    statusRaw === 'pickedUp' ||
    statusRaw === 'delivered' ||
    statusRaw === 'documentation' ||
    statusRaw === 'cancelled' ||
    statusRaw === 'pending'
      ? statusRaw
      : 'pending'

  return {
    id: String(r.id ?? ''),
    freight_id: toNumberOrNull(r.freight_id) ?? 0,
    driver_id: typeof r.driver_id === 'string' ? r.driver_id : null,
    origin: strField(r.origin),
    origin_state: strField(r.origin_state),
    origin_address: nullableStr(r.origin_address),
    destination: strField(r.destination),
    destination_state: strField(r.destination_state),
    destination_address: nullableStr(r.destination_address),
    vehicle: strField(r.vehicle),
    plate: strField(r.plate),
    weight: strField(r.weight),
    estimated_delivery: strField(r.estimated_delivery),
    pickup_date: strField(r.pickup_date),
    status,
    company_name: nullableStr(r.company_name),
    company_cnpj: nullableStr(r.company_cnpj),
    company_responsible: nullableStr(r.company_responsible),
    company_phone: nullableStr(r.company_phone),
    company_email: nullableStr(r.company_email),
    company_address: nullableStr(r.company_address),
    company_city: nullableStr(r.company_city),
    company_state: nullableStr(r.company_state),
    driver_name: nullableStr(r.driver_name),
    driver_phone: nullableStr(r.driver_phone),
    cubage_m3: toNumberOrNull(r.cubage_m3),
    material_type: nullableStr(r.material_type),
    freight_type: r.freight_type === 'Dedicado' || r.freight_type === 'Fracionado' ? r.freight_type : null,
    distance_km: toNumberOrNull(r.distance_km),
    freight_value: toNumberOrNull(r.freight_value),
    driver_value: toNumberOrNull(r.driver_value),
    financial_calculation_version: toNumberOrNull(r.financial_calculation_version),
    taxes_value: toNumberOrNull(r.taxes_value),
    taxes_percent: ((): Route['taxes_percent'] => {
      const n = toNumberOrNull(r.taxes_percent)
      if (n === 0 || n === 10 || n === 12 || n === 18) return n
      return null
    })(),
    seguro_percent: ((): number | null => {
      const n = toNumberOrNull(r.seguro_percent)
      return n === 0.2 ? 0.2 : n === 0 ? 0 : null
    })(),
    seguro_value: toNumberOrNull(r.seguro_value),
    net_freight_value: toNumberOrNull(r.net_freight_value),
    commission_value: toNumberOrNull(r.commission_value),
    commission_paid: r.commission_paid === true,
    payment_status: nullableStr(r.payment_status),
    payment_type: nullableStr(r.payment_type),
    driver_payment_status: nullableStr(r.driver_payment_status),
    driver_payment_type: nullableStr(r.driver_payment_type),
    nf_value: toNumberOrNull(r.nf_value),
    cte_value: toNumberOrNull(r.cte_value),
    vale_pedagio: toNumberOrNull(r.vale_pedagio),
    vale_pedagio_incluso: typeof r.vale_pedagio_incluso === 'boolean' ? r.vale_pedagio_incluso : null,
    observation: nullableStr(r.observation),
    created_by_user_id: typeof r.created_by_user_id === 'string' ? r.created_by_user_id : null,
    created_at: strField(r.created_at),
    updated_at: strField(r.updated_at),
  }
}

type PerfEditBlockId = 'company' | 'payment' | 'driver' | 'dates' | 'origin' | 'destination' | 'cargo' | 'finance' | 'observation'

function PerfEditBlock({ title, active, saving, canEdit, onEdit, onCancel, onSave, children }: {
  title: string
  active: boolean
  saving: boolean
  canEdit: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: () => void
  children: ReactNode
}) {
  const routeTone = title === 'Origem / Coleta' ? 'bg-blue-50 border-blue-200' : title === 'Destino / Entrega' ? 'bg-green-50 border-green-200' : 'border-gray-200'
  return (
    <section className={`border-t pt-5 [&_label]:text-sm [&_label]:font-semibold [&_select]:rounded-lg [&_select]:border-gray-300 [&_select]:bg-gray-50 [&_select]:px-4 [&_select]:py-3 [&_select]:focus:ring-2 [&_select]:focus:ring-slate-800 ${title === 'Origem / Coleta' || title === 'Destino / Entrega' ? `rounded-lg border p-4 ${routeTone}` : routeTone}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className={`flex items-center gap-2 font-semibold text-gray-900 ${title === 'Origem / Coleta' || title === 'Destino / Entrega' ? 'text-lg' : 'text-sm'}`}>{title === 'Origem / Coleta' || title === 'Destino / Entrega' ? <MapPin className={`h-5 w-5 ${title === 'Origem / Coleta' ? 'text-blue-600' : 'text-green-600'}`} aria-hidden /> : null}{title}</h3>
        {canEdit && (active ? (
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} disabled={saving} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs hover:bg-gray-100">Cancelar</button>
            <button type="button" onClick={onSave} disabled={saving} className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-white hover:bg-slate-900 disabled:opacity-60">{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        ) : <button type="button" onClick={onEdit} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs hover:bg-gray-100">Editar</button>)}
      </div>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  )
}

function perfDetailStatusLabel(s: Route['status']): string {
  switch (s) {
    case 'delivered':
      return 'Entregue'
    case 'documentation':
      return 'Documentação'
    case 'inTransit':
      return 'Em trânsito'
    case 'pickedUp':
      return 'Coletado'
    case 'pending':
      return 'Pendente'
    case 'cancelled':
      return 'Cancelado'
    default:
      return s
  }
}

function perfStatusDisplay(status: Route['status']): { label: string; dotColor: string } {
  switch (status) {
    case 'inTransit':
      return { label: 'Em Trânsito', dotColor: 'bg-orange-500' }
    case 'delivered':
      return { label: 'Entregue', dotColor: 'bg-green-500' }
    case 'documentation':
      return { label: 'Documentação', dotColor: 'bg-blue-500' }
    case 'pickedUp':
      return { label: 'Coletado', dotColor: 'bg-gray-500' }
    case 'pending':
      return { label: 'Pendente', dotColor: 'bg-yellow-500' }
    case 'cancelled':
      return { label: 'Cancelado', dotColor: 'bg-red-500' }
    default:
      return { label: perfDetailStatusLabel(status), dotColor: 'bg-gray-500' }
  }
}

function moneyOrHidden(v: number | null | undefined, visible: boolean): string {
  if (!visible) return 'R$ ••••••'
  if (v == null) return '—'
  return formatBRL(v)
}

export default function PerformancePage() {
  const selectOptionClass = 'bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100'
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [role, setRole] = useState<UserRole>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserName, setCurrentUserName] = useState<string>('Usuário')
  const [periodo, setPeriodo] = useState<Periodo>('mesAtual')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [rows, setRows] = useState<Route[]>([])
  const [comerciais, setComerciais] = useState<ComercialUser[]>([])
  const [selectedComercial, setSelectedComercial] = useState<'all' | string>('all')
  const [commercialSummaryExpanded, setCommercialSummaryExpanded] = useState(true)
  const [clientPaymentStatusFilter, setClientPaymentStatusFilter] = useState<PaymentStatusFilter>('all')
  const [freightStatusFilter, setFreightStatusFilter] = useState<'all' | RouteStatus>('all')
  const [driverPaymentStatusFilter, setDriverPaymentStatusFilter] = useState<PaymentStatusFilter>('all')
  const [didInitSelectedComercial, setDidInitSelectedComercial] = useState(false)
  const [visibleMoney, setVisibleMoney] = useState<Record<MoneyFieldKey, boolean>>(ALL_MONEY_VISIBLE)
  const [selectedPerfRoute, setSelectedPerfRoute] = useState<Route | null>(null)
  const [perfOriginCep, setPerfOriginCep] = useState('')
  const [perfDestinationCep, setPerfDestinationCep] = useState('')
  const [activePerfBlock, setActivePerfBlock] = useState<PerfEditBlockId | null>(null)
  const [searchingPerfCompany, setSearchingPerfCompany] = useState(false)
  const [perfCompanyLookupMessage, setPerfCompanyLookupMessage] = useState('')
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)
  const [documents, setDocuments] = useState<Record<DocumentKey, RouteDocument[]>>(EMPTY_DOCUMENTS)
  const [documentsLoading, setDocumentsLoading] = useState(false)
  const [documentsError, setDocumentsError] = useState<string | null>(null)
  const [documentsRetry, setDocumentsRetry] = useState(0)
  const [uploadingDocument, setUploadingDocument] = useState<DocumentKey | null>(null)
  const [removingDocumentPath, setRemovingDocumentPath] = useState<string | null>(null)
  const [savingObservation, setSavingObservation] = useState(false)
  const [editingObservationValue, setEditingObservationValue] = useState('')
  const [savingFinancial, setSavingFinancial] = useState(false)
  const [editingFields, setEditingFields] = useState({
    cteValue: '',
    valePedagioValue: '',
    valePedagioIncluso: 'true',
    driverValue: '',
    taxesPercent: '18',
    seguroPercent: '0.2',
  })
  const [savingFreightInfo, setSavingFreightInfo] = useState(false)
  const [editingFreightInfoFields, setEditingFreightInfoFields] = useState({
    companyName: '',
    companyCnpj: '',
    companyResponsible: '',
    companyPhone: '',
    companyEmail: '',
    origin: '',
    originState: '',
    originAddress: '',
    destination: '',
    destinationState: '',
    destinationAddress: '',
    weight: '',
    cubageM3: '',
    materialType: '',
    pickupDate: '',
    estimatedDelivery: '',
    paymentStatus: '',
    paymentType: '',
    freightType: '',
    status: 'pending' as RouteStatus,
    nfValue: '',
    freightValue: '',
  })
  const [savingDriver, setSavingDriver] = useState(false)
  const [editingDriverFields, setEditingDriverFields] = useState({
    driverName: '',
    driverPhone: '',
    driverPaymentStatus: '',
    driverPaymentType: '',
    vehicle: '',
    plate: '',
  })
  const [commissionToggleRouteId, setCommissionToggleRouteId] = useState<string | null>(null)
  const listColumns = useColumnPrefs(PERF_LIST_COLUMNS_STORAGE_KEY, PERF_LIST_COLUMNS)

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
    setSelectedPerfRoute(null)
    setDocuments(EMPTY_DOCUMENTS)
    setSelectedPhoto(null)
    setUploadingDocument(null)
    setRemovingDocumentPath(null)
  }, [periodo, customStart, customEnd, selectedComercial, clientPaymentStatusFilter, freightStatusFilter, driverPaymentStatusFilter])

  useEffect(() => {
    if (!selectedPerfRoute) {
      setActivePerfBlock(null)
      setDocuments(EMPTY_DOCUMENTS)
      setDocumentsError(null)
      setDocumentsLoading(false)
      setSelectedPhoto(null)
      setUploadingDocument(null)
      setRemovingDocumentPath(null)
      return
    }

    setEditingFields({
      cteValue:
        selectedPerfRoute.cte_value != null ? String(selectedPerfRoute.cte_value).replace('.', ',') : '',
      valePedagioValue:
        selectedPerfRoute.vale_pedagio != null ? String(selectedPerfRoute.vale_pedagio).replace('.', ',') : '',
      valePedagioIncluso: isValePedagioIncluso(selectedPerfRoute.vale_pedagio_incluso) ? 'true' : 'false',
      driverValue:
        selectedPerfRoute.driver_value != null ? String(selectedPerfRoute.driver_value).replace('.', ',') : '',
      taxesPercent: String(getRouteTaxesPercent(selectedPerfRoute)),
      seguroPercent: String(getRouteSeguroPercent(selectedPerfRoute)),
    })
    setEditingDriverFields({
      driverName: selectedPerfRoute.driver_name ?? '',
      driverPhone: selectedPerfRoute.driver_phone ?? '',
      driverPaymentStatus: selectedPerfRoute.driver_payment_status ?? '',
      driverPaymentType: selectedPerfRoute.driver_payment_type ?? '',
      vehicle: selectedPerfRoute.vehicle ?? '',
      plate: selectedPerfRoute.plate ?? '',
    })
    setEditingFreightInfoFields({
      companyName: selectedPerfRoute.company_name ?? '',
      companyCnpj: selectedPerfRoute.company_cnpj ?? '',
      companyResponsible: selectedPerfRoute.company_responsible ?? '',
      companyPhone: selectedPerfRoute.company_phone ?? '',
      companyEmail: selectedPerfRoute.company_email ?? '',
      origin: selectedPerfRoute.origin ?? '',
      originState: selectedPerfRoute.origin_state ?? '',
      originAddress: selectedPerfRoute.origin_address ?? '',
      destination: selectedPerfRoute.destination ?? '',
      destinationState: selectedPerfRoute.destination_state ?? '',
      destinationAddress: selectedPerfRoute.destination_address ?? '',
      weight: selectedPerfRoute.weight ?? '',
      cubageM3: selectedPerfRoute.cubage_m3 != null ? String(selectedPerfRoute.cubage_m3).replace('.', ',') : '',
      materialType: selectedPerfRoute.material_type ?? '',
      pickupDate: selectedPerfRoute.pickup_date ?? '',
      estimatedDelivery: selectedPerfRoute.estimated_delivery ?? '',
      paymentStatus: selectedPerfRoute.payment_status ?? '',
      paymentType: selectedPerfRoute.payment_type ?? '',
      freightType: selectedPerfRoute.freight_type ?? '',
      status: selectedPerfRoute.status,
      nfValue: selectedPerfRoute.nf_value != null ? String(selectedPerfRoute.nf_value).replace('.', ',') : '',
      freightValue: selectedPerfRoute.freight_value != null ? String(selectedPerfRoute.freight_value).replace('.', ',') : '',
    })
    setEditingObservationValue(selectedPerfRoute.observation ?? '')
    setActivePerfBlock(null)
    setPerfOriginCep('')
    setPerfDestinationCep('')
    setPerfCompanyLookupMessage('')

    let cancelled = false
    setDocuments(EMPTY_DOCUMENTS)
    setDocumentsError(null)
    setDocumentsLoading(true)
    ;(async () => {
      try {
        const docs = await freightDocuments.list(selectedPerfRoute.id)
        if (cancelled) return
        setDocuments({ freteDocs: docs })
      } catch {
        if (!cancelled) setDocumentsError('Não foi possível carregar os anexos deste frete.')
      } finally {
        if (!cancelled) setDocumentsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [selectedPerfRoute, documentsRetry])

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

        const canViewGlobalPerformance = isGlobalPerformanceViewer(userRole)

        // Default do filtro de vendedor: admin/financeiro/fiscal abrem com o time
        // inteiro (senão a tela zera quando a conta do gestor não criou fretes
        // próprios); demais perfis abrem com os próprios registros.
        if (!didInitSelectedComercial) {
          setSelectedComercial(canViewGlobalPerformance ? 'all' : uid)
          setDidInitSelectedComercial(true)
        }

        const routesQuery = supabase
          .from('routes')
          .select('*')
          .order('pickup_date', { ascending: false })

        // Para admins/financeiro/fiscal carregamos TODOS os usuários (não só comerciais),
        // para conseguir resolver o nome do vendedor mesmo quando o frete foi criado
        // por outro perfil (admin, etc.). O dropdown de filtro continua focado em
        // vendedores (comercial/operator) porque é o caso de uso principal.
        const usersQuery = canViewGlobalPerformance
          ? supabase
              .from('users')
              .select('id, name, email, role, commission_rate')
              .order('name', { ascending: true })
          : Promise.resolve({ data: [], error: null } as { data: ComercialUser[]; error: null })

        const [routesRes, usersRes] = await Promise.all([routesQuery, usersQuery])

        if (routesRes.error) throw new Error(routesRes.error.message)
        if (usersRes.error) throw new Error(usersRes.error.message)

        const rawRows = (routesRes.data as Record<string, unknown>[] | null) || []

        const normalizedRows: Route[] = rawRows.map((r) => normalizeRouteFromApi(r))

        /**
         * Admin: todos os fretes do período (visão do time).
         * Demais perfis do painel: mesmos fretes retornados pela query — o RLS já limita o que o usuário pode ver.
         * Antes filtrávamos só por created_by_user_id; fretes antigos ou sem responsável zeravam a tela.
         */
        const scopedRows = canViewGlobalPerformance ? normalizedRows : normalizedRows

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
  }, [didInitSelectedComercial])

  const periodBounds = useMemo(
    () => periodBoundsFromSelection(periodo, customStart, customEnd),
    [periodo, customStart, customEnd],
  )

  const periodRows = useMemo(
    () => filterRoutesByDateRange(rows, periodBounds.start, periodBounds.end),
    [rows, periodBounds],
  )

  const filteredRows = useMemo(() => {
    const sellerRows =
      selectedComercial === 'all'
        ? periodRows
        : selectedComercial === '__sem_responsavel__'
          ? periodRows.filter((r) => !r.created_by_user_id)
          : periodRows.filter((r) => r.created_by_user_id === selectedComercial)

    return sellerRows.filter((r) => {
      const matchesClientPayment =
        clientPaymentStatusFilter === 'all' || paymentStatusFilterValue(r.payment_status) === clientPaymentStatusFilter
      const matchesFreightStatus = freightStatusFilter === 'all' || r.status === freightStatusFilter
      const matchesDriverPayment =
        driverPaymentStatusFilter === 'all' || paymentStatusFilterValue(r.driver_payment_status) === driverPaymentStatusFilter

      return matchesClientPayment && matchesFreightStatus && matchesDriverPayment
    })
  }, [periodRows, selectedComercial, clientPaymentStatusFilter, freightStatusFilter, driverPaymentStatusFilter])

  // O gráfico de cadastros usa created_at dentro do período, enquanto os demais
  // indicadores usam a data operacional da coleta (ou da entrega).
  const activityRows = useMemo(() => rows.filter((route) => {
    const owner = route.created_by_user_id ?? '__sem_responsavel__'
    return (selectedComercial === 'all' || owner === selectedComercial)
      && (clientPaymentStatusFilter === 'all' || paymentStatusFilterValue(route.payment_status) === clientPaymentStatusFilter)
      && (freightStatusFilter === 'all' || route.status === freightStatusFilter)
      && (driverPaymentStatusFilter === 'all' || paymentStatusFilterValue(route.driver_payment_status) === driverPaymentStatusFilter)
  }), [rows, selectedComercial, clientPaymentStatusFilter, freightStatusFilter, driverPaymentStatusFilter])

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
        existing.totalDriverValue += getRouteDriverTotalValue(r)
        existing.totalTaxesValue += r.taxes_value ?? 0
        existing.totalNetFreightValue += getRouteNetFreightValue(r)
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
        totalDriverValue: getRouteDriverTotalValue(r),
        totalTaxesValue: r.taxes_value ?? 0,
        totalNetFreightValue: getRouteNetFreightValue(r),
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
    const totalDriverValue = filteredRows.reduce((sum, r) => sum + getRouteDriverTotalValue(r), 0)
    const totalTaxesValue = filteredRows.reduce((sum, r) => sum + (r.taxes_value ?? 0), 0)
    const totalNetFreightValue = filteredRows.reduce((sum, r) => sum + getRouteNetFreightValue(r), 0)
    const totalCommissionValue = filteredRows.reduce((sum, r) => sum + (r.commission_value ?? 0), 0)
    const totalKm = filteredRows.reduce((sum, r) => sum + (r.distance_km ?? 0), 0)
    const taxaEntrega = totalFretes > 0 ? (entregues / totalFretes) * 100 : 0
    return { totalFretes, entregues, cancelados, emAndamento, totalNf, totalFreightValue, totalDriverValue, totalTaxesValue, totalNetFreightValue, totalCommissionValue, totalKm, taxaEntrega }
  }, [filteredRows])

  const selectedComercialLabel = useMemo(() => {
    if (selectedComercial === 'all') return 'Time inteiro'
    if (selectedComercial === '__sem_responsavel__') return 'Sem responsável'
    const u = comerciais.find((c) => c.id === selectedComercial)
    return u?.name || u?.email || 'Vendedor'
  }, [selectedComercial, comerciais])

  // Map id -> nome/email para resolver o vendedor de cada frete na tabela detalhada.
  const userById = useMemo(() => {
    const map = new Map<string, { name: string; email: string; role: string; commission_rate: number | null }>()
    comerciais.forEach((u) => {
      map.set(u.id, {
        name: u.name?.trim() || u.email,
        email: u.email,
        role: u.role,
        commission_rate: u.commission_rate,
      })
    })
    return map
  }, [comerciais])

  const statusFilteredRows = filteredRows

  const detailedRows = useMemo(() => {
    return statusFilteredRows.map((r) => {
      const owner = r.created_by_user_id ? userById.get(r.created_by_user_id) : null
      const isMine = r.created_by_user_id && r.created_by_user_id === currentUserId
      const sellerName = owner?.name || (isMine ? currentUserName : null) || 'Sem responsável'
      const sellerCommissionRate = owner?.commission_rate ?? null
      return { route: r, sellerName, sellerCommissionRate }
    })
  }, [statusFilteredRows, userById, currentUserId, currentUserName, role])

  const hasSemResponsavel = useMemo(
    () => periodRows.some((r) => !r.created_by_user_id),
    [periodRows],
  )

  const canViewGlobalPerformance = isGlobalPerformanceViewer(role)
  const isStrictAdmin = role === 'admin'
  const canManagePerfModal = canEditPerformance(role)
  const canEditOperationalFields = canEditPerformanceOperationalFields(role)
  const canViewPerfModalDetails = canManagePerfModal || role === 'supervisor' || role === 'operacional'
  const canEditPerfSeguro = canEditOperationalFields
  /** Coluna Rotas: gestores/supervisor veem detalhe na própria página; demais veem os próprios fretes. */
  const showRotasColumn = useMemo(
    () =>
      Boolean(
        currentUserId &&
          detailedRows.length > 0 &&
          (canViewGlobalPerformance ||
            detailedRows.some(({ route: r }) => r.created_by_user_id && r.created_by_user_id === currentUserId)),
      ),
    [currentUserId, detailedRows, canViewGlobalPerformance],
  )

  const parseCurrencyInput = useCallback((value: string) => {
    const normalized = value.trim().replace(/\./g, '').replace(',', '.')
    if (!normalized) return null
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }, [])

  const handleToggleCommissionPaid = useCallback(
    async (route: Route) => {
      if (!isStrictAdmin) return
      const nextPaid = !route.commission_paid
      setCommissionToggleRouteId(route.id)
      try {
        const { data, error: updateError } = await supabase
          .from('routes')
          .update({ commission_paid: nextPaid })
          .eq('id', route.id)
          .select('*')
          .single()

        if (updateError) throw new Error(updateError.message)
        const updatedRoute = normalizeRouteFromApi((data as Record<string, unknown>) || {})
        setRows((prev) => prev.map((r) => (r.id === updatedRoute.id ? updatedRoute : r)))
        setSelectedPerfRoute((prev) => (prev?.id === updatedRoute.id ? updatedRoute : prev))
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Erro ao atualizar o status da comissão.'
        alert(msg)
      } finally {
        setCommissionToggleRouteId(null)
      }
    },
    [isStrictAdmin],
  )

  const handleSaveObservation = useCallback(async () => {
    if (!selectedPerfRoute || !canManagePerfModal) return
    try {
      setSavingObservation(true)
      const { data, error: updateError } = await supabase.rpc('update_route_observation', {
        p_route_id: selectedPerfRoute.id,
        p_observation: editingObservationValue,
      })

      if (updateError) throw new Error(updateError.message)
      const updatedRoute = normalizeRouteFromApi((data as Record<string, unknown>) || {})
      setRows((prev) => prev.map((r) => (r.id === updatedRoute.id ? updatedRoute : r)))
      setSelectedPerfRoute(updatedRoute)
      setActivePerfBlock(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao salvar observações.')
    } finally {
      setSavingObservation(false)
    }
  }, [selectedPerfRoute, canManagePerfModal, editingObservationValue])

  const handleSavePerfInfoBlock = useCallback(async (block: PerfEditBlockId) => {
    if (!selectedPerfRoute || !canManagePerfModal) return
    const draft = editingFreightInfoFields
    const updatePayload: Partial<Route> = {}
    if (block === 'company') {
      if (!draft.companyName.trim()) { alert('Informe o nome da empresa.'); return }
      if (draft.companyCnpj.trim() && !validateCNPJ(draft.companyCnpj).valid) { alert('Informe um CNPJ válido.'); return }
      updatePayload.company_name = draft.companyName.trim()
      updatePayload.company_cnpj = draft.companyCnpj.trim() ? formatCNPJDisplay(draft.companyCnpj) : null
      updatePayload.company_responsible = draft.companyResponsible.trim() || null
      updatePayload.company_phone = draft.companyPhone.trim() || null
      updatePayload.company_email = draft.companyEmail.trim() || null
    } else if (block === 'payment') {
      updatePayload.status = draft.status
      updatePayload.payment_status = draft.paymentStatus || null
      updatePayload.payment_type = draft.paymentType || null
      updatePayload.freight_type = draft.freightType === 'Dedicado' || draft.freightType === 'Fracionado' ? draft.freightType : null
    } else if (block === 'dates') {
      updatePayload.pickup_date = draft.pickupDate
      updatePayload.estimated_delivery = draft.estimatedDelivery
    } else if (block === 'origin' || block === 'destination') {
      const city = block === 'origin' ? draft.origin.trim() : draft.destination.trim()
      const state = (block === 'origin' ? draft.originState : draft.destinationState).trim().toUpperCase()
      if (!city || !/^[A-Z]{2}$/.test(state)) { alert('Preencha cidade e UF com 2 letras.'); return }
      if (block === 'origin') {
        updatePayload.origin = city
        updatePayload.origin_state = state
        updatePayload.origin_address = draft.originAddress.trim() || null
      } else {
        updatePayload.destination = city
        updatePayload.destination_state = state
        updatePayload.destination_address = draft.destinationAddress.trim() || null
      }
    } else if (block === 'cargo') {
      if (!draft.weight.trim()) { alert('Preencha o peso do frete.'); return }
      const cubageText = draft.cubageM3.trim()
      const cubage = cubageText ? Number(cubageText.includes(',') ? cubageText.replace(/\./g, '').replace(',', '.') : cubageText) : null
      if (cubageText && (cubage == null || !Number.isFinite(cubage) || cubage < 0 || cubage >= 1_000_000_000)) { alert('Informe uma cubagem válida.'); return }
      const nfValue = parseCurrencyInput(draft.nfValue)
      updatePayload.weight = draft.weight.trim()
      updatePayload.cubage_m3 = cubage
      updatePayload.material_type = draft.materialType.trim() || null
      updatePayload.nf_value = nfValue
      const baseFreight = selectedPerfRoute.freight_value ?? nfValue
      const taxesPercent = getRouteTaxesPercent(selectedPerfRoute)
      const seguroValue = calculateSeguroValue(nfValue, getRouteSeguroPercent(selectedPerfRoute))
      const netValue = calculateNetFreightValue(baseFreight, selectedPerfRoute.driver_value, taxesPercent, seguroValue, selectedPerfRoute.vale_pedagio, selectedPerfRoute.vale_pedagio_incluso)
      const sellerRate = selectedPerfRoute.created_by_user_id ? comerciais.find((u) => u.id === selectedPerfRoute.created_by_user_id)?.commission_rate ?? null : null
      updatePayload.taxes_value = calculateTaxesValue(baseFreight, taxesPercent)
      updatePayload.seguro_value = seguroValue
      updatePayload.net_freight_value = netValue
      updatePayload.commission_value = calculateCommissionValue(netValue, sellerRate)
    } else return
    try {
      setSavingFreightInfo(true)
      const { data, error: updateError } = await supabase.from('routes').update(updatePayload).eq('id', selectedPerfRoute.id).select('*').single()
      if (updateError) throw new Error(updateError.message)
      const updatedRoute = normalizeRouteFromApi((data as Record<string, unknown>) || {})
      setRows((prev) => prev.map((r) => r.id === updatedRoute.id ? updatedRoute : r))
      setSelectedPerfRoute(updatedRoute)
      setActivePerfBlock(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao salvar o bloco.')
    } finally { setSavingFreightInfo(false) }
  }, [selectedPerfRoute, canManagePerfModal, editingFreightInfoFields, parseCurrencyInput, comerciais])

  const handleSearchPerfCompany = useCallback(async () => {
    const digits = editingFreightInfoFields.companyCnpj.replace(/\D/g, '')
    const validation = validateCNPJ(digits)
    if (!validation.valid) { setPerfCompanyLookupMessage(validation.error || 'CNPJ inválido.'); return }
    try {
      setSearchingPerfCompany(true)
      const clients = await getClients()
      const client = clients.find((item) => item.cnpj?.replace(/\D/g, '') === digits)
      if (!client) { setPerfCompanyLookupMessage('Empresa não encontrada. Preencha os campos para atualizar este frete.'); return }
      setEditingFreightInfoFields((prev) => ({ ...prev, companyCnpj: formatCNPJDisplay(digits), companyName: client.company_name, companyResponsible: client.responsible || '', companyPhone: client.whatsapp || '', companyEmail: client.email || '' }))
      setPerfCompanyLookupMessage('Empresa encontrada no cadastro.')
    } catch { setPerfCompanyLookupMessage('Não foi possível consultar os clientes. Tente novamente.') }
    finally { setSearchingPerfCompany(false) }
  }, [editingFreightInfoFields.companyCnpj])

  const handleSaveFinancialFields = useCallback(async () => {
    if (!selectedPerfRoute || !canEditOperationalFields) return
    try {
      setSavingFinancial(true)
      const taxesPercent = normalizeTaxesPercent(Number(editingFields.taxesPercent))
      const seguroPercent = canEditPerfSeguro
        ? normalizeSeguroPercent(Number(editingFields.seguroPercent))
        : getRouteSeguroPercent(selectedPerfRoute)
      const cteValue = parseCurrencyInput(editingFields.cteValue)
      const valePedagioValue = parseCurrencyInput(editingFields.valePedagioValue)
      const valePedagioIncluso = editingFields.valePedagioIncluso === 'true'
      const driverValue = parseCurrencyInput(editingFields.driverValue)
      const freightValue = parseCurrencyInput(editingFreightInfoFields.freightValue)
      const baseFreight = freightValue ?? selectedPerfRoute.nf_value
      const taxesValue = calculateTaxesValue(baseFreight, taxesPercent)
      const seguroValue = calculateSeguroValue(selectedPerfRoute.nf_value, seguroPercent)
      const netFreightValue = calculateNetFreightValue(
        baseFreight,
        driverValue,
        taxesPercent,
        seguroValue,
        valePedagioValue,
        valePedagioIncluso,
      )
      const sellerRate = selectedPerfRoute.created_by_user_id
        ? (comerciais.find((u) => u.id === selectedPerfRoute.created_by_user_id)?.commission_rate ?? null)
        : null
      const commissionValue = calculateCommissionValue(netFreightValue, sellerRate)

      const updatePayload: Partial<Route> = {
        ...(canManagePerfModal ? { freight_value: freightValue } : {}),
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
      }

      // Operacional envia apenas os campos autorizados. O banco recalcula os derivados.
      if (role === 'operacional') {
        delete updatePayload.taxes_value
        delete updatePayload.seguro_value
        delete updatePayload.net_freight_value
        delete updatePayload.commission_value
      }

      const { data, error: updateError } = await supabase
        .from('routes')
        .update(updatePayload)
        .eq('id', selectedPerfRoute.id)
        .select('*')
        .single()

      if (updateError) throw new Error(updateError.message)
      const updatedRoute = normalizeRouteFromApi((data as Record<string, unknown>) || {})
      setRows((prev) => prev.map((r) => (r.id === updatedRoute.id ? updatedRoute : r)))
      setSelectedPerfRoute(updatedRoute)
      setActivePerfBlock(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar campos financeiros.'
      alert(msg)
    } finally {
      setSavingFinancial(false)
    }
  }, [selectedPerfRoute, canEditOperationalFields, editingFields, editingFreightInfoFields.freightValue, parseCurrencyInput, canEditPerfSeguro, canManagePerfModal, comerciais, role])

  const handleSaveDriverFields = useCallback(async () => {
    if (!selectedPerfRoute || !canEditOperationalFields) return
    try {
      setSavingDriver(true)
      const updatePayload = {
        driver_name: editingDriverFields.driverName.trim() || null,
        driver_phone: editingDriverFields.driverPhone.trim() || null,
        driver_payment_status: editingDriverFields.driverPaymentStatus.trim() || null,
        driver_payment_type: editingDriverFields.driverPaymentType.trim() || null,
        vehicle: editingDriverFields.vehicle.trim() || null,
        plate: editingDriverFields.plate.trim() || null,
        ...(canManagePerfModal ? {
          pickup_date: editingFreightInfoFields.pickupDate || null,
          estimated_delivery: editingFreightInfoFields.estimatedDelivery || null,
        } : {}),
      }
      const { data, error: updateError } = await supabase
        .from('routes')
        .update(updatePayload)
        .eq('id', selectedPerfRoute.id)
        .select('*')
        .single()
      if (updateError) throw new Error(updateError.message)
      const updatedRoute = normalizeRouteFromApi((data as Record<string, unknown>) || {})
      setRows((prev) => prev.map((r) => (r.id === updatedRoute.id ? updatedRoute : r)))
      setSelectedPerfRoute(updatedRoute)
      setActivePerfBlock(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao salvar dados do motorista.')
    } finally {
      setSavingDriver(false)
    }
  }, [selectedPerfRoute, canEditOperationalFields, canManagePerfModal, editingDriverFields, editingFreightInfoFields.pickupDate, editingFreightInfoFields.estimatedDelivery])

  const handleUploadDocuments = useCallback(
    async (documentKey: DocumentKey, files: FileList | null) => {
      if (!canManagePerfModal || !selectedPerfRoute) return
      if (!files || files.length === 0) return

      try {
        setUploadingDocument(documentKey)
        await freightDocuments.upload(selectedPerfRoute.id, Array.from(files), (document) => {
          setDocuments((prev) => ({ ...prev, [documentKey]: [...prev[documentKey], document] }))
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao anexar arquivo.'
        alert(msg)
      } finally {
        setUploadingDocument(null)
      }
    },
    [canManagePerfModal, selectedPerfRoute],
  )

  const handleRemoveDocument = useCallback(
    async (documentKey: DocumentKey, doc: RouteDocument) => {
      if (!canManagePerfModal || !selectedPerfRoute) return
      if (!confirm('Remover este arquivo?')) return
      try {
        setRemovingDocumentPath(doc.path)
        await freightDocuments.remove(selectedPerfRoute.id, doc.path)
        setDocuments((prev) => ({ ...prev, [documentKey]: prev[documentKey].filter((d) => d.path !== doc.path) }))
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao remover arquivo.'
        alert(msg)
      } finally {
        setRemovingDocumentPath(null)
      }
    },
    [canManagePerfModal, selectedPerfRoute],
  )

  /** Conteúdo de uma célula da lista de fretes por chave de coluna. */
  const renderPerfListCell = (
    key: string,
    ctx: {
      r: Route
      sellerName: string
      statusLabel: string
      statusClass: string
      created: string
    },
  ) => {
    const { r, sellerName, statusLabel, statusClass, created } = ctx
    switch (key) {
      case 'idFrete':
        return (
          <span className="font-medium text-gray-900 dark:text-slate-100 whitespace-nowrap">
            {r.freight_id > 0 ? `#${r.freight_id}` : '—'}
          </span>
        )
      case 'pgtoComissao':
        return (
          <CommissionPaidStatus
            paid={Boolean(r.commission_paid)}
            loading={commissionToggleRouteId === r.id}
            editable={isStrictAdmin}
            onToggle={() => void handleToggleCommissionPaid(r)}
          />
        )
      case 'cliente':
        return (
          <p className="max-w-[160px] text-gray-900 dark:text-slate-100 truncate" title={r.company_name?.trim() || '—'}>
            {r.company_name?.trim() || '—'}
          </p>
        )
      case 'rota':
        return (
          <div>
            <p
              className="text-gray-900 dark:text-slate-100 text-sm font-semibold tabular-nums tracking-tight"
              title={
                [r.origin, r.origin_state].filter(Boolean).join(', ') +
                ' → ' +
                [r.destination, r.destination_state].filter(Boolean).join(', ')
              }
            >
              {routeStatesShort(r.origin_state || null, r.destination_state || null)}
            </p>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">
              {r.freight_type || 'Tipo não informado'}
            </p>
          </div>
        )
      case 'vendedor':
        return <p className="font-medium text-gray-900 dark:text-slate-100">{sellerName}</p>
      case 'status':
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium ${statusClass}`}>
            {statusLabel}
          </span>
        )
      case 'frete':
        return (
          <span className="whitespace-nowrap">
            {visibleMoney.freight ? formatBRL(r.freight_value ?? r.nf_value ?? 0) : 'R$ ••••••'}
          </span>
        )
      case 'comissao':
        return (
          <span className="whitespace-nowrap">
            {visibleMoney.commission ? formatBRL(r.commission_value ?? 0) : 'R$ ••••••'}
          </span>
        )
      case 'data':
        return <span className="text-xs text-gray-600 dark:text-slate-300 whitespace-nowrap">{created}</span>
      default:
        return null
    }
  }

  const perfBlockProps = (block: PerfEditBlockId, title: string, allowed: boolean) => ({
    title,
    active: activePerfBlock === block,
    saving: block === 'finance' ? savingFinancial : block === 'driver' ? savingDriver : block === 'observation' ? savingObservation : savingFreightInfo,
    canEdit: allowed && (!activePerfBlock || activePerfBlock === block),
    onEdit: () => setActivePerfBlock(block),
    onCancel: () => { if (selectedPerfRoute) setSelectedPerfRoute({ ...selectedPerfRoute }); setActivePerfBlock(null) },
    onSave: () => {
      if (block === 'finance') void handleSaveFinancialFields()
      else if (block === 'driver') void handleSaveDriverFields()
      else if (block === 'observation') void handleSaveObservation()
      else void handleSavePerfInfoBlock(block)
    },
  })
  const perfInfoInput = (block: PerfEditBlockId, key: keyof typeof editingFreightInfoFields, label: string, options?: { type?: string; masked?: boolean }) => (
    <label key={key} className="block min-w-0 text-sm font-semibold text-gray-900">
      <span className="mb-2 block">{label}</span>
      <input aria-label={label} type={options?.type ?? 'text'} value={options?.masked && activePerfBlock !== block ? '••••••' : editingFreightInfoFields[key]} onChange={(event) => setEditingFreightInfoFields((prev) => ({ ...prev, [key]: event.target.value }))} disabled={activePerfBlock !== block || (block === 'driver' ? savingDriver : savingFreightInfo) || (block === 'driver' && !canManagePerfModal)} className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm font-normal text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-800 disabled:opacity-75" />
    </label>
  )
  const perfDriverInput = (key: keyof typeof editingDriverFields, label: string) => (
    <label key={key} className="block min-w-0 text-sm font-semibold text-gray-900">
      <span className="mb-2 block">{label}</span>
      <input aria-label={label} type="text" value={editingDriverFields[key]} onChange={(event) => setEditingDriverFields((prev) => ({ ...prev, [key]: event.target.value }))} disabled={activePerfBlock !== 'driver' || savingDriver} className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm font-normal text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-800 disabled:opacity-75" />
    </label>
  )
  const perfFinancialInput = (key: keyof typeof editingFields, label: string, masked = false) => (
    <label key={key} className="block min-w-0 text-sm font-semibold text-gray-900">
      <span className="mb-2 block">{label}</span>
      <input aria-label={label} type="text" value={masked && activePerfBlock !== 'finance' ? '••••••' : editingFields[key]} onChange={(event) => setEditingFields((prev) => ({ ...prev, [key]: event.target.value }))} disabled={activePerfBlock !== 'finance' || savingFinancial} className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm font-normal text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-800 disabled:opacity-75" />
    </label>
  )
  const perfFinancePreview = selectedPerfRoute && activePerfBlock === 'finance' ? (() => {
    const base = parseCurrencyInput(editingFreightInfoFields.freightValue) ?? selectedPerfRoute.nf_value
    const taxPercent = normalizeTaxesPercent(Number(editingFields.taxesPercent))
    const insurancePercent = canEditPerfSeguro ? normalizeSeguroPercent(Number(editingFields.seguroPercent)) : getRouteSeguroPercent(selectedPerfRoute)
    const insurance = calculateSeguroValue(selectedPerfRoute.nf_value, insurancePercent)
    const taxes = calculateTaxesValue(base, taxPercent)
    const net = calculateNetFreightValue(base, parseCurrencyInput(editingFields.driverValue), taxPercent, insurance, parseCurrencyInput(editingFields.valePedagioValue), editingFields.valePedagioIncluso === 'true')
    const sellerRate = selectedPerfRoute.created_by_user_id ? comerciais.find((user) => user.id === selectedPerfRoute.created_by_user_id)?.commission_rate ?? null : null
    return { insurance, taxes, net, commission: calculateCommissionValue(net, sellerRate) }
  })() : null

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Performance</h1>
          <p className="text-sm text-gray-600 mt-1">
            {canViewGlobalPerformance
              ? selectedComercial === 'all'
                ? role === 'financeiro'
                  ? 'Visão financeira: performance de todos os comerciais'
                  : role === 'fiscal'
                  ? 'Visão fiscal: performance de todos os comerciais'
                  : role === 'supervisor'
                  ? 'Visão de supervisão: performance de todos os comerciais'
                  : 'Visão da performance de todo o time comercial'
                : `Performance de ${selectedComercialLabel}`
              : `Métricas dos fretes no período — ${currentUserName}`}
            {' · '}
            <span className="font-medium text-gray-700">{PERIODO_LABELS[periodo]}</span>
            {filteredRows.length > 0 ? (
              <span className="text-gray-500"> · {filteredRows.length} fretes no período</span>
            ) : null}
          </p>
          <p className="text-xs text-gray-500 mt-1 max-w-2xl">{ROUTE_PERIOD_FILTER_HINT}</p>
          {!canViewGlobalPerformance && (
            <p className="text-xs text-gray-500 mt-2 max-w-xl">
              Os totais refletem os fretes disponíveis para sua conta no período, incluindo registros antigos sem responsável definido.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canViewGlobalPerformance && (
            <div className="relative">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" aria-hidden />
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-300 pointer-events-none" aria-hidden />
              <select
                value={selectedComercial}
                onChange={(e) => setSelectedComercial(e.target.value)}
                className="appearance-none rounded-xl border border-gray-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900 pl-9 pr-8 py-2 text-xs text-gray-700 dark:text-slate-100 hover:bg-white dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-800/20 cursor-pointer"
                aria-label="Filtrar por vendedor"
              >
                <option value="all" className={selectOptionClass}>Todos os vendedores ({periodRows.length})</option>
                {comerciais
                  .filter((u) => isPerformanceSellerRole(u.role))
                  .map((u) => {
                    const count = periodRows.filter((r) => r.created_by_user_id === u.id).length
                    const label = u.name || u.email
                    return (
                      <option key={u.id} value={u.id} className={selectOptionClass}>
                        {label} ({count})
                      </option>
                    )
                  })}
                {hasSemResponsavel && (
                  <option value="__sem_responsavel__" className={selectOptionClass}>
                    Sem responsável ({periodRows.filter((r) => !r.created_by_user_id).length})
                  </option>
                )}
              </select>
            </div>
          )}
          <div className="relative">
            <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" aria-hidden />
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-300 pointer-events-none" aria-hidden />
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value as Periodo)}
              className="appearance-none rounded-xl border border-gray-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900 pl-9 pr-8 py-2 text-xs text-gray-700 dark:text-slate-100 hover:bg-white dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-800/20 cursor-pointer"
              aria-label="Filtrar por período"
            >
              <option value="tudo" className={selectOptionClass}>Todo período</option>
              <option value="essaSemana" className={selectOptionClass}>Essa semana</option>
              <option value="mesAtual" className={selectOptionClass}>Mês atual</option>
              <option value="30d" className={selectOptionClass}>Últimos 30 dias</option>
              <option value="mesPassado" className={selectOptionClass}>Mês passado</option>
              <option value="custom" className={selectOptionClass}>Personalizado</option>
            </select>
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" aria-hidden />
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-300 pointer-events-none" aria-hidden />
            <select
              value={clientPaymentStatusFilter}
              onChange={(e) => setClientPaymentStatusFilter(e.target.value as PaymentStatusFilter)}
              className="appearance-none rounded-xl border border-gray-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900 pl-9 pr-8 py-2 text-xs text-gray-700 dark:text-slate-100 hover:bg-white dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-800/20 cursor-pointer"
              aria-label="Filtrar por status de pagamento do cliente"
            >
              <option value="all" className={selectOptionClass}>Pgto. cliente: todos</option>
              {PAYMENT_STATUS_FILTER_OPTIONS.map((status) => (
                <option key={status} value={status} className={selectOptionClass}>Pgto. cliente: {status}</option>
              ))}
            </select>
          </div>
          <div className="relative">
            <RouteIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" aria-hidden />
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-300 pointer-events-none" aria-hidden />
            <select
              value={freightStatusFilter}
              onChange={(e) => setFreightStatusFilter(e.target.value as 'all' | RouteStatus)}
              className="appearance-none rounded-xl border border-gray-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900 pl-9 pr-8 py-2 text-xs text-gray-700 dark:text-slate-100 hover:bg-white dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-800/20 cursor-pointer"
              aria-label="Filtrar por status do frete"
            >
              <option value="all" className={selectOptionClass}>Status frete: todos</option>
              {PERF_ROUTE_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status} className={selectOptionClass}>Status frete: {perfDetailStatusLabel(status)}</option>
              ))}
            </select>
          </div>
          <div className="relative">
            <Truck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" aria-hidden />
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-300 pointer-events-none" aria-hidden />
            <select
              value={driverPaymentStatusFilter}
              onChange={(e) => setDriverPaymentStatusFilter(e.target.value as PaymentStatusFilter)}
              className="appearance-none rounded-xl border border-gray-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900 pl-9 pr-8 py-2 text-xs text-gray-700 dark:text-slate-100 hover:bg-white dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-800/20 cursor-pointer"
              aria-label="Filtrar por status de pagamento do motorista"
            >
              <option value="all" className={selectOptionClass}>Pgto. motorista: todos</option>
              {PAYMENT_STATUS_FILTER_OPTIONS.map((status) => (
                <option key={status} value={status} className={selectOptionClass}>Pgto. motorista: {status}</option>
              ))}
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
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-500 p-4">
          <p className="text-xs text-gray-500 dark:text-slate-300">Total de fretes</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-slate-100 mt-1">{formatNumber(totals.totalFretes)}</p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-500 p-4">
          <p className="text-xs text-gray-500 dark:text-slate-300">Entregues</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{formatNumber(totals.entregues)}</p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-500 p-4">
          <p className="text-xs text-gray-500 dark:text-slate-300">Em andamento</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{formatNumber(totals.emAndamento)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-500 p-4">
          <p className="text-xs text-gray-500 dark:text-slate-300">Valor total dos fretes</p>
          <MoneyValueRow
            value={totals.totalFreightValue}
            visible={visibleMoney.freight}
            onToggle={() => toggleMoneyField('freight')}
          />
        </div>
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-500 p-4">
          <p className="text-xs text-gray-500 dark:text-slate-300">Valor dos motoristas</p>
          <MoneyValueRow
            value={totals.totalDriverValue}
            totalFreightValue={visibleMoney.freight ? totals.totalFreightValue : undefined}
            visible={visibleMoney.driver}
            onToggle={() => toggleMoneyField('driver')}
          />
        </div>
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-500 p-4">
          <p className="text-xs text-gray-500 dark:text-slate-300">Valor dos tribultos</p>
          <MoneyValueRow
            value={totals.totalTaxesValue}
            totalFreightValue={visibleMoney.freight ? totals.totalFreightValue : undefined}
            visible={visibleMoney.taxes}
            onToggle={() => toggleMoneyField('taxes')}
          />
        </div>
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-500 p-4">
          <p className="text-xs text-gray-500 dark:text-slate-300">Valor dos fretes líquidos</p>
          <MoneyValueRow
            value={totals.totalNetFreightValue}
            totalFreightValue={visibleMoney.freight ? totals.totalFreightValue : undefined}
            visible={visibleMoney.netFreight}
            onToggle={() => toggleMoneyField('netFreight')}
          />
        </div>
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-500 p-4">
          <p className="text-xs text-gray-500 dark:text-slate-300">Valor total de comissões</p>
          <MoneyValueRow
            value={totals.totalCommissionValue}
            totalFreightValue={visibleMoney.freight ? totals.totalFreightValue : undefined}
            visible={visibleMoney.commission}
            onToggle={() => toggleMoneyField('commission')}
          />
        </div>
      </div>

      <PerformanceCharts
        rows={filteredRows}
        activityRows={activityRows}
        allRows={rows}
        sellers={comerciais}
        selectedSeller={selectedComercial}
        userId={currentUserId}
        role={role}
        bounds={periodBounds}
        period={periodo}
        showRevenue={visibleMoney.freight}
        showGoal={visibleMoney.freight && visibleMoney.netFreight}
      />

      {canViewGlobalPerformance ? (
        <div className="rounded-2xl border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-900 overflow-hidden">
          <div className={`px-4 md:px-5 py-4 flex items-center justify-between gap-2 flex-wrap ${commercialSummaryExpanded ? 'border-b border-gray-100 dark:border-slate-500' : ''}`}>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-gray-600 dark:text-slate-300" aria-hidden />
              <h2 className="text-sm font-semibold text-gray-800 dark:text-slate-100">
                {selectedComercial === 'all'
                  ? 'Performance por comercial'
                  : `Performance — ${selectedComercialLabel}`}
              </h2>
            </div>
            <div className="flex items-center gap-3 flex-wrap justify-end">
              {selectedComercial !== 'all' && (
                <button
                  type="button"
                  onClick={() => setSelectedComercial('all')}
                  className="text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 underline underline-offset-2"
                >
                  Limpar filtro
                </button>
              )}
              <button
                type="button"
                onClick={() => setCommercialSummaryExpanded((expanded) => !expanded)}
                aria-expanded={commercialSummaryExpanded}
                aria-controls="performance-commercial-summary"
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${commercialSummaryExpanded ? 'rotate-180' : ''}`} aria-hidden />
                {commercialSummaryExpanded ? 'Recolher' : 'Expandir'}
              </button>
            </div>
          </div>
          <div id="performance-commercial-summary" hidden={!commercialSummaryExpanded} className="overflow-x-auto px-1 md:px-2">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 dark:bg-slate-800 dark:text-slate-200">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold">Comercial</th>
                  <th className="text-left px-5 py-3 font-semibold">Fretes</th>
                  <th className="text-left px-5 py-3 font-semibold">Entregues</th>
                  <th className="text-left px-5 py-3 font-semibold">Em andamento</th>
                  <th className="text-left px-5 py-3 font-semibold">Cancelados</th>
                  <th className="text-left px-5 py-3 font-semibold">
                    <div className="flex items-center justify-between gap-2 pr-0">
                      <span>Líquido total</span>
                      <button
                        type="button"
                        onClick={() => toggleMoneyField('nfTable')}
                        className="shrink-0 rounded-lg border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-800 p-1.5 text-gray-600 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-800/20"
                        aria-pressed={visibleMoney.nfTable}
                        aria-label={visibleMoney.nfTable ? 'Ocultar valores líquidos' : 'Mostrar valores líquidos'}
                        title={visibleMoney.nfTable ? 'Ocultar valores líquidos' : 'Mostrar valores líquidos'}
                      >
                        {visibleMoney.nfTable ? (
                          <Eye className="w-4 h-4" aria-hidden />
                        ) : (
                          <EyeOff className="w-4 h-4" aria-hidden />
                        )}
                      </button>
                    </div>
                  </th>
                  <th className="text-left px-5 py-3 font-semibold">Comissão total</th>
                </tr>
              </thead>
              <tbody>
                {byUser.map((item) => {
                  return (
                    <tr key={item.userId} className="border-t border-gray-100 dark:border-slate-500">
                      <td className="px-5 py-3 align-top">
                        <p className="font-medium text-gray-900 dark:text-slate-100">{item.userName}</p>
                        <p className="text-xs text-gray-500 dark:text-slate-300">{item.userEmail}</p>
                      </td>
                      <td className="px-5 py-3 align-top">
                        {formatNumber(item.totalFretes)}
                      </td>
                      <td className="px-5 py-3 align-top text-green-700 font-medium">
                        {formatNumber(item.entregues)}
                      </td>
                      <td className="px-5 py-3 align-top text-amber-700 font-medium">
                        {formatNumber(item.emAndamento)}
                      </td>
                      <td className="px-5 py-3 align-top text-rose-700 font-medium">
                        {formatNumber(item.cancelados)}
                      </td>
                      <td className="px-5 py-3 align-top dark:text-slate-100">
                        {visibleMoney.nfTable ? formatBRL(item.totalNetFreightValue) : 'R$ ••••••'}
                      </td>
                      <td className="px-5 py-3 align-top dark:text-slate-100">
                        {visibleMoney.commission ? formatBRL(item.totalCommissionValue) : 'R$ ••••••'}
                      </td>
                    </tr>
                  )
                })}
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
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <div className="px-4 md:px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-gray-600 dark:text-slate-300" aria-hidden />
              <h2 className="text-sm font-semibold text-gray-800 dark:text-slate-100">
                Lista de fretes — {detailedRows.length}{' '}
                {detailedRows.length === 1 ? 'frete' : 'fretes'}
              </h2>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <span className="text-xs text-gray-500 dark:text-slate-300">Selecionado: {selectedComercialLabel}</span>
              <ColumnManager
                orderedColumns={listColumns.orderedColumns}
                isVisible={listColumns.isVisible}
                onToggle={listColumns.toggle}
                onMove={listColumns.move}
                onReset={listColumns.reset}
              />
            </div>
          </div>
          <StickyScrollX className="px-1 md:px-2">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 dark:bg-slate-800 dark:text-slate-200">
                <tr>
                  {listColumns.visibleKeys.map((key) => (
                    <th key={key} className={`text-left px-4 py-3 font-semibold whitespace-nowrap ${key === 'cliente' ? 'w-[192px] max-w-[192px]' : ''}`}>
                      {PERF_LABEL_BY_KEY.get(key)}
                    </th>
                  ))}
                  {showRotasColumn ? (
                    <th className="text-right px-4 py-3 font-semibold whitespace-nowrap">Detalhes</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {detailedRows.map(({ route: r, sellerName, sellerCommissionRate }) => {
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
                    ? new Date(r.created_at).toLocaleDateString('pt-BR', DATE_BR_NUMERIC)
                    : '—'
                  const cellCtx = { r, sellerName, statusLabel, statusClass, created }
                  return (
                    <tr key={r.id} className="border-t border-gray-100 dark:border-slate-700 hover:bg-gray-50/60 dark:hover:bg-slate-800/60">
                        {listColumns.visibleKeys.map((key) => (
                          <td key={key} className={`px-4 py-3 align-top ${key === 'cliente' ? 'w-[192px] max-w-[192px]' : ''}`}>
                            {renderPerfListCell(key, cellCtx)}
                          </td>
                        ))}
                        {showRotasColumn ? (
                          <td className="px-4 py-3 align-top text-right whitespace-nowrap">
                            {canViewGlobalPerformance || (r.created_by_user_id && r.created_by_user_id === currentUserId) ? (
                              <button
                                type="button"
                                onClick={() => setSelectedPerfRoute(r)}
                                className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                              >
                                Ver mais
                              </button>
                            ) : null}
                          </td>
                        ) : null}
                      </tr>
                  )
                })}
              </tbody>
            </table>
          </StickyScrollX>
        </div>
      )}

      {selectedPerfRoute ? (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedPerfRoute(null)}
        >
          <div
            className="perf-detail-modal bg-white text-gray-900 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto dark:bg-slate-900 dark:text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10 dark:bg-slate-900 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-800 rounded-lg flex items-center justify-center">
                  <Truck className="w-6 h-6 text-white" aria-hidden />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-bold text-gray-900">
                      Frete #{selectedPerfRoute.freight_id > 0 ? selectedPerfRoute.freight_id : '—'}
                    </h2>
                    {isStrictAdmin ? (
                      <CommissionPaidStatus
                        paid={Boolean(selectedPerfRoute.commission_paid)}
                        loading={commissionToggleRouteId === selectedPerfRoute.id}
                        editable
                        compact={false}
                        onToggle={() => void handleToggleCommissionPaid(selectedPerfRoute)}
                      />
                    ) : (
                      <CommissionPaidStatus
                        paid={Boolean(selectedPerfRoute.commission_paid)}
                        compact={false}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`w-2 h-2 rounded-full ${perfStatusDisplay(selectedPerfRoute.status).dotColor}`} />
                    <span className="text-sm text-gray-600">{perfStatusDisplay(selectedPerfRoute.status).label}</span>
                    {selectedPerfRoute.distance_km != null && selectedPerfRoute.distance_km > 0 ? (
                      <span className="text-xs text-gray-500">• {formatNumber(selectedPerfRoute.distance_km)} km</span>
                    ) : null}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPerfRoute(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Fechar detalhes do frete"
              >
                <X className="w-5 h-5 text-gray-600" aria-hidden />
              </button>
            </div>
            <div className="p-6">
              {canViewPerfModalDetails ? (
                <div className="space-y-6">
                  <PerfEditBlock {...perfBlockProps('company', 'Empresa', canManagePerfModal)}>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div><div className="flex items-end gap-2">{perfInfoInput('company', 'companyCnpj', 'CNPJ da empresa')}<button type="button" aria-label="Buscar empresa pelo CNPJ" title="Buscar empresa pelo CNPJ" onClick={() => void handleSearchPerfCompany()} disabled={activePerfBlock !== 'company' || searchingPerfCompany} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white disabled:opacity-50">{searchingPerfCompany ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</button></div>{perfCompanyLookupMessage && <p role="status" className="mt-1 text-xs text-gray-600">{perfCompanyLookupMessage}</p>}</div>
                      {perfInfoInput('company', 'companyName', 'Nome da empresa')}
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      {perfInfoInput('company', 'companyResponsible', 'Nome do responsável')}
                      {perfInfoInput('company', 'companyPhone', 'Número de telefone')}
                      {perfInfoInput('company', 'companyEmail', 'E-mail', { type: 'email' })}
                    </div>
                  </PerfEditBlock>

                  <PerfEditBlock {...perfBlockProps('payment', 'Status e pagamento', canManagePerfModal)}>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <label className="block text-xs font-medium text-gray-700"><span className="mb-1 block">Status de pagamento</span>
                      <select value={editingFreightInfoFields.paymentStatus} onChange={(e) => setEditingFreightInfoFields((prev) => ({ ...prev, paymentStatus: e.target.value }))} disabled={activePerfBlock !== 'payment'} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm disabled:bg-gray-100">
                        <option value="">—</option>{PAYMENT_STATUS_FILTER_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                    </label>
                    <label className="block text-xs font-medium text-gray-700"><span className="mb-1 block">Tipo de pagamento</span>
                      <select value={editingFreightInfoFields.paymentType} onChange={(e) => setEditingFreightInfoFields((prev) => ({ ...prev, paymentType: e.target.value }))} disabled={activePerfBlock !== 'payment'} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm disabled:bg-gray-100">
                        <option value="">—</option>{editingFreightInfoFields.paymentType && !['Pix', 'Link de Pagamento', 'Boleto'].includes(editingFreightInfoFields.paymentType) && <option value={editingFreightInfoFields.paymentType}>{editingFreightInfoFields.paymentType}</option>}{['Pix', 'Link de Pagamento', 'Boleto'].map((type) => <option key={type} value={type}>{type}</option>)}
                      </select>
                    </label>
                    <label className="block text-xs font-medium text-gray-700"><span className="mb-1 block">Tipo de frete</span>
                      <select value={editingFreightInfoFields.freightType} onChange={(e) => setEditingFreightInfoFields((prev) => ({ ...prev, freightType: e.target.value }))} disabled={activePerfBlock !== 'payment'} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm disabled:bg-gray-100">
                        <option value="">—</option><option value="Dedicado">Dedicado</option><option value="Fracionado">Fracionado</option>
                      </select>
                    </label>
                    </div>
                    <label className="block max-w-xs text-xs font-medium text-gray-700"><span className="mb-1 block">Status do frete</span>
                      <select value={editingFreightInfoFields.status} onChange={(e) => setEditingFreightInfoFields((prev) => ({ ...prev, status: e.target.value as RouteStatus }))} disabled={activePerfBlock !== 'payment'} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm disabled:bg-gray-100">
                        {PERF_ROUTE_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{perfDetailStatusLabel(status)}</option>)}
                      </select>
                    </label>
                  </PerfEditBlock>

                  <PerfEditBlock {...perfBlockProps('driver', 'Dados do motorista e datas', canEditOperationalFields)}>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      {perfDriverInput('driverName', 'Nome do Motorista')}
                      {perfDriverInput('driverPhone', 'Celular do Motorista')}
                      <label className="block text-xs font-medium text-gray-700"><span className="mb-1 block">Status Motorista</span>
                        <select value={editingDriverFields.driverPaymentType} onChange={(e) => setEditingDriverFields((prev) => ({ ...prev, driverPaymentType: e.target.value }))} disabled={activePerfBlock !== 'driver'} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm disabled:bg-gray-100"><option value="">Selecione</option>{['Pendente', '50%', '70%', '100%'].map((status) => <option key={status} value={status}>{status}</option>)}{editingDriverFields.driverPaymentType && !['Pendente', '50%', '70%', '100%'].includes(editingDriverFields.driverPaymentType) && <option value={editingDriverFields.driverPaymentType}>{editingDriverFields.driverPaymentType}</option>}</select>
                      </label>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {perfInfoInput('driver', 'pickupDate', 'Data de coleta (opcional)', { type: 'date' })}
                      {perfInfoInput('driver', 'estimatedDelivery', 'Previsão de entrega (opcional)', { type: 'date' })}
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      {perfDriverInput('vehicle', 'Veículo')}
                      {perfDriverInput('plate', 'Placa')}
                      <label className="block text-xs font-medium text-gray-700"><span className="mb-1 block">Status de pagamento do motorista</span>
                        <select value={editingDriverFields.driverPaymentStatus} onChange={(e) => setEditingDriverFields((prev) => ({ ...prev, driverPaymentStatus: e.target.value }))} disabled={activePerfBlock !== 'driver'} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm disabled:bg-gray-100"><option value="">—</option>{PAYMENT_STATUS_FILTER_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}</select>
                      </label>
                    </div>
                  </PerfEditBlock>

                  <PerfEditBlock {...perfBlockProps('origin', 'Origem / Coleta', canManagePerfModal)}>
                    <CEPInput value={perfOriginCep} onChange={setPerfOriginCep} disabled={activePerfBlock !== 'origin'} autoSearch={false} label="CEP de Origem (opcional — preenche cidade e endereço automaticamente)" onCEPFound={(data) => setEditingFreightInfoFields((prev) => ({ ...prev, origin: data.localidade || prev.origin, originState: data.uf || prev.originState, originAddress: data.logradouro || prev.originAddress }))} />
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div className="md:col-span-2">{perfInfoInput('origin', 'origin', 'Cidade de Origem')}</div>
                      {perfInfoInput('origin', 'originState', 'Estado')}
                    </div>
                    {perfInfoInput('origin', 'originAddress', 'Endereço de Origem')}
                  </PerfEditBlock>

                  <PerfEditBlock {...perfBlockProps('destination', 'Destino / Entrega', canManagePerfModal)}>
                    <CEPInput value={perfDestinationCep} onChange={setPerfDestinationCep} disabled={activePerfBlock !== 'destination'} autoSearch={false} label="CEP de Destino (opcional — preenche cidade e endereço automaticamente)" onCEPFound={(data) => setEditingFreightInfoFields((prev) => ({ ...prev, destination: data.localidade || prev.destination, destinationState: data.uf || prev.destinationState, destinationAddress: data.logradouro || prev.destinationAddress }))} />
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div className="md:col-span-2">{perfInfoInput('destination', 'destination', 'Cidade de Destino')}</div>
                      {perfInfoInput('destination', 'destinationState', 'Estado')}
                    </div>
                    {perfInfoInput('destination', 'destinationAddress', 'Endereço de Destino')}
                  </PerfEditBlock>

                  <PerfEditBlock {...perfBlockProps('cargo', 'Dados da carga', canManagePerfModal)}>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {perfInfoInput('cargo', 'weight', 'Peso')}
                      {perfInfoInput('cargo', 'cubageM3', 'Metros cúbicos (m³)')}
                      {perfInfoInput('cargo', 'materialType', 'Tipo de material')}
                      {perfInfoInput('cargo', 'nfValue', 'Valor da nota fiscal', { masked: !visibleMoney.nfTable })}
                    </div>
                  </PerfEditBlock>

                  <PerfEditBlock {...perfBlockProps('finance', 'Valores e custos', canEditOperationalFields)}>
                    <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
                    {canManagePerfModal ? perfInfoInput('finance', 'freightValue', 'Valor do frete', { masked: !visibleMoney.freight }) : <div className="block text-xs font-medium text-gray-700"><span className="mb-1 block">Valor do frete</span><div className="rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm">{moneyOrHidden(selectedPerfRoute.freight_value, visibleMoney.freight)}</div></div>}
                    {perfFinancialInput('driverValue', 'Valor do motorista', !visibleMoney.driver)}
                    <div className="block text-xs font-medium text-gray-700"><span className="mb-1 block">Frete líquido</span><div className="rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm">{moneyOrHidden(perfFinancePreview?.net ?? getRouteNetFreightValue(selectedPerfRoute), visibleMoney.netFreight)}</div></div>
                    <div className="space-y-2">{canEditPerfSeguro ? <label className="block text-xs font-medium text-gray-700"><span className="mb-1 block">Seguro (% sobre NF)</span><select value={editingFields.seguroPercent} onChange={(e) => setEditingFields((prev) => ({ ...prev, seguroPercent: e.target.value }))} disabled={activePerfBlock !== 'finance'} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm disabled:bg-gray-100"><option value="0">0%</option><option value="0.2">0,2%</option></select></label> : <div className="text-xs text-gray-700">Seguro: {getRouteSeguroPercent(selectedPerfRoute)}% sobre NF</div>}<div className="block text-xs font-medium text-gray-700"><span className="mb-1 block">Valor do seguro</span><div className="rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm">{moneyOrHidden(perfFinancePreview?.insurance ?? getRouteSeguroValue(selectedPerfRoute), visibleMoney.taxes)}</div></div></div>
                    <div className="space-y-2">{perfFinancialInput('taxesPercent', 'Tributos (%)')}<div className="block text-xs font-medium text-gray-700"><span className="mb-1 block">Valor dos tributos</span><div className="rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm">{moneyOrHidden(perfFinancePreview?.taxes ?? selectedPerfRoute.taxes_value, visibleMoney.taxes)}</div></div></div>
                    <div className="block text-xs font-medium text-gray-700"><span className="mb-1 block">Comissão</span><div className="rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm">{moneyOrHidden(perfFinancePreview?.commission ?? selectedPerfRoute.commission_value, visibleMoney.commission)}</div></div>
                    {perfFinancialInput('cteValue', 'Valor do CT-e', !visibleMoney.freight)}
                    <div className="space-y-2">{perfFinancialInput('valePedagioValue', 'Vale pedágio', !visibleMoney.freight)}<label className="block text-xs font-medium text-gray-700"><span className="sr-only">Vale pedágio incluso</span><select value={editingFields.valePedagioIncluso} onChange={(e) => setEditingFields((prev) => ({ ...prev, valePedagioIncluso: e.target.value }))} disabled={activePerfBlock !== 'finance'} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm disabled:bg-gray-100"><option value="true">Incluso</option><option value="false">Não incluso</option></select></label></div>
                    </div>
                  </PerfEditBlock>

                  <PerfEditBlock {...perfBlockProps('observation', 'Observação', canManagePerfModal)}>
                    <textarea aria-label="Observação" value={editingObservationValue} onChange={(e) => setEditingObservationValue(e.target.value)} disabled={activePerfBlock !== 'observation' || savingObservation} rows={3} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm disabled:bg-gray-100 sm:col-span-2" />
                  </PerfEditBlock>

                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                      <p className="text-xs text-gray-700 font-semibold uppercase tracking-wide">Anexos do frete</p>
                      <span className="text-[11px] text-gray-500">
                        {documents.freteDocs.length} {documents.freteDocs.length === 1 ? 'arquivo' : 'arquivos'}
                      </span>
                    </div>
                    {canManagePerfModal ? (
                      <p className="text-sm text-gray-600 mb-3">
                        Adicione imagens ou PDF (até 20 MB por PDF) sem sair da tela de performance.
                      </p>
                    ) : null}
                    {documentsLoading && <p className="mb-3 text-sm text-gray-600">Carregando anexos...</p>}
                    {documentsError && (
                      <p role="alert" className="mb-3 text-sm text-red-700">
                        {documentsError}{' '}
                        <button type="button" className="underline" onClick={() => setDocumentsRetry((value) => value + 1)}>
                          Tentar novamente
                        </button>
                      </p>
                    )}
                    {canManagePerfModal ? (
                      <>
                        <input
                      id="perf-upload-frete-docs"
                      type="file"
                      accept="image/*,application/pdf"
                      multiple
                      className="hidden"
                      disabled={uploadingDocument === 'freteDocs'}
                      onChange={(e) => {
                        const files = e.target.files
                        void handleUploadDocuments('freteDocs', files)
                        e.target.value = ''
                      }}
                    />
                      <label
                        htmlFor="perf-upload-frete-docs"
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-lg text-gray-700 ${
                        uploadingDocument === 'freteDocs' ? 'cursor-wait opacity-60' : 'hover:bg-gray-100 cursor-pointer'
                      }`}
                    >
                      {uploadingDocument === 'freteDocs' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      {uploadingDocument === 'freteDocs' ? 'Enviando...' : 'Adicionar arquivos'}
                        </label>
                      </>
                    ) : null}

                    <FreightDocumentGallery
                      documents={documents.freteDocs}
                      canRemove={canManagePerfModal}
                      removingPath={removingDocumentPath}
                      onPreview={setSelectedPhoto}
                      onRemove={(doc) => void handleRemoveDocument('freteDocs', doc)}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {selectedPhoto ? (
        <div
          className="fixed inset-0 z-[60] overflow-y-auto overflow-x-hidden bg-black/90 p-4 flex items-center justify-center min-h-0"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative my-auto flex w-full max-w-5xl shrink-0 justify-center" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute right-2 top-2 z-10 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20 sm:right-0 sm:top-0"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={selectedPhoto}
              alt="Documento do frete ampliado"
              className="max-h-[min(90vh,calc(100dvh-2rem))] w-auto max-w-full rounded-lg object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.src =
                  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="800" height="600"%3E%3Crect fill="%23ddd" width="800" height="600"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EImagem não disponível%3C/text%3E%3C/svg%3E'
              }}
            />
          </div>
        </div>
      ) : null}

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

