'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  BarChart3,
  Building2,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Circle,
  Eye,
  EyeOff,
  FileText,
  Filter,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Route as RouteIcon,
  Trash2,
  Truck,
  Upload,
  Users,
  X,
} from 'lucide-react'
import type { Route } from '@/lib/services/routes'
import { supabase } from '@/lib/supabase/client'
import { DATE_BR_NUMERIC, formatDateDdMmYyyy } from '@/lib/utils/date-format'
import { getWhatsAppWebUrl } from '@/lib/utils/whatsapp'

type Periodo = 'tudo' | 'essaSemana' | 'mesAtual' | '30d' | 'mesPassado' | 'custom'
type UserRole = 'admin' | 'comercial' | 'financeiro' | 'driver' | 'operator' | null
type DocumentKey = 'freteDocs'
type RouteDocumentKind = 'image' | 'pdf'
type RouteDocument = { path: string; url: string; name: string; kind: RouteDocumentKind }

interface ComercialUser {
  id: string
  name: string | null
  email: string
  role: string
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

const EMPTY_DOCUMENTS: Record<DocumentKey, RouteDocument[]> = { freteDocs: [] }
const SAFE_IMAGE_DIMENSION = 4000
const IMAGE_COMPRESSION_QUALITY = 0.9
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const ALLOWED_DOCUMENT_TYPES = [...ALLOWED_IMAGE_TYPES, 'image/heic', 'image/heif', 'application/pdf']
const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024

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
      <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 truncate" aria-hidden={!visible}>
        {visible ? formatBRL(value) : 'R$ ••••••'}
      </p>
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

function endOfTodayIso(): string {
  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  return end.toISOString()
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

const TAXES_PERCENT_OPTIONS = [0, 10, 12, 18] as const

function normalizeTaxesPercentPerf(value: unknown): (typeof TAXES_PERCENT_OPTIONS)[number] {
  const n = typeof value === 'number' && !Number.isNaN(value) ? value : Number(value)
  if (n === 0 || n === 10 || n === 12 || n === 18) return n
  return 18
}

function inferTaxesPercentFromValuesPerf(
  freight: number | null | undefined,
  taxes: number | null | undefined,
): (typeof TAXES_PERCENT_OPTIONS)[number] {
  if (freight == null || freight <= 0 || taxes == null) return 18
  for (const pct of [18, 12, 10, 0] as const) {
    const expected = Math.round(freight * (pct / 100) * 100) / 100
    if (Math.abs(expected - taxes) < 0.02) return pct
  }
  return 18
}

function getPerfRouteTaxesPercent(route: Route): (typeof TAXES_PERCENT_OPTIONS)[number] {
  const raw = route.taxes_percent
  if (raw === 0 || raw === 10 || raw === 12 || raw === 18) return raw
  return inferTaxesPercentFromValuesPerf(route.freight_value ?? route.nf_value ?? undefined, route.taxes_value ?? undefined)
}

function calculatePerfTaxesValue(freightValue?: number | null, taxesPercent?: number | null) {
  if (freightValue == null) return null
  const p = normalizeTaxesPercentPerf(taxesPercent) / 100
  return Math.round(freightValue * p * 100) / 100
}

function calculatePerfCommissionValue(netFreightValue?: number | null) {
  if (netFreightValue == null) return null
  return Math.round(netFreightValue * 0.3 * 100) / 100
}

function calculatePerfNetFreightValue(
  freightValue?: number | null,
  driverValue?: number | null,
  taxesPercent?: number | null,
) {
  if (freightValue == null) return null
  const taxesValue = calculatePerfTaxesValue(freightValue, taxesPercent) ?? 0
  return Math.round((freightValue - taxesValue - (driverValue ?? 0)) * 100) / 100
}

function getPerfRouteNetFreightValue(route: Route): number {
  const baseFreight = route.freight_value ?? route.nf_value
  const pct = getPerfRouteTaxesPercent(route)
  return route.net_freight_value ?? calculatePerfNetFreightValue(baseFreight, route.driver_value, pct) ?? 0
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
    company_responsible: nullableStr(r.company_responsible),
    company_phone: nullableStr(r.company_phone),
    company_email: nullableStr(r.company_email),
    company_address: nullableStr(r.company_address),
    company_city: nullableStr(r.company_city),
    company_state: nullableStr(r.company_state),
    driver_name: nullableStr(r.driver_name),
    driver_phone: nullableStr(r.driver_phone),
    distance_km: toNumberOrNull(r.distance_km),
    freight_value: toNumberOrNull(r.freight_value),
    driver_value: toNumberOrNull(r.driver_value),
    taxes_value: toNumberOrNull(r.taxes_value),
    taxes_percent: ((): Route['taxes_percent'] => {
      const n = toNumberOrNull(r.taxes_percent)
      if (n === 0 || n === 10 || n === 12 || n === 18) return n
      return null
    })(),
    net_freight_value: toNumberOrNull(r.net_freight_value),
    commission_value: toNumberOrNull(r.commission_value),
    commission_paid: r.commission_paid === true,
    payment_status: nullableStr(r.payment_status),
    payment_type: nullableStr(r.payment_type),
    driver_payment_status: nullableStr(r.driver_payment_status),
    driver_payment_type: nullableStr(r.driver_payment_type),
    nf_value: toNumberOrNull(r.nf_value),
    cte_value: toNumberOrNull(r.cte_value),
    observation: nullableStr(r.observation),
    created_by_user_id: typeof r.created_by_user_id === 'string' ? r.created_by_user_id : null,
    created_at: strField(r.created_at),
    updated_at: strField(r.updated_at),
  }
}

function CommissionPaidToggle({
  paid,
  loading,
  onClick,
  compact = true,
}: {
  paid: boolean
  loading?: boolean
  onClick: () => void
  compact?: boolean
}) {
  const sizeClass = compact ? 'px-1.5 py-0.5 text-[10px] gap-0.5' : 'px-2.5 py-1 text-xs gap-1'
  const iconClass = compact ? 'w-3 h-3' : 'w-3.5 h-3.5'
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      disabled={loading}
      title={
        paid
          ? 'Comissão paga — clique para marcar como pendente'
          : 'Comissão pendente — clique para marcar como paga'
      }
      aria-pressed={paid}
      aria-label={paid ? 'Comissão paga' : 'Comissão pendente'}
      className={`inline-flex items-center rounded-md border font-semibold transition-colors disabled:opacity-60 ${sizeClass} ${
        paid
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-950'
          : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-950/60'
      }`}
    >
      {loading ? (
        <Loader2 className={`${iconClass} animate-spin shrink-0`} aria-hidden />
      ) : paid ? (
        <CheckCircle2 className={`${iconClass} shrink-0`} aria-hidden />
      ) : (
        <Circle className={`${iconClass} shrink-0`} aria-hidden />
      )}
      {paid ? 'Pago' : 'Pendente'}
    </button>
  )
}

function perfDetailStatusLabel(s: Route['status']): string {
  switch (s) {
    case 'delivered':
      return 'Entregue'
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

function getDocumentKind(name: string): RouteDocumentKind {
  return name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image'
}

async function compressImage(file: File): Promise<File> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return file

  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

  const image: HTMLImageElement = await new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Não foi possível carregar a imagem.'))
    img.src = dataUrl
  })

  const ratio = Math.min(1, SAFE_IMAGE_DIMENSION / Math.max(image.width, image.height))
  const targetW = Math.round(image.width * ratio)
  const targetH = Math.round(image.height * ratio)

  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(image, 0, 0, targetW, targetH)

  const blob: Blob | null = await new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', IMAGE_COMPRESSION_QUALITY)
  })
  if (!blob) return file

  const compressed = new File([blob], file.name.replace(/\.(png|webp|heic|heif)$/i, '.jpg'), {
    type: 'image/jpeg',
    lastModified: Date.now(),
  })
  return compressed.size < file.size ? compressed : file
}

function moneyOrHidden(v: number | null | undefined, visible: boolean): string {
  if (!visible) return 'R$ ••••••'
  if (v == null) return '—'
  return formatBRL(v)
}

function PerfFreightDetailPanel({
  route,
  visibleMoney,
}: {
  route: Route
  visibleMoney: Record<MoneyFieldKey, boolean>
}) {
  const pct = getPerfRouteTaxesPercent(route)
  const baseFreight = route.freight_value ?? route.nf_value
  const waCompany = getWhatsAppWebUrl(route.company_phone ?? '')
  const waDriver = getWhatsAppWebUrl(route.driver_phone ?? '')

  return (
    <div className="border-t border-slate-200/80 bg-slate-50/90 px-4 py-5 md:px-6 space-y-5 text-left !text-gray-900 [&_.text-gray-900]:!text-gray-900 [&_.text-gray-700]:!text-gray-700 [&_.text-gray-600]:!text-gray-700 [&_.text-gray-500]:!text-gray-700 [&_.bg-white]:!bg-white [&_.border-gray-200]:!border-gray-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Frete</p>
          <p className="text-lg font-bold text-slate-900">
            #{route.freight_id > 0 ? route.freight_id : '—'}{' '}
            <span className="text-sm font-medium text-slate-600">· {perfDetailStatusLabel(route.status)}</span>
          </p>
        </div>
        {route.distance_km != null && route.distance_km > 0 ? (
          <p className="text-xs text-slate-600">
            Distância: <span className="font-semibold tabular-nums">{formatNumber(route.distance_km)}</span> km
          </p>
        ) : null}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Building2 className="w-4 h-4 shrink-0" aria-hidden />
          Empresa
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-xs text-gray-500 mb-1">Nome</p>
            <p className="text-sm font-medium text-gray-900">{route.company_name?.trim() || '—'}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-xs text-gray-500 mb-1">Responsável</p>
            <p className="text-sm font-medium text-gray-900">{route.company_responsible?.trim() || '—'}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
              <Phone className="w-3 h-3" aria-hidden />
              Telefone / WhatsApp
            </p>
            {waCompany ? (
              <a
                href={waCompany}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-green-700 hover:underline"
              >
                {route.company_phone || '—'}
              </a>
            ) : (
              <p className="text-sm font-medium text-gray-900">{route.company_phone?.trim() || '—'}</p>
            )}
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
              <Mail className="w-3 h-3" aria-hidden />
              E-mail
            </p>
            <p className="text-sm font-medium text-gray-900 break-all">{route.company_email?.trim() || '—'}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-xs text-gray-500 mb-1">Pagamento (cliente)</p>
            <p className="text-sm font-medium text-gray-900">{route.payment_status?.trim() || '—'}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-xs text-gray-500 mb-1">Tipo pagamento</p>
            <p className="text-sm font-medium text-gray-900">{route.payment_type?.trim() || '—'}</p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <RouteIcon className="w-4 h-4 shrink-0" aria-hidden />
          Rota
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-lg border border-blue-200 bg-blue-50/80 p-3">
            <div className="flex gap-2">
              <MapPin className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" aria-hidden />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">Origem</p>
                <p className="text-sm font-semibold text-gray-900">
                  {route.origin || '—'}
                  {route.origin_state ? `, ${route.origin_state}` : ''}
                </p>
                {route.origin_address ? <p className="text-xs text-gray-600 mt-1">{route.origin_address}</p> : null}
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-3">
            <div className="flex gap-2">
              <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Destino</p>
                <p className="text-sm font-semibold text-gray-900">
                  {route.destination || '—'}
                  {route.destination_state ? `, ${route.destination_state}` : ''}
                </p>
                {route.destination_address ? (
                  <p className="text-xs text-gray-600 mt-1">{route.destination_address}</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Truck className="w-4 h-4 shrink-0" aria-hidden />
          Veículo e motorista
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-xs text-gray-500 mb-1">Veículo</p>
            <p className="text-sm font-medium text-gray-900">{route.vehicle?.trim() || '—'}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-xs text-gray-500 mb-1">Placa</p>
            <p className="text-sm font-medium text-gray-900">{route.plate?.trim() || '—'}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-xs text-gray-500 mb-1">Peso</p>
            <p className="text-sm font-medium text-gray-900">{route.weight?.trim() || '—'}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-xs text-gray-500 mb-1">Motorista</p>
            <p className="text-sm font-medium text-gray-900">{route.driver_name?.trim() || '—'}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-xs text-gray-500 mb-1">Celular motorista</p>
            {waDriver ? (
              <a href={waDriver} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-green-700 hover:underline">
                {route.driver_phone || '—'}
              </a>
            ) : (
              <p className="text-sm font-medium text-gray-900">{route.driver_phone?.trim() || '—'}</p>
            )}
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-xs text-gray-500 mb-1">Pag. motorista</p>
            <p className="text-sm font-medium text-gray-900">{route.driver_payment_status?.trim() || '—'}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3 lg:col-span-2">
            <p className="text-xs text-gray-500 mb-1">Tipo pag. motorista</p>
            <p className="text-sm font-medium text-gray-900">{route.driver_payment_type?.trim() || '—'}</p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4 shrink-0" aria-hidden />
          Datas e valores
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-xs text-gray-500 mb-1">Coleta</p>
            <p className="text-sm font-medium text-gray-900">{formatDateDdMmYyyy(route.pickup_date) || '—'}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-xs text-gray-500 mb-1">Previsão entrega</p>
            <p className="text-sm font-medium text-gray-900">{formatDateDdMmYyyy(route.estimated_delivery) || '—'}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-xs text-gray-500 mb-1">Valor frete</p>
            <p className="text-sm font-medium text-gray-900">{moneyOrHidden(baseFreight, visibleMoney.freight)}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-xs text-gray-500 mb-1">CTE</p>
            <p className="text-sm font-medium text-gray-900">{moneyOrHidden(route.cte_value, visibleMoney.freight)}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-xs text-gray-500 mb-1">Motorista</p>
            <p className="text-sm font-medium text-gray-900">{moneyOrHidden(route.driver_value, visibleMoney.driver)}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-xs text-gray-500 mb-1">Tributos ({pct}%)</p>
            <p className="text-sm font-medium text-gray-900">
              {moneyOrHidden(
                route.taxes_value ?? calculatePerfTaxesValue(baseFreight, pct),
                visibleMoney.taxes,
              )}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-xs text-gray-500 mb-1">Frete líquido</p>
            <p className="text-sm font-medium text-gray-900">
              {moneyOrHidden(
                route.net_freight_value ?? calculatePerfNetFreightValue(baseFreight, route.driver_value, pct),
                visibleMoney.netFreight,
              )}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-xs text-gray-500 mb-1">Comissão</p>
            <p className="text-sm font-medium text-gray-900">
              {moneyOrHidden(
                route.commission_value ??
                  calculatePerfCommissionValue(
                    route.net_freight_value ?? calculatePerfNetFreightValue(baseFreight, route.driver_value, pct),
                  ),
                visibleMoney.commission,
              )}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-xs text-gray-500 mb-1">NF</p>
            <p className="text-sm font-medium text-gray-900">{moneyOrHidden(route.nf_value, visibleMoney.nfTable)}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3 sm:col-span-2">
            <p className="text-xs text-gray-500 mb-1">Observação</p>
            <p className="text-sm font-medium text-gray-900 whitespace-pre-wrap">{route.observation?.trim() || '—'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PerformancePage() {
  const selectOptionClass = 'bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100'
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [role, setRole] = useState<UserRole>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserName, setCurrentUserName] = useState<string>('Usuário')
  const [periodo, setPeriodo] = useState<Periodo>('tudo')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [rows, setRows] = useState<Route[]>([])
  const [comerciais, setComerciais] = useState<ComercialUser[]>([])
  const [selectedComercial, setSelectedComercial] = useState<'all' | string>('all')
  const [didInitSelectedComercial, setDidInitSelectedComercial] = useState(false)
  const [visibleMoney, setVisibleMoney] = useState<Record<MoneyFieldKey, boolean>>(ALL_MONEY_VISIBLE)
  const [selectedPerfRoute, setSelectedPerfRoute] = useState<Route | null>(null)
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)
  const [documents, setDocuments] = useState<Record<DocumentKey, RouteDocument[]>>(EMPTY_DOCUMENTS)
  const [uploadingDocument, setUploadingDocument] = useState<DocumentKey | null>(null)
  const [removingDocumentPath, setRemovingDocumentPath] = useState<string | null>(null)
  const [editingFinancial, setEditingFinancial] = useState(false)
  const [savingFinancial, setSavingFinancial] = useState(false)
  const [editingFields, setEditingFields] = useState({
    cteValue: '',
    driverValue: '',
    taxesPercent: '18',
  })
  const [editingDriver, setEditingDriver] = useState(false)
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
    setEditingFinancial(false)
  }, [periodo, customStart, customEnd, selectedComercial])

  useEffect(() => {
    if (!selectedPerfRoute) {
      setDocuments(EMPTY_DOCUMENTS)
      setSelectedPhoto(null)
      setUploadingDocument(null)
      setRemovingDocumentPath(null)
      setEditingFinancial(false)
      setEditingDriver(false)
      return
    }

    setEditingFields({
      cteValue:
        selectedPerfRoute.cte_value != null ? String(selectedPerfRoute.cte_value).replace('.', ',') : '',
      driverValue:
        selectedPerfRoute.driver_value != null ? String(selectedPerfRoute.driver_value).replace('.', ',') : '',
      taxesPercent: String(getPerfRouteTaxesPercent(selectedPerfRoute)),
    })
    setEditingDriverFields({
      driverName: selectedPerfRoute.driver_name ?? '',
      driverPhone: selectedPerfRoute.driver_phone ?? '',
      driverPaymentStatus: selectedPerfRoute.driver_payment_status ?? '',
      driverPaymentType: selectedPerfRoute.driver_payment_type ?? '',
      vehicle: selectedPerfRoute.vehicle ?? '',
      plate: selectedPerfRoute.plate ?? '',
    })
    setEditingDriver(false)

    let cancelled = false
    ;(async () => {
      try {
        const folder = `documents/${selectedPerfRoute.id}`
        const { data, error } = await supabase.storage
          .from('checkin-photos')
          .list(folder, { limit: 100, sortBy: { column: 'created_at', order: 'asc' } })
        if (error) throw error
        if (cancelled) return
        const items = (data || []).filter((entry) => entry.name && entry.name.startsWith('freteDocs-'))
        const docs: RouteDocument[] = items.map((entry) => {
          const path = `${folder}/${entry.name}`
          const { data: pub } = supabase.storage.from('checkin-photos').getPublicUrl(path)
          return { path, url: pub.publicUrl, name: entry.name, kind: getDocumentKind(entry.name) }
        })
        setDocuments({ freteDocs: docs })
      } catch {
        if (!cancelled) setDocuments(EMPTY_DOCUMENTS)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [selectedPerfRoute])

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
        if (!didInitSelectedComercial) {
          setSelectedComercial(uid)
          setDidInitSelectedComercial(true)
        }

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
          .select('*')
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

        const normalizedRows: Route[] = rawRows.map((r) => normalizeRouteFromApi(r))

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
  }, [periodo, customStart, customEnd, selectedComercial, didInitSelectedComercial])

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
        existing.totalNetFreightValue += getPerfRouteNetFreightValue(r)
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
        totalNetFreightValue: getPerfRouteNetFreightValue(r),
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
    const totalNetFreightValue = filteredRows.reduce((sum, r) => sum + getPerfRouteNetFreightValue(r), 0)
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
  const isStrictAdmin = role === 'admin'
  const canManagePerfModal = role === 'admin' || role === 'financeiro'
  /** Coluna Rotas: admin/financeiro (detalhe na própria página) ou link para fretes próprios. */
  const showRotasColumn = useMemo(
    () =>
      Boolean(
        currentUserId &&
          detailedRows.length > 0 &&
          (isAdmin ||
            detailedRows.some(({ route: r }) => r.created_by_user_id && r.created_by_user_id === currentUserId)),
      ),
    [currentUserId, detailedRows, isAdmin],
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

  const handleSaveFinancialFields = useCallback(async () => {
    if (!selectedPerfRoute || !canManagePerfModal) return
    try {
      setSavingFinancial(true)
      const taxesPercent = normalizeTaxesPercentPerf(Number(editingFields.taxesPercent))
      const cteValue = parseCurrencyInput(editingFields.cteValue)
      const driverValue = parseCurrencyInput(editingFields.driverValue)
      const baseFreight = selectedPerfRoute.freight_value ?? selectedPerfRoute.nf_value
      const taxesValue = calculatePerfTaxesValue(baseFreight, taxesPercent)
      const netFreightValue = calculatePerfNetFreightValue(baseFreight, driverValue, taxesPercent)
      const commissionValue = calculatePerfCommissionValue(netFreightValue)

      const updatePayload: Partial<Route> = {
        cte_value: cteValue,
        driver_value: driverValue,
        taxes_percent: taxesPercent,
        taxes_value: taxesValue,
        net_freight_value: netFreightValue,
        commission_value: commissionValue,
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
      setEditingFinancial(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar campos financeiros.'
      alert(msg)
    } finally {
      setSavingFinancial(false)
    }
  }, [selectedPerfRoute, canManagePerfModal, editingFields, parseCurrencyInput])

  const handleSaveDriverFields = useCallback(async () => {
    if (!selectedPerfRoute || !canManagePerfModal) return
    try {
      setSavingDriver(true)
      const updatePayload = {
        driver_name: editingDriverFields.driverName.trim() || null,
        driver_phone: editingDriverFields.driverPhone.trim() || null,
        driver_payment_status: editingDriverFields.driverPaymentStatus.trim() || null,
        driver_payment_type: editingDriverFields.driverPaymentType.trim() || null,
        vehicle: editingDriverFields.vehicle.trim() || null,
        plate: editingDriverFields.plate.trim() || null,
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
      setEditingDriver(false)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao salvar dados do motorista.')
    } finally {
      setSavingDriver(false)
    }
  }, [selectedPerfRoute, canManagePerfModal, editingDriverFields])

  const handleUploadDocuments = useCallback(
    async (documentKey: DocumentKey, files: FileList | null) => {
      if (!canManagePerfModal || !selectedPerfRoute) return
      if (!files || files.length === 0) return

      const list = Array.from(files)
      const invalid = list.find((f) => !ALLOWED_DOCUMENT_TYPES.includes(f.type) && !f.type.startsWith('image/'))
      if (invalid) {
        alert('Envie apenas imagens (JPG, PNG, WEBP) ou PDF.')
        return
      }
      const tooLargePdf = list.find((f) => f.type === 'application/pdf' && f.size > MAX_PDF_SIZE_BYTES)
      if (tooLargePdf) {
        alert('Cada PDF pode ter no máximo 20 MB.')
        return
      }

      try {
        setUploadingDocument(documentKey)
        const uploaded: RouteDocument[] = []
        for (const original of list) {
          const isPdf = original.type === 'application/pdf'
          const file = isPdf ? original : await compressImage(original)
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
          const filePath = `documents/${selectedPerfRoute.id}/${documentKey}-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 8)}-${safeName}`

          const { data, error: uploadError } = await supabase.storage
            .from('checkin-photos')
            .upload(filePath, file, { cacheControl: '3600', upsert: false, contentType: file.type })
          if (uploadError) throw uploadError

          const { data: pub } = supabase.storage.from('checkin-photos').getPublicUrl(data.path)
          const finalName = data.path.split('/').pop() ?? data.path
          uploaded.push({ path: data.path, url: pub.publicUrl, name: finalName, kind: getDocumentKind(finalName) })
        }
        setDocuments((prev) => ({ ...prev, [documentKey]: [...prev[documentKey], ...uploaded] }))
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
        const { error: removeError } = await supabase.storage.from('checkin-photos').remove([doc.path])
        if (removeError) throw removeError
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
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-300 pointer-events-none" aria-hidden />
              <select
                value={selectedComercial}
                onChange={(e) => setSelectedComercial(e.target.value)}
                className="appearance-none rounded-xl border border-gray-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900 pl-9 pr-8 py-2 text-xs text-gray-700 dark:text-slate-100 hover:bg-white dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-800/20 cursor-pointer"
                aria-label="Filtrar por vendedor"
              >
                <option value="all" className={selectOptionClass}>Todos os vendedores ({rows.length})</option>
                {comerciais
                  .filter((u) => u.role === 'comercial' || u.role === 'operator' || u.role === 'admin')
                  .map((u) => {
                    const count = rows.filter((r) => r.created_by_user_id === u.id).length
                    const label = u.name || u.email
                    return (
                      <option key={u.id} value={u.id} className={selectOptionClass}>
                        {label} ({count})
                      </option>
                    )
                  })}
                {hasSemResponsavel && (
                  <option value="__sem_responsavel__" className={selectOptionClass}>
                    Sem responsável ({rows.filter((r) => !r.created_by_user_id).length})
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
            visible={visibleMoney.driver}
            onToggle={() => toggleMoneyField('driver')}
          />
        </div>
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-500 p-4">
          <p className="text-xs text-gray-500 dark:text-slate-300">Valor dos tribultos</p>
          <MoneyValueRow
            value={totals.totalTaxesValue}
            visible={visibleMoney.taxes}
            onToggle={() => toggleMoneyField('taxes')}
          />
        </div>
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-500 p-4">
          <p className="text-xs text-gray-500 dark:text-slate-300">Valor dos fretes líquidos</p>
          <MoneyValueRow
            value={totals.totalNetFreightValue}
            visible={visibleMoney.netFreight}
            onToggle={() => toggleMoneyField('netFreight')}
          />
        </div>
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-500 p-4">
          <p className="text-xs text-gray-500 dark:text-slate-300">Valor total de comissões</p>
          <MoneyValueRow
            value={totals.totalCommissionValue}
            visible={visibleMoney.commission}
            onToggle={() => toggleMoneyField('commission')}
          />
        </div>
      </div>

      {isAdmin ? (
        <div className="rounded-2xl border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="px-4 md:px-5 py-4 border-b border-gray-100 dark:border-slate-500 flex items-center justify-between gap-2 flex-wrap">
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
            </div>
          </div>
          <div className="overflow-x-auto px-1 md:px-2">
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
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-900 overflow-hidden">
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
            </div>
          </div>
          <div className="overflow-x-auto px-1 md:px-2">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 dark:bg-slate-800 dark:text-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">#</th>
                  <th className="text-left px-4 py-3 font-semibold border-r border-gray-200/80">
                    Cliente
                  </th>
                  <th className="text-left px-4 py-3 font-semibold">
                    Rota
                  </th>
                  <th className="text-left px-4 py-3 font-semibold">Vendedor</th>
                  <th className="text-left px-4 py-3 font-semibold">Status</th>
                  <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Frete</th>
                  <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Comissão</th>
                  <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Data</th>
                  {showRotasColumn ? (
                    <th className="text-right px-4 py-3 font-semibold whitespace-nowrap">Detalhes</th>
                  ) : null}
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
                    ? new Date(r.created_at).toLocaleDateString('pt-BR', DATE_BR_NUMERIC)
                    : '—'
                  return (
                    <tr key={r.id} className="border-t border-gray-100 dark:border-slate-700 hover:bg-gray-50/60 dark:hover:bg-slate-800/60">
                        <td className="px-4 py-3 align-top font-medium text-gray-900 dark:text-slate-100 whitespace-nowrap">
                          <div className="flex flex-col items-start gap-1.5">
                            <span>{r.freight_id > 0 ? `#${r.freight_id}` : '—'}</span>
                            {isStrictAdmin ? (
                              <CommissionPaidToggle
                                paid={Boolean(r.commission_paid)}
                                loading={commissionToggleRouteId === r.id}
                                onClick={() => void handleToggleCommissionPaid(r)}
                              />
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top border-r border-gray-100 dark:border-slate-700">
                          <p className="text-gray-900 dark:text-slate-100 truncate" title={r.company_name?.trim() || '—'}>
                            {r.company_name?.trim() || '—'}
                          </p>
                        </td>
                        <td className="px-4 py-3 align-top whitespace-nowrap">
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
                        </td>
                        <td className="px-4 py-3 align-top">
                          <p className="font-medium text-gray-900 dark:text-slate-100">{sellerName}</p>
                          {sellerEmail ? (
                            <p className="text-xs text-gray-500 dark:text-slate-400">{sellerEmail}</p>
                          ) : null}
                          {sellerRole ? (
                            <span className="inline-block mt-0.5 text-[10px] uppercase tracking-wide text-gray-500 dark:text-slate-400">
                              {sellerRole}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium ${statusClass}`}
                          >
                            {statusLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top whitespace-nowrap">
                          {visibleMoney.freight
                            ? formatBRL(r.freight_value ?? r.nf_value ?? 0)
                            : 'R$ ••••••'}
                        </td>
                        <td className="px-4 py-3 align-top whitespace-nowrap">
                          {visibleMoney.commission
                            ? formatBRL(r.commission_value ?? 0)
                            : 'R$ ••••••'}
                        </td>
                        <td className="px-4 py-3 align-top text-xs text-gray-600 dark:text-slate-300 whitespace-nowrap">
                          {created}
                        </td>
                        {showRotasColumn ? (
                          <td className="px-4 py-3 align-top text-right whitespace-nowrap">
                            {isAdmin || (r.created_by_user_id && r.created_by_user_id === currentUserId) ? (
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
          </div>
        </div>
      )}

      {selectedPerfRoute ? (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedPerfRoute(null)}
        >
          <div
            className="bg-white text-gray-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto dark:bg-white dark:text-gray-900 [&_.text-gray-900]:!text-gray-900 [&_.text-gray-700]:!text-gray-700 [&_.text-gray-600]:!text-gray-700 [&_.text-gray-500]:!text-gray-600 [&_.bg-white]:!bg-white [&_.bg-gray-50]:!bg-gray-50 [&_.border-gray-200]:!border-gray-200"
            style={{ colorScheme: 'light' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10 dark:bg-white dark:border-gray-200">
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
                      <CommissionPaidToggle
                        paid={Boolean(selectedPerfRoute.commission_paid)}
                        loading={commissionToggleRouteId === selectedPerfRoute.id}
                        onClick={() => void handleToggleCommissionPaid(selectedPerfRoute)}
                        compact={false}
                      />
                    ) : null}
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
              <PerfFreightDetailPanel route={selectedPerfRoute} visibleMoney={visibleMoney} />
              {canManagePerfModal ? (
                <div className="mt-6 space-y-6">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <h3 className="text-sm font-semibold text-gray-900">Campos financeiros</h3>
                      {editingFinancial ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingFinancial(false)
                              setEditingFields({
                                cteValue:
                                  selectedPerfRoute.cte_value != null
                                    ? String(selectedPerfRoute.cte_value).replace('.', ',')
                                    : '',
                                driverValue:
                                  selectedPerfRoute.driver_value != null
                                    ? String(selectedPerfRoute.driver_value).replace('.', ',')
                                    : '',
                                taxesPercent: String(getPerfRouteTaxesPercent(selectedPerfRoute)),
                              })
                            }}
                            className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 bg-white hover:bg-gray-100"
                            disabled={savingFinancial}
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveFinancialFields}
                            className="px-3 py-1.5 text-xs rounded-lg bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-60"
                            disabled={savingFinancial}
                          >
                            {savingFinancial ? 'Salvando...' : 'Salvar'}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditingFinancial(true)}
                          className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 bg-white hover:bg-gray-100"
                        >
                          Editar
                        </button>
                      )}
                    </div>
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Valor de CTE</label>
                        <input
                          type="text"
                          value={editingFields.cteValue}
                          onChange={(e) => setEditingFields((prev) => ({ ...prev, cteValue: e.target.value }))}
                          disabled={!editingFinancial || savingFinancial}
                          placeholder="Ex.: 1234,56"
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white disabled:bg-gray-100 disabled:text-gray-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Valor do motorista</label>
                        <input
                          type="text"
                          value={editingFields.driverValue}
                          onChange={(e) => setEditingFields((prev) => ({ ...prev, driverValue: e.target.value }))}
                          disabled={!editingFinancial || savingFinancial}
                          placeholder="Ex.: 980,50"
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white disabled:bg-gray-100 disabled:text-gray-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Tributos (%)</label>
                        <select
                          value={editingFields.taxesPercent}
                          onChange={(e) => setEditingFields((prev) => ({ ...prev, taxesPercent: e.target.value }))}
                          disabled={!editingFinancial || savingFinancial}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white disabled:bg-gray-100 disabled:text-gray-500"
                        >
                          {TAXES_PERCENT_OPTIONS.map((pct) => (
                            <option key={pct} value={String(pct)}>
                              {pct}%
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <h3 className="text-sm font-semibold text-gray-900">Dados do motorista</h3>
                      {editingDriver ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingDriver(false)
                              setEditingDriverFields({
                                driverName: selectedPerfRoute.driver_name ?? '',
                                driverPhone: selectedPerfRoute.driver_phone ?? '',
                                driverPaymentStatus: selectedPerfRoute.driver_payment_status ?? '',
                                driverPaymentType: selectedPerfRoute.driver_payment_type ?? '',
                                vehicle: selectedPerfRoute.vehicle ?? '',
                                plate: selectedPerfRoute.plate ?? '',
                              })
                            }}
                            className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 bg-white hover:bg-gray-100"
                            disabled={savingDriver}
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveDriverFields}
                            className="px-3 py-1.5 text-xs rounded-lg bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-60"
                            disabled={savingDriver}
                          >
                            {savingDriver ? 'Salvando...' : 'Salvar'}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditingDriver(true)}
                          className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 bg-white hover:bg-gray-100"
                        >
                          Editar
                        </button>
                      )}
                    </div>
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Nome do motorista</label>
                        <input
                          type="text"
                          value={editingDriverFields.driverName}
                          onChange={(e) => setEditingDriverFields((prev) => ({ ...prev, driverName: e.target.value }))}
                          disabled={!editingDriver || savingDriver}
                          placeholder="Nome completo"
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white disabled:bg-gray-100 disabled:text-gray-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Celular do motorista</label>
                        <input
                          type="text"
                          value={editingDriverFields.driverPhone}
                          onChange={(e) => setEditingDriverFields((prev) => ({ ...prev, driverPhone: e.target.value }))}
                          disabled={!editingDriver || savingDriver}
                          placeholder="(11) 99999-9999"
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white disabled:bg-gray-100 disabled:text-gray-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Status pagamento motorista</label>
                        <select
                          value={editingDriverFields.driverPaymentStatus}
                          onChange={(e) => setEditingDriverFields((prev) => ({ ...prev, driverPaymentStatus: e.target.value }))}
                          disabled={!editingDriver || savingDriver}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white disabled:bg-gray-100 disabled:text-gray-500"
                        >
                          <option value="">—</option>
                          <option value="pending">Pendente</option>
                          <option value="paid">Pago</option>
                          <option value="partial">Parcial</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Tipo pagamento motorista</label>
                        <input
                          type="text"
                          value={editingDriverFields.driverPaymentType}
                          onChange={(e) => setEditingDriverFields((prev) => ({ ...prev, driverPaymentType: e.target.value }))}
                          disabled={!editingDriver || savingDriver}
                          placeholder="Ex.: PIX, Transferência"
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white disabled:bg-gray-100 disabled:text-gray-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Veículo</label>
                        <input
                          type="text"
                          value={editingDriverFields.vehicle}
                          onChange={(e) => setEditingDriverFields((prev) => ({ ...prev, vehicle: e.target.value }))}
                          disabled={!editingDriver || savingDriver}
                          placeholder="Ex.: Carreta"
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white disabled:bg-gray-100 disabled:text-gray-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Placa</label>
                        <input
                          type="text"
                          value={editingDriverFields.plate}
                          onChange={(e) => setEditingDriverFields((prev) => ({ ...prev, plate: e.target.value }))}
                          disabled={!editingDriver || savingDriver}
                          placeholder="Ex.: ABC-1234"
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white disabled:bg-gray-100 disabled:text-gray-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                      <p className="text-xs text-gray-700 font-semibold uppercase tracking-wide">Anexos do frete</p>
                      <span className="text-[11px] text-gray-500">
                        {documents.freteDocs.length} {documents.freteDocs.length === 1 ? 'arquivo' : 'arquivos'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      Adicione imagens ou PDF (até 20 MB por PDF) sem sair da tela de performance.
                    </p>
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

                    {documents.freteDocs.length > 0 ? (
                      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {documents.freteDocs.map((doc) => {
                          const isRemoving = removingDocumentPath === doc.path
                          return (
                            <div
                              key={doc.path}
                              className="group relative aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center"
                            >
                              {doc.kind === 'pdf' ? (
                                <a
                                  href={doc.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex flex-col items-center justify-center w-full h-full p-2 text-center text-gray-700 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-800"
                                  title={doc.name}
                                >
                                  <FileText className="w-10 h-10 text-red-600 mb-1" />
                                  <span className="text-[11px] font-semibold uppercase tracking-wide text-red-700">PDF</span>
                                  <span className="text-[10px] text-gray-500 mt-1 line-clamp-2 break-all">
                                    {doc.name.replace(/^freteDocs-\d+-[a-z0-9]+-/, '')}
                                  </span>
                                </a>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setSelectedPhoto(doc.url)}
                                  className="block w-full h-full focus:outline-none focus:ring-2 focus:ring-slate-800"
                                  aria-label="Visualizar imagem"
                                >
                                  <img
                                    src={doc.url}
                                    alt="Documento do frete"
                                    className="h-full w-full object-contain transition-opacity group-hover:opacity-95"
                                    loading="lazy"
                                  />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleRemoveDocument('freteDocs', doc)}
                                disabled={isRemoving}
                                className="absolute top-1.5 right-1.5 inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/90 text-red-600 shadow border border-gray-200 hover:bg-red-50 transition-colors disabled:opacity-60 disabled:cursor-wait"
                                title="Remover arquivo"
                                aria-label="Remover arquivo"
                              >
                                {isRemoving ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    ) : null}
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

