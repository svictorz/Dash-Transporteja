'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Route, MapPin, ArrowRight, X, Truck, Calendar, Building2, Phone, Mail, Plus, Edit, Trash2, Loader2, Search, Upload, Eye, ChevronDown } from 'lucide-react'
import { useRoutes } from '@/lib/hooks/useRoutes'
import { useClients } from '@/lib/hooks/useClients'
import { useDrivers } from '@/lib/hooks/useDrivers'
import {
  Route as RouteType,
  CreateRouteData,
  ROUTE_NO_DRIVER_PLATE,
  ROUTE_NO_DRIVER_VEHICLE,
} from '@/lib/services/routes'
import { Client, ensureClientByCnpj, getClients } from '@/lib/services/clients'
import { formatCNPJDisplay } from '@/lib/services/cnpj'
import { validateCNPJ } from '@/lib/utils/validation'
import { Driver } from '@/lib/services/drivers'
import CEPInput from '@/components/transporteja/CEPInput'
import CommissionPaidStatus from '@/components/transporteja/CommissionPaidStatus'
import { CEPData } from '@/lib/services/cep'
import { findCityMatch, prefetchCityIndex } from '@/lib/services/ibge'
import { supabase } from '@/lib/supabase/client'
import { useAuthState } from '@/lib/hooks/useAuthState'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import { useDebouncedRouteDistance } from '@/lib/hooks/useDebouncedRouteDistance'
import { equalsFold } from '@/lib/utils/strings'
import {
  SEGURO_PERCENT_CHOICES,
  SEGURO_PERCENT_DEFAULT,
  TAXES_PERCENT_CHOICES,
  calculateCommissionValue,
  calculateNetFreightValue,
  calculateSeguroValue,
  calculateTaxesValue,
  getRouteCommissionValue,
  getRouteNetFreightValue,
  getRouteDriverTotalValue,
  isValePedagioIncluso,
  getRouteSeguroPercent,
  getRouteSeguroValue,
  getRouteTaxesPercent,
  getRouteTaxesValue,
  normalizeSeguroPercent,
  normalizeTaxesPercent,
} from '@/lib/utils/freight-financials'
import { DATE_BR_NUMERIC, formatDateDdMmYyyy } from '@/lib/utils/date-format'
import { canEditValePedagioIncluso, canViewRouteInRoutesPage } from '@/lib/utils/roles'
import { getWhatsAppWebUrl } from '@/lib/utils/whatsapp'
import { createFreightDocumentService, type FreightDocument } from '@/lib/services/freight-documents'
import FreightDocumentGallery from '@/components/transporteja/FreightDocumentGallery'
import {
  ROUTE_PERIOD_FILTER_HINT,
  filterRoutesByDateRange,
  startOfDay,
} from '@/lib/utils/route-period-filter'

type PeriodKey = '7d' | 'month' | 'prevMonth' | 'all' | 'custom'

const PERIOD_OPTIONS: { value: PeriodKey; label: string; short: string }[] = [
  { value: '7d', label: '7 dias', short: '7d' },
  { value: 'month', label: 'Este mês', short: 'Mês' },
  { value: 'prevMonth', label: 'Mês passado', short: 'M. ant.' },
  { value: 'all', label: 'Todo período', short: 'Tudo' },
  { value: 'custom', label: 'Personalizado', short: 'Custom' },
]

const PERIOD_STORAGE_KEY = 'rotas:period'

function periodRange(period: PeriodKey, now = new Date(), customStart?: string, customEnd?: string): { start: Date | null; end: Date | null } {
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)
  if (period === 'all') return { start: null, end: null }
  if (period === '7d') return { start: startOfDay(new Date(now.getTime() - 6 * 86400000)), end }
  // "Este mês" cobre o mês inteiro (inclui dias futuros do mês corrente),
  // não apenas até hoje — senão fretes com coleta futura no mês somem.
  if (period === 'month')
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
    }
  if (period === 'prevMonth') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0)
    const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
    return { start, end: prevEnd }
  }
  if (period === 'custom') {
    const s = customStart ? new Date(customStart + 'T00:00:00') : null
    const e = customEnd ? new Date(customEnd + 'T23:59:59') : end
    return { start: s, end: e }
  }
  return { start: null, end }
}

// Interface para exibição (com dados do cliente)
interface RouteDisplayData extends RouteType {
  client?: Client
  driver?: Driver
}

type DocumentKey = 'freteDocs'
type RouteStatus = RouteType['status']
type RouteDocument = FreightDocument
const freightDocuments = createFreightDocumentService(supabase.storage.from('checkin-photos'))
const EMPTY_DOCUMENTS: Record<DocumentKey, RouteDocument[]> = {
  freteDocs: [],
}

const ROUTE_STATUS_OPTIONS: RouteStatus[] = ['pending', 'pickedUp', 'inTransit', 'delivered', 'documentation', 'cancelled']
const PAYMENT_STATUS_OPTIONS = ['Pendente', '50%', '70%', '100%'] as const
const PAYMENT_TYPE_OPTIONS = ['Pix', 'Link de Pagamento', 'Boleto'] as const
const DRIVER_PAYMENT_TYPE_OPTIONS = ['Pendente', '50%', '70%', '100%'] as const

export default function RotasPage() {
  const { session } = useAuthState()
  const { user: currentUser } = useCurrentUser()
  const router = useRouter()
  const searchParams = useSearchParams()
  const processedRouteQueryId = useRef<string | null>(null)
  const isAdminUser = currentUser?.role === 'admin'
  /** Motorista vê a rota mas não envia/remove comprovantes (anexos são do escritório). */
  const canManageFreightDocuments = currentUser?.role !== 'driver'
  const canChangeTollInclusion = canEditValePedagioIncluso(currentUser?.role)
  const { routes, loading: routesLoading, error: routesError, createRoute, updateRoute, deleteRoute } = useRoutes()
  const { clients, loading: clientsLoading } = useClients()
  const { drivers, loading: driversLoading } = useDrivers()

  /**
   * Na aba Rotas, cada usuário vê apenas os fretes que ele mesmo adicionou.
   */
  const myRoutes = useMemo(() => {
    const uid = session?.user?.id
    if (!uid) return []
    return routes.filter((r) => canViewRouteInRoutesPage(currentUser?.role, uid, r.created_by_user_id ?? null))
  }, [routes, session?.user?.id, currentUser?.role])

  const myClients = useMemo(() => {
    const uid = session?.user?.id
    if (!uid) return []
    return clients.filter((c) => c.created_by_user_id === uid)
  }, [clients, session?.user?.id])

  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'inTransit' | 'pickedUp' | 'delivered' | 'documentation' | 'cancelled'>('all')
  const [period, setPeriod] = useState<PeriodKey>('month')
  const [mounted, setMounted] = useState(false)
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  useEffect(() => {
    setMounted(true)
    try {
      const saved = localStorage.getItem(PERIOD_STORAGE_KEY) as PeriodKey | null
      if (saved && PERIOD_OPTIONS.some((o) => o.value === saved)) setPeriod(saved)
    } catch {}
  }, [])

  useEffect(() => {
    if (!mounted) return
    try { localStorage.setItem(PERIOD_STORAGE_KEY, period) } catch {}
  }, [period, mounted])

  const { start, end } = useMemo(() => periodRange(period, new Date(), customStart, customEnd), [period, customStart, customEnd])
  const [selectedRoute, setSelectedRoute] = useState<RouteDisplayData | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingRoute, setEditingRoute] = useState<RouteType | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)
  const [documents, setDocuments] = useState<Record<DocumentKey, RouteDocument[]>>(EMPTY_DOCUMENTS)
  const [documentsLoading, setDocumentsLoading] = useState(false)
  const [documentsError, setDocumentsError] = useState<string | null>(null)
  const documentLoadSequence = useRef(0)
  const [uploadingDocument, setUploadingDocument] = useState<DocumentKey | null>(null)
  const [removingDocumentPath, setRemovingDocumentPath] = useState<string | null>(null)
  const [updatingStatusRouteId, setUpdatingStatusRouteId] = useState<string | null>(null)
  const [commissionToggleRouteId, setCommissionToggleRouteId] = useState<string | null>(null)
  
  const [companyInput, setCompanyInput] = useState('')
  const [companyLookup, setCompanyLookup] = useState<{ kind: 'idle' | 'loading' | 'existing' | 'new' | 'error'; cnpj: string; message?: string }>({ kind: 'idle', cnpj: '' })
  const companyLookupSequence = useRef(0)
  
  // Estado do formulário
  const [formData, setFormData] = useState({
    origin: '',
    originState: '',
    originAddress: '',
    destination: '',
    destinationState: '',
    destinationAddress: '',
    companyPhone: '',
    companyEmail: '',
    companyCnpj: '',
    companyResponsible: '',
    weight: '',
    cubageM3: '',
    materialType: '',
    freightValue: '',
    cteValue: '',
    valePedagio: '',
    valePedagioIncluso: 'true',
    driverValue: '',
    taxesValue: '',
    netFreightValue: '',
    commissionValue: '',
    paymentStatus: '',
    paymentType: '',
    freightType: '',
    driverName: '',
    driverPhone: '',
    driverPaymentStatus: '',
    driverPaymentType: '',
    nfValue: '',
    observation: '',
    estimatedDelivery: '',
    pickupDate: '',
    taxesPercent: '18',
    seguroPercent: String(SEGURO_PERCENT_DEFAULT),
  })
  const [originCEP, setOriginCEP] = useState('')
  const [destinationCEP, setDestinationCEP] = useState('')

  const origemGeoQuery = useMemo(() => {
    if (!formData.origin.trim() || !formData.originState.trim()) return ''
    return [formData.origin.trim(), formData.originState.trim(), formData.originAddress.trim()]
      .filter(Boolean)
      .join(', ')
  }, [formData.origin, formData.originState, formData.originAddress])

  const destinoGeoQuery = useMemo(() => {
    if (!formData.destination.trim() || !formData.destinationState.trim()) return ''
    return [formData.destination.trim(), formData.destinationState.trim(), formData.destinationAddress.trim()]
      .filter(Boolean)
      .join(', ')
  }, [formData.destination, formData.destinationState, formData.destinationAddress])

  const modalGeoActive = (showCreateModal || showEditModal) && !!origemGeoQuery && !!destinoGeoQuery

  const routeDistance = useDebouncedRouteDistance(origemGeoQuery, destinoGeoQuery, modalGeoActive, 1000)

  const displayedDistanceKm = useMemo(() => {
    if (routeDistance.distanciaKm != null) return routeDistance.distanciaKm
    if (showEditModal && editingRoute?.distance_km != null && editingRoute.distance_km > 0) {
      return editingRoute.distance_km
    }
    return null
  }, [routeDistance.distanciaKm, showEditModal, editingRoute?.distance_km])

  // Combinar rotas com dados de clientes e motoristas
  const routesWithDetails = useMemo(() => {
    return myRoutes.map(route => {
      const client = myClients.find(c =>
        equalsFold(c.company_name, route.company_name) ||
        (!!route.company_email && equalsFold(c.email, route.company_email))
      )
      const driver = route.driver_id
        ? drivers.find(d => d.id === route.driver_id)
        : undefined
      
      return {
        ...route,
        client,
        driver
      } as RouteDisplayData
    })
  }, [myRoutes, myClients, drivers])

  const periodFilteredRoutes = useMemo(() => {
    return filterRoutesByDateRange(routesWithDetails, start, end)
  }, [routesWithDetails, start, end])

  const filteredRoutes = useMemo(() => {
    return periodFilteredRoutes.filter(route => filterStatus === 'all' || route.status === filterStatus)
  }, [periodFilteredRoutes, filterStatus])

  const statusCounts = useMemo(() => ({
    all: periodFilteredRoutes.length,
    pending: periodFilteredRoutes.filter(r => r.status === 'pending').length,
    inTransit: periodFilteredRoutes.filter(r => r.status === 'inTransit').length,
    pickedUp: periodFilteredRoutes.filter(r => r.status === 'pickedUp').length,
    delivered: periodFilteredRoutes.filter(r => r.status === 'delivered').length,
    documentation: periodFilteredRoutes.filter(r => r.status === 'documentation').length,
    cancelled: periodFilteredRoutes.filter(r => r.status === 'cancelled').length
  }), [periodFilteredRoutes])

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'inTransit':
        return {
          label: 'Em Trânsito',
          emoji: '🟠',
          dotColor: 'bg-orange-500',
          bgColor: 'bg-orange-100',
          textColor: 'text-orange-700',
          borderColor: 'border-orange-200'
        }
      case 'delivered':
        return {
          label: 'Entregue',
          emoji: '🟢',
          dotColor: 'bg-green-500',
          bgColor: 'bg-green-100',
          textColor: 'text-green-700',
          borderColor: 'border-green-200'
        }
      case 'documentation':
        return {
          label: 'Documentação',
          emoji: '🔵',
          dotColor: 'bg-blue-500',
          bgColor: 'bg-blue-100',
          textColor: 'text-blue-700',
          borderColor: 'border-blue-200'
        }
      case 'pickedUp':
        return {
          label: 'Coletado',
          emoji: '⚪',
          dotColor: 'bg-gray-500',
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-700',
          borderColor: 'border-gray-200'
        }
      case 'pending':
        return {
          label: 'Pendente',
          emoji: '🟡',
          dotColor: 'bg-yellow-500',
          bgColor: 'bg-yellow-100',
          textColor: 'text-yellow-700',
          borderColor: 'border-yellow-200'
        }
      case 'cancelled':
        return {
          label: 'Cancelado',
          emoji: '🔴',
          dotColor: 'bg-red-500',
          bgColor: 'bg-red-100',
          textColor: 'text-red-700',
          borderColor: 'border-red-200'
        }
      default:
        return {
          label: 'Desconhecido',
          emoji: '⚫',
          dotColor: 'bg-gray-500',
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-700',
          borderColor: 'border-gray-200'
        }
    }
  }

  const handleUpdateRouteStatus = useCallback(async (route: RouteDisplayData, status: RouteStatus) => {
    if (route.status === status) return

    try {
      setUpdatingStatusRouteId(route.id)
      await updateRoute(route.id, { status })
    } catch (err: any) {
      alert(`Erro ao atualizar status: ${err.message}`)
    } finally {
      setUpdatingStatusRouteId(null)
    }
  }, [updateRoute])

  const loadRouteDocuments = useCallback(async (routeId: string) => {
    const sequence = ++documentLoadSequence.current
    setDocumentsLoading(true)
    setDocumentsError(null)
    try {
      const docs = await freightDocuments.list(routeId)
      if (sequence === documentLoadSequence.current) setDocuments({ freteDocs: docs })
    } catch (err) {
      console.warn('Erro ao listar documentos do frete:', err)
      if (sequence === documentLoadSequence.current) setDocumentsError('Não foi possível carregar os anexos deste frete.')
    } finally {
      if (sequence === documentLoadSequence.current) setDocumentsLoading(false)
    }
  }, [])

  const handleViewMore = (route: RouteDisplayData) => {
    setSelectedRoute(route)
    setDocuments(EMPTY_DOCUMENTS)
    setUploadingDocument(null)
    void loadRouteDocuments(route.id)
  }

  const handleOpenEdit = useCallback((route: RouteDisplayData) => {
    setEditingRoute(route)
    const client = myClients.find(c =>
      (!!route.company_cnpj && c.cnpj?.replace(/\D/g, '') === route.company_cnpj.replace(/\D/g, '')) ||
      equalsFold(c.company_name, route.company_name) ||
      (!!route.company_email && equalsFold(c.email, route.company_email))
    )
    setCompanyInput(client?.company_name || route.company_name || '')
    companyLookupSequence.current += 1
    setCompanyLookup({
      kind: client?.cnpj?.replace(/\D/g, '') === route.company_cnpj?.replace(/\D/g, '') && !!route.company_cnpj ? 'existing' : 'idle',
      cnpj: route.company_cnpj?.replace(/\D/g, '') || '',
    })
    setFormData({
      origin: route.origin,
      originState: route.origin_state,
      originAddress: route.origin_address || '',
      destination: route.destination,
      destinationState: route.destination_state,
      destinationAddress: route.destination_address || '',
      companyPhone: route.company_phone || client?.whatsapp || '',
      companyEmail: route.company_email || client?.email || '',
      companyCnpj: route.company_cnpj || '',
      companyResponsible: route.company_responsible || client?.responsible || '',
      weight: route.weight,
      cubageM3: route.cubage_m3 != null ? String(route.cubage_m3).replace('.', ',') : '',
      materialType: route.material_type || '',
      freightValue: route.freight_value != null ? String(route.freight_value).replace('.', ',') : '',
      cteValue: route.cte_value != null ? String(route.cte_value).replace('.', ',') : '',
      valePedagio: route.vale_pedagio != null ? String(route.vale_pedagio).replace('.', ',') : '',
      valePedagioIncluso: isValePedagioIncluso(route.vale_pedagio_incluso) ? 'true' : 'false',
      driverValue: route.driver_value != null ? String(route.driver_value).replace('.', ',') : '',
      taxesValue: route.taxes_value != null ? String(route.taxes_value).replace('.', ',') : '',
      netFreightValue: route.net_freight_value != null ? String(route.net_freight_value).replace('.', ',') : '',
      commissionValue: route.commission_value != null ? String(route.commission_value).replace('.', ',') : '',
      paymentStatus: route.payment_status || '',
      paymentType: route.payment_type || '',
      freightType: route.freight_type || '',
      driverName: route.driver_name || route.driver?.name || '',
      driverPhone: route.driver_phone || route.driver?.phone || '',
      driverPaymentStatus: route.driver_payment_status || '',
      driverPaymentType: route.driver_payment_type || '',
      nfValue: route.nf_value != null ? String(route.nf_value).replace('.', ',') : '',
      observation: route.observation || '',
      estimatedDelivery: route.estimated_delivery,
      pickupDate: route.pickup_date,
      taxesPercent: String(getRouteTaxesPercent(route)),
      seguroPercent: String(getRouteSeguroPercent(route)),
    })
    setShowEditModal(true)
  }, [myClients])

  /** Abre edição quando o painel Performance envia `?route=<uuid>`. */
  useEffect(() => {
    const routeId = searchParams.get('route')
    if (!routeId) {
      processedRouteQueryId.current = null
      return
    }
    if (processedRouteQueryId.current === routeId) return
    if (routesLoading || clientsLoading || driversLoading) return

    processedRouteQueryId.current = routeId
    const match = routesWithDetails.find((r) => r.id === routeId)
    if (match) handleOpenEdit(match)
    router.replace('/rotas', { scroll: false })
  }, [
    searchParams,
    routesLoading,
    clientsLoading,
    driversLoading,
    routesWithDetails,
    handleOpenEdit,
    router,
  ])

  const handleToggleCommissionPaid = useCallback(
    async (routeId: string, currentPaid: boolean) => {
      if (!isAdminUser) return
      setCommissionToggleRouteId(routeId)
      try {
        await updateRoute(routeId, { commission_paid: !currentPaid })
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : 'Erro ao atualizar o status da comissão.'
        alert(msg)
      } finally {
        setCommissionToggleRouteId(null)
      }
    },
    [isAdminUser, updateRoute],
  )

  const handleDeleteRoute = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta rota?')) return
    
    try {
      await deleteRoute(id)
    } catch (err: any) {
      alert(`Erro ao excluir: ${err.message}`)
    }
  }

  const handleCloseModal = () => {
    documentLoadSequence.current += 1
    setSelectedRoute(null)
    setSelectedPhoto(null)
    setDocuments(EMPTY_DOCUMENTS)
    setDocumentsError(null)
    setDocumentsLoading(false)
    setUploadingDocument(null)
    setRemovingDocumentPath(null)
  }

  const handleUploadDocuments = async (documentKey: DocumentKey, files: FileList | null) => {
    if (!canManageFreightDocuments) return
    if (!files || files.length === 0 || !selectedRoute) return

    try {
      setUploadingDocument(documentKey)
      await freightDocuments.upload(selectedRoute.id, Array.from(files), (document) => {
        setDocuments((prev) => ({
          ...prev,
          [documentKey]: [...prev[documentKey], document],
        }))
      })
    } catch (err: any) {
      alert(`Erro ao anexar arquivo: ${err?.message || 'tente novamente.'}`)
    } finally {
      setUploadingDocument(null)
    }
  }

  const handleRemoveDocument = async (documentKey: DocumentKey, doc: RouteDocument) => {
    if (!selectedRoute) return
    if (!canManageFreightDocuments) return
    if (!confirm('Remover este arquivo?')) return

    try {
      setRemovingDocumentPath(doc.path)
      await freightDocuments.remove(selectedRoute.id, doc.path)

      setDocuments((prev) => ({
        ...prev,
        [documentKey]: prev[documentKey].filter((d) => d.path !== doc.path),
      }))
    } catch (err: any) {
      alert(`Erro ao remover imagem: ${err?.message || 'tente novamente.'}`)
    } finally {
      setRemovingDocumentPath(null)
    }
  }

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp)
    if (isNaN(date.getTime())) return { date: '', time: '' }
    return {
      date: date.toLocaleDateString('pt-BR', DATE_BR_NUMERIC),
      time: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    }
  }

  /**
   * Feedback do lookup da cidade no IBGE para cada campo. Mantém UX leve:
   * mostra o nome oficial + UF quando achou, "não reconhecido" quando errou.
   */
  type CityFeedback = { kind: 'idle' } | { kind: 'loading' } | { kind: 'ok'; name: string; state: string } | { kind: 'notfound' }
  const [originCityFeedback, setOriginCityFeedback] = useState<CityFeedback>({ kind: 'idle' })
  const [destinationCityFeedback, setDestinationCityFeedback] = useState<CityFeedback>({ kind: 'idle' })

  /** Quando o modal abre, pré-carrega a lista do IBGE em background. */
  useEffect(() => {
    if (showCreateModal || showEditModal) {
      prefetchCityIndex()
    }
  }, [showCreateModal, showEditModal])

  const resolveCityField = useCallback(
    async (field: 'origin' | 'destination') => {
      const cityValue = field === 'origin' ? formData.origin : formData.destination
      const stateValue = field === 'origin' ? formData.originState : formData.destinationState
      const setFeedback = field === 'origin' ? setOriginCityFeedback : setDestinationCityFeedback

      if (!cityValue.trim()) {
        setFeedback({ kind: 'idle' })
        return
      }
      setFeedback({ kind: 'loading' })
      const match = await findCityMatch(cityValue, stateValue)
      if (!match) {
        setFeedback({ kind: 'notfound' })
        return
      }
      // Atualiza só se houver mudança real (evita re-render desnecessário).
      setFormData((prev) => {
        if (field === 'origin') {
          if (prev.origin === match.name && prev.originState === match.state) return prev
          return { ...prev, origin: match.name, originState: match.state }
        }
        if (prev.destination === match.name && prev.destinationState === match.state) return prev
        return { ...prev, destination: match.name, destinationState: match.state }
      })
      setFeedback({ kind: 'ok', name: match.name, state: match.state })
    },
    [formData.origin, formData.destination, formData.originState, formData.destinationState],
  )

  const lookupCompanyByCnpj = async (value: string, sequence: number) => {
    const digits = value.replace(/\D/g, '')
    const validation = validateCNPJ(digits)
    if (!validation.valid) {
      setCompanyLookup({ kind: 'error', cnpj: digits, message: validation.error })
      return
    }

    setCompanyLookup({ kind: 'loading', cnpj: digits })
    try {
      const registeredClients = await getClients()
      if (sequence !== companyLookupSequence.current) return
      const existing = registeredClients.find((client) => client.cnpj?.replace(/\D/g, '') === digits)
      if (existing) {
        setCompanyInput(existing.company_name)
        setFormData((previous) => ({
          ...previous,
          companyCnpj: formatCNPJDisplay(digits),
          companyResponsible: existing.responsible || '',
          companyPhone: existing.whatsapp || '',
          companyEmail: existing.email || '',
        }))
        setCompanyLookup({ kind: 'existing', cnpj: digits })
      } else {
        setCompanyLookup({ kind: 'new', cnpj: digits, message: 'Empresa não encontrada. Preencha os dados para cadastrá-la ao salvar o frete.' })
      }
    } catch {
      if (sequence === companyLookupSequence.current) {
        setCompanyLookup({ kind: 'error', cnpj: digits, message: 'Não foi possível consultar os clientes. Tente novamente.' })
      }
    }
  }

  const handleCompanyCnpjChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 14)
    companyLookupSequence.current += 1
    setCompanyInput('')
    setCompanyLookup({ kind: 'idle', cnpj: digits })
    setFormData((previous) => ({
      ...previous,
      companyCnpj: digits.length === 14 ? formatCNPJDisplay(digits) : digits,
      companyResponsible: '',
      companyPhone: '',
      companyEmail: '',
    }))
  }

  // Evita cadastrar um cliente isolado na prévia caso as colunas do frete
  // ainda não tenham sido migradas no banco.
  const ensureCompanyRouteSchema = async () => {
    const { error } = await supabase.from('routes').select('company_cnpj, cubage_m3, material_type, freight_type').limit(0)
    if (error) throw new Error('O banco ainda não recebeu as migrações dos campos da empresa, carga e tipo de frete. Salve após a publicação das migrações.')
  }


  const formatCurrencyBR = (value?: number | null) => {
    if (value == null) return '—'
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  }

  const parseCurrencyInput = (value: string) => {
    const normalized = value.trim().replace(/\./g, '').replace(',', '.')
    if (!normalized) return null
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }

  const parseCubageInput = (value: string) => {
    const trimmed = value.trim()
    const normalized = trimmed.includes(',') ? trimmed.replace(/\./g, '').replace(',', '.') : trimmed
    if (!normalized) return null
    const parsed = Number(normalized)
    return Number.isFinite(parsed) && parsed >= 0 && parsed < 1_000_000_000 ? parsed : null
  }

  /** Alíquota de comissão do vendedor logado (cada um só lança/edita os próprios fretes). */
  const commissionRate = currentUser?.commission_rate ?? null

  /** Prévia dos valores calculados enquanto o modal (novo/editar) está aberto. */
  const formPreview = useMemo(() => {
    const freight = parseCurrencyInput(formData.freightValue)
    const driver = parseCurrencyInput(formData.driverValue)
    const nf = parseCurrencyInput(formData.nfValue)
    const taxesPercent = normalizeTaxesPercent(Number(formData.taxesPercent))
    const seguroPercent = normalizeSeguroPercent(Number(formData.seguroPercent))
    const seguro = calculateSeguroValue(nf, seguroPercent)
    const net = calculateNetFreightValue(freight, driver, taxesPercent, seguro,
      parseCurrencyInput(formData.valePedagio), formData.valePedagioIncluso === 'true')
    return {
      taxes: calculateTaxesValue(freight, taxesPercent),
      seguro,
      net,
      commission: calculateCommissionValue(net, commissionRate),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    formData.freightValue,
    formData.driverValue,
    formData.nfValue,
    formData.taxesPercent,
    formData.seguroPercent,
    formData.valePedagio,
    formData.valePedagioIncluso,
    commissionRate,
  ])

  const handleCreateRoute = async (e: React.FormEvent) => {
    e.preventDefault()

    const companyCnpj = formData.companyCnpj.replace(/\D/g, '')
    if (!validateCNPJ(companyCnpj).valid) {
      alert('Informe um CNPJ válido para a empresa.')
      return
    }
    if (companyLookup.cnpj !== companyCnpj || !['existing', 'new'].includes(companyLookup.kind)) {
      alert('Clique em Buscar empresa antes de salvar o frete.')
      return
    }
    if (!companyInput.trim()) {
      alert('Informe o nome da empresa.')
      return
    }

    if (!formData.origin.trim() || !formData.originState.trim()) {
      alert('Preencha cidade e UF de origem.')
      return
    }
    if (formData.originState.trim().length !== 2) {
      alert('UF de origem deve ter 2 letras (ex.: SP).')
      return
    }
    if (!formData.destination.trim() || !formData.destinationState.trim()) {
      alert('Preencha cidade e UF de destino.')
      return
    }
    if (formData.destinationState.trim().length !== 2) {
      alert('UF de destino deve ter 2 letras (ex.: RJ).')
      return
    }
    if (!formData.weight.trim()) {
      alert('Preencha o peso do frete.')
      return
    }
    if (formData.cubageM3.trim() && parseCubageInput(formData.cubageM3) === null) {
      alert('Informe os metros cúbicos com um valor válido e não negativo.')
      return
    }

    setIsSubmitting(true)

    try {
      const ownerUserId = session?.user?.id
      if (!ownerUserId) {
        alert('Sessao expirada. Faca login novamente para criar a rota.')
        return
      }

      await ensureCompanyRouteSchema()
      const { client: companyResolved } = await ensureClientByCnpj({
        cnpj: formatCNPJDisplay(companyCnpj),
        companyName: companyInput,
        responsible: formData.companyResponsible,
        phone: formData.companyPhone,
        email: formData.companyEmail,
      })

      const freightValue = parseCurrencyInput(formData.freightValue)
      const driverValue = parseCurrencyInput(formData.driverValue)
      const nfValueParsed = parseCurrencyInput(formData.nfValue)
      const taxesPercent = isAdminUser
        ? normalizeTaxesPercent(Number(formData.taxesPercent))
        : 18
      // Seguro é 0,2% sobre a NF em todo frete; só o admin pode isentar (0%).
      const seguroPercent = isAdminUser
        ? normalizeSeguroPercent(Number(formData.seguroPercent))
        : SEGURO_PERCENT_DEFAULT
      const seguroValue = calculateSeguroValue(nfValueParsed, seguroPercent)
      const netFreightValue = calculateNetFreightValue(freightValue, driverValue, taxesPercent, seguroValue,
        parseCurrencyInput(formData.valePedagio), formData.valePedagioIncluso === 'true')
      const routeData: CreateRouteData = {
        driver_id: null,
      origin: formData.origin,
        origin_state: formData.originState,
        origin_address: formData.originAddress || undefined,
      destination: formData.destination,
        destination_state: formData.destinationState,
        destination_address: formData.destinationAddress || undefined,
      vehicle: ROUTE_NO_DRIVER_VEHICLE,
      plate: ROUTE_NO_DRIVER_PLATE,
      weight: formData.weight,
      cubage_m3: parseCubageInput(formData.cubageM3),
      material_type: formData.materialType.trim() || null,
      freight_value: freightValue,
      driver_value: driverValue,
      taxes_value: calculateTaxesValue(freightValue, taxesPercent),
      taxes_percent: taxesPercent,
      seguro_percent: seguroPercent,
      seguro_value: seguroValue,
      net_freight_value: netFreightValue,
      commission_value: calculateCommissionValue(netFreightValue, commissionRate),
      payment_status: formData.paymentStatus.trim() || null,
      payment_type: formData.paymentType.trim() || null,
      freight_type: (formData.freightType || null) as 'Dedicado' | 'Fracionado' | null,
      driver_name: formData.driverName.trim() || null,
      driver_phone: formData.driverPhone.trim() || null,
      driver_payment_status: formData.driverPaymentStatus.trim() || null,
      driver_payment_type: formData.driverPaymentType.trim() || null,
      nf_value: parseCurrencyInput(formData.nfValue),
      cte_value: parseCurrencyInput(formData.cteValue),
      vale_pedagio: parseCurrencyInput(formData.valePedagio),
      vale_pedagio_incluso: canChangeTollInclusion ? formData.valePedagioIncluso === 'true' : true,
      observation: formData.observation.trim() || null,
        estimated_delivery: formData.estimatedDelivery.trim(),
        pickup_date: formData.pickupDate.trim(),
        status: 'pending',
        company_name: companyResolved.company_name,
        company_cnpj: formatCNPJDisplay(companyCnpj),
        company_responsible: formData.companyResponsible.trim() || companyResolved.responsible,
        company_phone: formData.companyPhone.trim() || companyResolved.whatsapp,
        company_email: formData.companyEmail.trim() || companyResolved.email,
        company_address: companyResolved.address,
        company_city: companyResolved.city,
        company_state: companyResolved.state,
        distance_km:
          routeDistance.distanciaKm ??
          null,
        created_by_user_id: ownerUserId,
      }

      await createRoute(routeData)

      handleCloseCreateModal()
    } catch (err: any) {
      alert(`Erro ao criar rota: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateRoute = async (e: React.FormEvent) => {
    e.preventDefault()

    const companyCnpj = formData.companyCnpj.replace(/\D/g, '')
    if ((companyCnpj || editingRoute?.company_cnpj) && !validateCNPJ(companyCnpj).valid) {
      alert('Informe um CNPJ válido para a empresa.')
      return
    }
    if (companyCnpj && (companyLookup.cnpj !== companyCnpj || !['existing', 'new'].includes(companyLookup.kind))) {
      alert('Clique em Buscar empresa antes de salvar o frete.')
      return
    }
    if (!companyInput.trim()) {
      alert('Informe o nome da empresa.')
      return
    }
    
    if (!editingRoute) {
      return
    }

    if (!formData.origin.trim() || !formData.originState.trim()) {
      alert('Preencha cidade e UF de origem.')
      return
    }
    if (formData.originState.trim().length !== 2) {
      alert('UF de origem deve ter 2 letras (ex.: SP).')
      return
    }
    if (!formData.destination.trim() || !formData.destinationState.trim()) {
      alert('Preencha cidade e UF de destino.')
      return
    }
    if (formData.destinationState.trim().length !== 2) {
      alert('UF de destino deve ter 2 letras (ex.: RJ).')
      return
    }
    if (!formData.weight.trim()) {
      alert('Preencha o peso do frete.')
      return
    }
    if (formData.cubageM3.trim() && parseCubageInput(formData.cubageM3) === null) {
      alert('Informe os metros cúbicos com um valor válido e não negativo.')
      return
    }

    setIsSubmitting(true)

    try {
      const ownerUserId = session?.user?.id
      if (!ownerUserId) {
        alert('Sessao expirada. Faca login novamente para atualizar a rota.')
        return
      }

      await ensureCompanyRouteSchema()
      const companyResolved = companyCnpj
        ? (await ensureClientByCnpj({
            cnpj: formatCNPJDisplay(companyCnpj),
            companyName: companyInput,
            responsible: formData.companyResponsible,
            phone: formData.companyPhone,
            email: formData.companyEmail,
          })).client
        : null

      const freightValue = parseCurrencyInput(formData.freightValue)
      const driverValue = parseCurrencyInput(formData.driverValue)
      const nfValueParsed = parseCurrencyInput(formData.nfValue)
      const taxesPercent = isAdminUser
        ? normalizeTaxesPercent(Number(formData.taxesPercent))
        : getRouteTaxesPercent(editingRoute)
      // Seguro só pode ser alterado por admin; demais mantêm o atual do frete.
      const seguroPercent = isAdminUser
        ? normalizeSeguroPercent(Number(formData.seguroPercent))
        : getRouteSeguroPercent(editingRoute)
      // O Controle Financeiro permite sobrescrever seguro/tributos em R$. Só
      // recalcula pelo percentual quando a base (NF/frete/alíquota) mudou —
      // senão o valor lançado manualmente lá seria apagado ao editar aqui.
      const seguroBaseUnchanged =
        nfValueParsed === (editingRoute.nf_value ?? null) &&
        seguroPercent === getRouteSeguroPercent(editingRoute)
      const seguroValue =
        seguroBaseUnchanged && editingRoute.seguro_value != null
          ? editingRoute.seguro_value
          : calculateSeguroValue(nfValueParsed, seguroPercent)

      const taxesBaseUnchanged =
        freightValue === (editingRoute.freight_value ?? null) &&
        taxesPercent === getRouteTaxesPercent(editingRoute)
      const taxesValue =
        taxesBaseUnchanged && editingRoute.taxes_value != null
          ? editingRoute.taxes_value
          : calculateTaxesValue(freightValue, taxesPercent)

      const netFreightValue = calculateNetFreightValue(freightValue, driverValue, taxesPercent, seguroValue,
        parseCurrencyInput(formData.valePedagio), formData.valePedagioIncluso === 'true', taxesValue)
      await updateRoute(editingRoute.id, {
        driver_id: null,
        origin: formData.origin,
        origin_state: formData.originState,
        origin_address: formData.originAddress || null,
        destination: formData.destination,
        destination_state: formData.destinationState,
        destination_address: formData.destinationAddress || null,
        vehicle: editingRoute.vehicle ?? ROUTE_NO_DRIVER_VEHICLE,
        plate: editingRoute.plate ?? ROUTE_NO_DRIVER_PLATE,
        weight: formData.weight,
        cubage_m3: parseCubageInput(formData.cubageM3),
        material_type: formData.materialType.trim() || null,
        freight_value: freightValue,
        driver_value: driverValue,
        taxes_value: taxesValue,
        taxes_percent: taxesPercent,
        seguro_percent: seguroPercent,
        seguro_value: seguroValue,
        net_freight_value: netFreightValue,
        commission_value: calculateCommissionValue(netFreightValue, commissionRate),
        payment_status: formData.paymentStatus.trim() || null,
        payment_type: formData.paymentType.trim() || null,
        freight_type: (formData.freightType || null) as 'Dedicado' | 'Fracionado' | null,
        driver_name: formData.driverName.trim() || null,
        driver_phone: formData.driverPhone.trim() || null,
        driver_payment_status: formData.driverPaymentStatus.trim() || null,
        driver_payment_type: formData.driverPaymentType.trim() || null,
        nf_value: parseCurrencyInput(formData.nfValue),
        cte_value: parseCurrencyInput(formData.cteValue),
        vale_pedagio: parseCurrencyInput(formData.valePedagio),
        ...(canChangeTollInclusion
          ? { vale_pedagio_incluso: formData.valePedagioIncluso === 'true' }
          : {}),
        observation: formData.observation.trim() || null,
        estimated_delivery: formData.estimatedDelivery.trim(),
        pickup_date: formData.pickupDate.trim(),
        status: editingRoute.status,
        company_name: companyResolved?.company_name || companyInput.trim(),
        ...(companyCnpj ? { company_cnpj: formatCNPJDisplay(companyCnpj) } : {}),
        company_responsible: formData.companyResponsible.trim() || companyResolved?.responsible || null,
        company_phone: formData.companyPhone.trim() || companyResolved?.whatsapp || null,
        company_email: formData.companyEmail.trim() || companyResolved?.email || null,
        company_address: companyResolved?.address || editingRoute.company_address,
        company_city: companyResolved?.city || editingRoute.company_city,
        company_state: companyResolved?.state || editingRoute.company_state,
        distance_km:
          routeDistance.distanciaKm ??
          editingRoute.distance_km ??
          null,
      })

      handleCloseEditModal()
    } catch (err: any) {
      alert(`Erro ao atualizar rota: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCloseCreateModal = () => {
    setShowCreateModal(false)
    setCompanyInput('')
    setCompanyLookup({ kind: 'idle', cnpj: '' })
    companyLookupSequence.current += 1
    setOriginCEP('')
    setDestinationCEP('')
    setOriginCityFeedback({ kind: 'idle' })
    setDestinationCityFeedback({ kind: 'idle' })
    setFormData({
      origin: '',
      originState: '',
      originAddress: '',
      destination: '',
      destinationState: '',
      destinationAddress: '',
      companyPhone: '',
      companyEmail: '',
      companyCnpj: '',
      companyResponsible: '',
      weight: '',
      cubageM3: '',
      materialType: '',
      freightValue: '',
      cteValue: '',
      valePedagio: '',
      valePedagioIncluso: 'true',
      driverValue: '',
      taxesValue: '',
      netFreightValue: '',
      commissionValue: '',
      paymentStatus: '',
      paymentType: '',
      freightType: '',
      driverName: '',
      driverPhone: '',
      driverPaymentStatus: '',
      driverPaymentType: '',
      nfValue: '',
      observation: '',
      estimatedDelivery: '',
      pickupDate: '',
      taxesPercent: '18',
      seguroPercent: String(SEGURO_PERCENT_DEFAULT),
    })
  }

  const handleCloseEditModal = () => {
    setShowEditModal(false)
    setEditingRoute(null)
    setCompanyInput('')
    setCompanyLookup({ kind: 'idle', cnpj: '' })
    companyLookupSequence.current += 1
    setOriginCEP('')
    setDestinationCEP('')
    setOriginCityFeedback({ kind: 'idle' })
    setDestinationCityFeedback({ kind: 'idle' })
    setFormData({
      origin: '',
      originState: '',
      originAddress: '',
      destination: '',
      destinationState: '',
      destinationAddress: '',
      companyPhone: '',
      companyEmail: '',
      companyCnpj: '',
      companyResponsible: '',
      weight: '',
      cubageM3: '',
      materialType: '',
      freightValue: '',
      cteValue: '',
      valePedagio: '',
      valePedagioIncluso: 'true',
      driverValue: '',
      taxesValue: '',
      netFreightValue: '',
      commissionValue: '',
      paymentStatus: '',
      paymentType: '',
      freightType: '',
      driverName: '',
      driverPhone: '',
      driverPaymentStatus: '',
      driverPaymentType: '',
      nfValue: '',
      observation: '',
      estimatedDelivery: '',
      pickupDate: '',
      taxesPercent: '18',
      seguroPercent: String(SEGURO_PERCENT_DEFAULT),
    })
  }

  const renderCompanyFields = () => (
    <section aria-labelledby="route-company-heading" className="space-y-4">
      <h3 id="route-company-heading" className="text-sm font-semibold text-gray-900">Empresa</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-semibold text-gray-900" htmlFor="route-company-cnpj">CNPJ da empresa <span className="text-red-500">{showEditModal && !formData.companyCnpj ? '(opcional para frete antigo)' : '*'}</span></label>
          <div className="flex gap-2">
            <input
              id="route-company-cnpj"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={formData.companyCnpj}
              onChange={(event) => handleCompanyCnpjChange(event.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-slate-800"
              placeholder="00.000.000/0000-00"
              aria-invalid={companyLookup.kind === 'error'}
            />
            <button
              type="button"
              aria-label="Buscar empresa pelo CNPJ"
              title="Buscar empresa pelo CNPJ"
              onClick={() => void lookupCompanyByCnpj(formData.companyCnpj, ++companyLookupSequence.current)}
              disabled={companyLookup.kind === 'loading'}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {companyLookup.kind === 'loading' ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Search className="h-5 w-5" aria-hidden="true" />}
            </button>
          </div>
          <p className={`mt-1 text-xs ${companyLookup.kind === 'error' ? 'text-red-600' : companyLookup.kind === 'existing' ? 'text-emerald-700' : 'text-gray-500'}`} role="status">
            {companyLookup.kind === 'loading' ? 'Consultando clientes...' : companyLookup.kind === 'existing' ? 'Empresa encontrada no seu cadastro.' : companyLookup.message || 'Informe o CNPJ e clique em Buscar empresa.'}
          </p>
        </div>
        <label className="block text-sm font-semibold text-gray-900">
          <span className="mb-2 block">Nome da empresa <span className="text-red-500">*</span></span>
          <input type="text" value={companyInput} readOnly={companyLookup.kind === 'existing'} onChange={(event) => setCompanyInput(event.target.value)} className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-slate-800 read-only:bg-slate-100" placeholder="Nome da empresa" />
        </label>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <label className="block text-sm font-semibold text-gray-900">
          <span className="mb-2 block">Nome do responsável</span>
          <input type="text" value={formData.companyResponsible} onChange={(event) => setFormData({ ...formData, companyResponsible: event.target.value })} className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-slate-800" placeholder="Responsável pela empresa" />
        </label>
        <label className="block text-sm font-semibold text-gray-900">
          <span className="mb-2 block">Número de telefone</span>
          <input type="tel" value={formData.companyPhone} onChange={(event) => setFormData({ ...formData, companyPhone: event.target.value })} className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-slate-800" placeholder="(11) 99999-9999" />
        </label>
        <label className="block text-sm font-semibold text-gray-900">
          <span className="mb-2 block">E-mail</span>
          <input type="email" value={formData.companyEmail} onChange={(event) => setFormData({ ...formData, companyEmail: event.target.value })} className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-slate-800" placeholder="empresa@email.com" />
        </label>
      </div>
    </section>
  )

  const renderRouteDates = () => (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <label className="block text-sm font-semibold text-gray-900">
        <span className="mb-2 block">Data de coleta <span className="font-normal text-gray-500">(opcional)</span></span>
        <input type="date" value={formData.pickupDate} onChange={(event) => setFormData({ ...formData, pickupDate: event.target.value })} className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-slate-800" />
      </label>
      <label className="block text-sm font-semibold text-gray-900">
        <span className="mb-2 block">Previsão de entrega <span className="font-normal text-gray-500">(opcional)</span></span>
        <input type="date" value={formData.estimatedDelivery} onChange={(event) => setFormData({ ...formData, estimatedDelivery: event.target.value })} className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-slate-800" />
      </label>
    </div>
  )

  const renderCargoAndValues = () => {
    const inputClass = 'w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800'
    const calculatedClass = 'w-full px-4 py-3 bg-slate-100 border border-gray-300 rounded-lg text-gray-700 focus:outline-none'
    const editable = (label: string, key: 'weight' | 'cubageM3' | 'materialType' | 'nfValue' | 'freightValue' | 'driverValue' | 'cteValue' | 'valePedagio', placeholder: string, required = false) => (
      <label className="block min-w-0 text-sm font-semibold text-gray-900">
        <span className="mb-2 block">{label}{required && <span className="text-red-500"> *</span>}</span>
        <input
          type="text"
          inputMode={['cubageM3', 'nfValue', 'freightValue', 'driverValue', 'cteValue', 'valePedagio'].includes(key) ? 'decimal' : 'text'}
          required={required}
          value={formData[key]}
          onChange={(event) => setFormData({ ...formData, [key]: event.target.value })}
          className={inputClass}
          placeholder={placeholder}
        />
      </label>
    )
    const calculated = (label: string, value: number | null, help: string) => (
      <div className="min-w-0">
        <label className="mb-2 block text-sm font-semibold text-gray-900">{label}</label>
        <input type="text" readOnly value={formatCurrencyBR(value)} className={calculatedClass} aria-label={label} />
        <p className="mt-1 text-xs text-gray-500">{help}</p>
      </div>
    )

    return (
      <div className="space-y-7">
        <section aria-labelledby="cargo-details-heading" className="border-t border-gray-200 pt-5">
          <h3 id="cargo-details-heading" className="mb-4 text-sm font-semibold text-gray-900">Dados da carga</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {editable('Peso', 'weight', 'Ex: 15.500 kg', true)}
            {editable('Metros cúbicos (m³)', 'cubageM3', 'Ex: 2,81')}
            {editable('Tipo de material', 'materialType', 'Ex: argamassa e porta de madeira')}
            {editable('Valor da nota fiscal', 'nfValue', 'Ex: 14.916,47')}
          </div>
        </section>

        <section aria-labelledby="route-values-heading" className="border-t border-gray-200 pt-5">
          <h3 id="route-values-heading" className="mb-4 text-sm font-semibold text-gray-900">Valores e custos</h3>
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
            {editable('Valor do frete', 'freightValue', 'Ex: 12.500,00')}
            {editable('Valor do motorista', 'driverValue', 'Ex: 8.500,00')}
            {calculated('Frete líquido', formPreview.net, 'Frete menos tributos, motorista, seguro e pedágio não incluso.')}
            <div className="min-w-0">
              <label className="mb-2 block text-sm font-semibold text-gray-900">Seguro</label>
              {isAdminUser ? (
                <select value={formData.seguroPercent} onChange={(event) => setFormData({ ...formData, seguroPercent: event.target.value })} className={`${inputClass} mb-2 text-gray-900`} aria-label="Percentual de seguro sobre a NF">
                  {SEGURO_PERCENT_CHOICES.map((percent) => <option key={percent} value={String(percent)}>{percent}% sobre a NF</option>)}
                </select>
              ) : <p className="mb-2 text-xs text-gray-600">Alíquota de <strong>{normalizeSeguroPercent(Number(formData.seguroPercent))}%</strong> — somente administrador pode alterar.</p>}
              <input type="text" readOnly value={formatCurrencyBR(formPreview.seguro)} className={calculatedClass} aria-label="Valor do seguro" />
              <p className="mt-1 text-xs text-gray-500">Calculado automaticamente sobre o valor da NF.</p>
            </div>
            <div className="min-w-0">
              <label className="mb-2 block text-sm font-semibold text-gray-900">Tributos *</label>
              {isAdminUser ? (
                <select value={formData.taxesPercent} onChange={(event) => setFormData({ ...formData, taxesPercent: event.target.value })} className={`${inputClass} mb-2 text-gray-900`} aria-label="Percentual de tributos sobre o frete">
                  {TAXES_PERCENT_CHOICES.map((percent) => <option key={percent} value={String(percent)}>{percent}% sobre o frete</option>)}
                </select>
              ) : <p className="mb-2 text-xs text-gray-600">Alíquota de <strong>{normalizeTaxesPercent(Number(formData.taxesPercent))}%</strong> — somente administrador pode alterar (0% ou 18%).</p>}
              <input type="text" readOnly value={formatCurrencyBR(formPreview.taxes)} className={calculatedClass} aria-label="Valor dos tributos" />
              <p className="mt-1 text-xs text-gray-500">Calculado automaticamente sobre o valor do frete.</p>
            </div>
            {calculated('Comissão', formPreview.commission, `Calculada automaticamente: ${commissionRate ?? 30}% do frete líquido.`)}
            {editable('Valor do CT-e (opcional)', 'cteValue', 'Ex: 150,00')}
            <div className="min-w-0">
              {editable('Vale pedágio (opcional)', 'valePedagio', 'Ex: 300,00')}
              <select
                aria-label="Vale pedágio incluso"
                disabled={!canChangeTollInclusion}
                title={!canChangeTollInclusion ? 'Seu cargo pode visualizar, mas não alterar este campo.' : undefined}
                value={formData.valePedagioIncluso}
                onChange={(event) => setFormData({ ...formData, valePedagioIncluso: event.target.value })}
                className={`${inputClass} mt-2`}
              >
                <option value="true">Incluso</option>
                <option value="false">Não incluso</option>
              </select>
            </div>
          </div>
        </section>

        <section aria-labelledby="route-other-heading" className="border-t border-gray-200 pt-5">
          <h3 id="route-other-heading" className="mb-4 text-sm font-semibold text-gray-900">Observação</h3>
          <label className="block text-sm font-semibold text-gray-900">
            <span className="sr-only">Observação</span>
            <textarea rows={3} value={formData.observation} onChange={(event) => setFormData({ ...formData, observation: event.target.value })} className={`${inputClass} resize-y`} placeholder="Informações adicionais do frete" />
          </label>
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-6 min-w-0">
      {/* Header - Estilo Referência */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900">Fretes</h1>
          <span className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">
            {statusCounts.all}
          </span>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors flex items-center gap-2 font-medium"
        >
          <Plus className="w-5 h-5" />
          Criar Nova Rota
        </motion.button>
      </div>

      {/* Filtro de período */}
      <div className="flex flex-wrap items-center gap-3">
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
                  active ? 'bg-gray-800 text-white' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="hidden sm:inline">{opt.label}</span>
                <span className="sm:hidden">{opt.short}</span>
              </button>
            )
          })}
        </div>
        <p className="text-xs text-gray-400 hidden sm:block">{ROUTE_PERIOD_FILTER_HINT}</p>
      </div>

      {period === 'custom' && (
        <div className="flex flex-wrap items-center gap-3 p-3 bg-white rounded-xl border border-gray-200 w-fit">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 whitespace-nowrap">De</label>
            <input
              type="date"
              value={customStart}
              max={customEnd || undefined}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-slate-800/20"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 whitespace-nowrap">Até</label>
            <input
              type="date"
              value={customEnd}
              min={customStart || undefined}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-slate-800/20"
            />
          </div>
        </div>
      )}

      {/* Filtros de Status - Estilo Referência */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => setFilterStatus('all')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
            filterStatus === 'all'
              ? 'bg-gray-800 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Todos {statusCounts.all}
        </button>
        <button
          type="button"
          onClick={() => setFilterStatus('pending')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
            filterStatus === 'pending'
              ? 'bg-gray-800 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Pendentes {statusCounts.pending}
        </button>
        <button
          onClick={() => setFilterStatus('pickedUp')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
            filterStatus === 'pickedUp'
              ? 'bg-gray-800 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Coletados {statusCounts.pickedUp}
        </button>
        <button
          onClick={() => setFilterStatus('inTransit')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
            filterStatus === 'inTransit'
              ? 'bg-gray-800 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Em Trânsito {statusCounts.inTransit}
        </button>
        <button
          onClick={() => setFilterStatus('delivered')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
            filterStatus === 'delivered'
              ? 'bg-gray-800 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Entregues {statusCounts.delivered}
        </button>
        <button
          onClick={() => setFilterStatus('documentation')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
            filterStatus === 'documentation'
              ? 'bg-gray-800 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Documentação {statusCounts.documentation}
        </button>
      </div>

      {/* Tabela — scroll horizontal + coluna de ações fixa à direita em telas estreitas */}
      <div className="bg-white rounded-xl border border-gray-200 min-w-0 overflow-hidden">
        <div className="overflow-x-auto overflow-y-visible overscroll-x-contain touch-auto">
          <table className="w-full min-w-[640px] table-auto border-separate border-spacing-0">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-3 sm:px-4 lg:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Frete
                </th>
                <th className="px-3 sm:px-4 lg:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                  Pgto. comissão
                </th>
                <th className="hidden sm:table-cell px-3 sm:px-4 lg:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-3 sm:px-4 lg:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Rota
                </th>
                <th className="hidden md:table-cell px-3 sm:px-4 lg:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Valor do Frete
                </th>
                <th className="hidden md:table-cell px-3 sm:px-4 lg:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  NF
                </th>
                <th className="hidden lg:table-cell px-3 sm:px-4 lg:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Valor do Motorista
                </th>
                <th className="hidden xl:table-cell px-3 sm:px-4 lg:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Tribultos*
                </th>
                <th className="hidden xl:table-cell px-3 sm:px-4 lg:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Frete Líquido
                </th>
                <th className="hidden 2xl:table-cell px-3 sm:px-4 lg:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Comissão
                </th>
                <th className="px-3 sm:px-4 lg:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="sticky right-0 z-20 w-px px-2 sm:px-3 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider bg-gray-50 border-l border-gray-200">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRoutes.map((route) => {
                return (
                  <tr
                    key={route.id}
                    className="group hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-3 sm:px-4 lg:px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">
                        #{route.freight_id}
                      </span>
                    </td>
                    <td className="px-3 sm:px-4 lg:px-6 py-4 whitespace-nowrap">
                      <CommissionPaidStatus
                        paid={route.commission_paid === true}
                        loading={commissionToggleRouteId === route.id}
                        editable={isAdminUser}
                        onToggle={() => void handleToggleCommissionPaid(route.id, route.commission_paid === true)}
                      />
                    </td>
                    <td className="hidden sm:table-cell px-3 sm:px-4 lg:px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm text-gray-900">
                          {route.client?.company_name || route.company_name || '—'}
                        </span>
                        <span className="text-xs text-gray-500 mt-1">
                          {route.client?.responsible || route.company_responsible || '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 sm:px-4 lg:px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col items-start">
                      <span
                        className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight text-gray-900"
                        title={`${[route.origin, route.origin_state].filter(Boolean).join(', ')} → ${[route.destination, route.destination_state].filter(Boolean).join(', ')}`}
                      >
                        <span className="tabular-nums">
                          {(route.origin_state || '—').toUpperCase()}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-gray-400 shrink-0" aria-hidden />
                        <span className="tabular-nums">
                          {(route.destination_state || '—').toUpperCase()}
                        </span>
                      </span>
                      <span className="mt-1 text-xs text-gray-500">{route.freight_type || 'Tipo não informado'}</span>
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-3 sm:px-4 lg:px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900 tabular-nums">
                        {formatCurrencyBR(route.freight_value ?? route.nf_value)}
                      </span>
                    </td>
                    <td className="hidden md:table-cell px-3 sm:px-4 lg:px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900 tabular-nums">
                        {formatCurrencyBR(route.nf_value)}
                      </span>
                    </td>
                    <td className="hidden lg:table-cell px-3 sm:px-4 lg:px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900 tabular-nums">
                        {formatCurrencyBR(getRouteDriverTotalValue(route))}
                      </span>
                    </td>
                    <td className="hidden xl:table-cell px-3 sm:px-4 lg:px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900 tabular-nums">
                        {formatCurrencyBR(getRouteTaxesValue(route))}
                      </span>
                    </td>
                    <td className="hidden xl:table-cell px-3 sm:px-4 lg:px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900 tabular-nums">
                        {formatCurrencyBR(getRouteNetFreightValue(route))}
                      </span>
                    </td>
                    <td className="hidden 2xl:table-cell px-3 sm:px-4 lg:px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900 tabular-nums">
                        {formatCurrencyBR(getRouteCommissionValue(route, commissionRate))}
                      </span>
                    </td>
                    <td className="px-3 sm:px-4 lg:px-6 py-4 whitespace-nowrap">
                      <select
                        aria-label="Status do frete"
                        value={route.status}
                        onChange={(e) =>
                          handleUpdateRouteStatus(route, e.target.value as RouteStatus)
                        }
                        disabled={updatingStatusRouteId === route.id}
                        className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-800 disabled:cursor-wait disabled:opacity-60"
                      >
                        {ROUTE_STATUS_OPTIONS.map((status) => {
                          const display = getStatusDisplay(status)
                          return (
                            <option key={status} value={status}>
                              {display.emoji}  {display.label}
                            </option>
                          )
                        })}
                      </select>
                    </td>
                    <td className="sticky right-0 z-10 w-px whitespace-nowrap border-l border-gray-200 bg-white px-2 sm:px-3 py-4 group-hover:bg-gray-50">
                      <div className="flex items-center justify-end gap-0.5 sm:gap-1">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleViewMore(route)}
                          className="shrink-0 px-2 py-1.5 sm:px-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-xs sm:text-sm font-medium whitespace-nowrap"
                      >
                        Ver mais
                      </motion.button>
                        <button
                          onClick={() => handleOpenEdit(route)}
                          className="shrink-0 p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteRoute(route.id)}
                          className="shrink-0 p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>


      {/* Loading */}
      {(routesLoading || clientsLoading || driversLoading) && (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
          <p className="text-gray-500 mt-2">Carregando rotas...</p>
        </div>
      )}

      {/* Erro */}
      {routesError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{routesError}</p>
        </div>
      )}

      {!routesLoading && !clientsLoading && filteredRoutes.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Route className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>Nenhum frete encontrado</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors font-medium"
          >
            Criar primeira rota
          </button>
        </div>
      )}

      {/* Modal de Detalhes da Rota */}
      {selectedRoute && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden"
          >
            <div className="p-6 border-b border-gray-200 flex items-center justify-between shrink-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-800 rounded-lg flex items-center justify-center">
                  <Truck className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Frete #{selectedRoute.freight_id}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`w-2 h-2 rounded-full ${getStatusDisplay(selectedRoute.status).dotColor}`}></div>
                    <span className="text-sm text-gray-600">{getStatusDisplay(selectedRoute.status).label}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="px-6 py-0 flex-1 overflow-y-auto space-y-0">
              {/* Informações da Empresa */}
              <div className="py-5">
                <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Empresa
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-gray-50 dark:bg-slate-800/60 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
                    <p className="text-xs text-gray-500 mb-1">Nome da Empresa</p>
                    <p className="text-sm font-medium text-gray-900">{selectedRoute.client?.company_name || selectedRoute.company_name || 'N/A'}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-slate-800/60 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
                    <p className="text-xs text-gray-500 mb-1">Responsável</p>
                    <p className="text-sm font-medium text-gray-900">{selectedRoute.client?.responsible || selectedRoute.company_responsible || 'N/A'}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-slate-800/60 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
                    <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      WhatsApp
                    </p>
                    {(() => {
                      const raw =
                        selectedRoute.client?.whatsapp || selectedRoute.company_phone || ''
                      const href = getWhatsAppWebUrl(raw)
                      return href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-green-700 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 underline-offset-2 hover:underline"
                        >
                          {raw}
                        </a>
                      ) : (
                        <p className="text-sm font-medium text-gray-900">N/A</p>
                      )
                    })()}
                  </div>
                  <div className="bg-gray-50 dark:bg-slate-800/60 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
                    <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      E-mail
                    </p>
                    <p className="text-sm font-medium text-gray-900">{selectedRoute.client?.email || selectedRoute.company_email || 'N/A'}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-slate-800/60 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
                    <p className="text-xs text-gray-500 mb-1">Status de Pagamento</p>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedRoute.payment_status || '—'}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-slate-800/60 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
                    <p className="text-xs text-gray-500 mb-1">Tipo de Pagamento</p>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedRoute.payment_type || '—'}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-slate-800/60 rounded-xl p-4 border border-gray-200 dark:border-slate-700 md:col-span-2">
                    <p className="text-xs text-gray-500 mb-1">Tipo de frete</p>
                    <p className="text-sm font-medium text-gray-900">{selectedRoute.freight_type || '—'}</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200" />

              {/* Informações da Rota */}
              <div className="py-5">
                <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Route className="w-4 h-4" />
                  Rota
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Origem */}
                  <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-blue-600 dark:text-blue-300 font-semibold mb-1.5 uppercase tracking-wide">De onde foi coletado</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-slate-100">{selectedRoute.origin}, {selectedRoute.origin_state}</p>
                        {selectedRoute.origin_address && (
                          <p className="text-xs text-gray-600 dark:text-slate-300 mt-1">{selectedRoute.origin_address}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Destino */}
                  <div className="bg-green-50 dark:bg-green-900/30 rounded-xl p-4 border border-green-200 dark:border-green-800">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-green-600 dark:text-green-300 font-semibold mb-1.5 uppercase tracking-wide">Lugar de entrega</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-slate-100">{selectedRoute.destination}, {selectedRoute.destination_state}</p>
                        {selectedRoute.destination_address && (
                          <p className="text-xs text-gray-600 dark:text-slate-300 mt-1">{selectedRoute.destination_address}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200" />

              {/* Informações do Veículo */}
              <div className="py-5">
                <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Truck className="w-4 h-4" />
                  Veículo
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-gray-50 dark:bg-slate-800/60 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
                    <p className="text-xs text-gray-500 mb-1">Modelo</p>
                    <p className="text-sm font-medium text-gray-900">{selectedRoute.vehicle}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-slate-800/60 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
                    <p className="text-xs text-gray-500 mb-1">Placa</p>
                    <p className="text-sm font-medium text-gray-900">{selectedRoute.plate}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-slate-800/60 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
                    <p className="text-xs text-gray-500 mb-1">Peso</p>
                    <p className="text-sm font-medium text-gray-900">{selectedRoute.weight}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-slate-800/60 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
                    <p className="text-xs text-gray-500 mb-1">Metros cúbicos</p>
                    <p className="text-sm font-medium text-gray-900">{selectedRoute.cubage_m3 == null ? '—' : `${selectedRoute.cubage_m3.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} m³`}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-slate-800/60 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
                    <p className="text-xs text-gray-500 mb-1">Tipo de material</p>
                    <p className="text-sm font-medium text-gray-900 break-words">{selectedRoute.material_type || '—'}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-slate-800/60 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
                    <p className="text-xs text-gray-500 mb-1">Nome do Motorista</p>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedRoute.driver_name || selectedRoute.driver?.name || '—'}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-slate-800/60 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
                    <p className="text-xs text-gray-500 mb-1">Celular do Motorista</p>
                    {getWhatsAppWebUrl(selectedRoute.driver_phone || selectedRoute.driver?.phone) ? (
                      <a
                        href={getWhatsAppWebUrl(selectedRoute.driver_phone || selectedRoute.driver?.phone) || undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-green-700 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300"
                      >
                        {selectedRoute.driver_phone || selectedRoute.driver?.phone}
                      </a>
                    ) : (
                      <p className="text-sm font-medium text-gray-900">—</p>
                    )}
                  </div>
                  <div className="bg-gray-50 dark:bg-slate-800/60 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
                    <p className="text-xs text-gray-500 mb-1">Status Motorista</p>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedRoute.driver_payment_type || '—'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200" />
              {/* Informações de Datas */}
              <div className="py-5">
                <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Datas
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-gray-50 dark:bg-slate-800/60 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
                    <p className="text-xs text-gray-500 mb-1">Data de Coleta</p>
                    <p className="text-sm font-medium text-gray-900">{formatDateDdMmYyyy(selectedRoute.pickup_date)}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-slate-800/60 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
                    <p className="text-xs text-gray-500 mb-1">Previsão de Entrega</p>
                    <p className="text-sm font-medium text-gray-900">{formatDateDdMmYyyy(selectedRoute.estimated_delivery)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                  <div className="bg-gray-50 dark:bg-slate-800/60 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
                    <p className="text-xs text-gray-500 mb-1">Valor do Frete</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrencyBR(selectedRoute.freight_value ?? selectedRoute.nf_value)}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-slate-800/60 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
                    <p className="text-xs text-gray-500 mb-1">Valor de CTE</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrencyBR(selectedRoute.cte_value)}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-slate-800/60 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
                    <p className="text-xs text-gray-500 mb-1">Vale pedagio</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrencyBR(selectedRoute.vale_pedagio)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {isValePedagioIncluso(selectedRoute.vale_pedagio_incluso) ? 'Incluso' : 'Não incluso'}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-slate-800/60 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
                    <p className="text-xs text-gray-500 mb-1">Valor do Motorista</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrencyBR(getRouteDriverTotalValue(selectedRoute))}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-slate-800/60 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
                    <p className="text-xs text-gray-500 mb-1">Tribultos*</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrencyBR(getRouteTaxesValue(selectedRoute))}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Alíquota: {getRouteTaxesPercent(selectedRoute)}% sobre o frete
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-slate-800/60 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
                    <p className="text-xs text-gray-500 mb-1">Seguro</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrencyBR(getRouteSeguroValue(selectedRoute))}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Alíquota: {getRouteSeguroPercent(selectedRoute)}% sobre a NF
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-slate-800/60 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
                    <p className="text-xs text-gray-500 mb-1">Frete Líquido</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrencyBR(getRouteNetFreightValue(selectedRoute))}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-slate-800/60 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
                    <p className="text-xs text-gray-500 mb-1">Comissão</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrencyBR(getRouteCommissionValue(selectedRoute, commissionRate))}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-slate-800/60 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
                    <p className="text-xs text-gray-500 mb-1">Valor da NF</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrencyBR(selectedRoute.nf_value)}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-slate-800/60 rounded-xl p-4 border border-gray-200 dark:border-slate-700 md:col-span-3">
                    <p className="text-xs text-gray-500 mb-1">Observação</p>
                    <p className="text-sm font-medium text-gray-900 whitespace-pre-wrap">
                      {selectedRoute.observation || '—'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200" />

              {/* Documentação do Frete */}
              <div className="py-5">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                      <Truck className="w-4 h-4" />
                      Documentos
                    </h3>
                    <span className="text-xs text-gray-500">Frete #{selectedRoute.freight_id}</span>
                  </div>

                  <div className="bg-gray-50 dark:bg-slate-800/60 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
                    <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                      <p className="text-xs text-gray-700 font-semibold uppercase tracking-wide">
                        {canManageFreightDocuments ? 'Adicione fotos / documentos' : 'Documentos do frete'}
                      </p>
                      <span className="text-[11px] text-gray-500">
                        {documents.freteDocs.length}{' '}
                        {documents.freteDocs.length === 1 ? 'arquivo' : 'arquivos'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      {canManageFreightDocuments
                        ? 'Nota fiscal, CT-e, comprovantes de pagamento (PDF) e demais anexos do frete. As imagens são comprimidas (sem cortar) antes do envio. PDF até 20 MB.'
                        : 'Visualização dos anexos. Envio e exclusão ficam a cargo do time comercial ou administrativo.'}
                    </p>
                    {documentsLoading && <p className="mb-3 text-sm text-gray-600">Carregando anexos...</p>}
                    {documentsError && (
                      <p role="alert" className="mb-3 text-sm text-red-700">
                        {documentsError}{' '}
                        <button type="button" className="underline" onClick={() => void loadRouteDocuments(selectedRoute.id)}>
                          Tentar novamente
                        </button>
                      </p>
                    )}
                    <input
                      id="upload-frete-docs"
                      type="file"
                      accept="image/*,application/pdf"
                      multiple
                      className="hidden"
                      disabled={!canManageFreightDocuments || uploadingDocument === 'freteDocs'}
                      onChange={(e) => {
                        const files = e.target.files
                        void handleUploadDocuments('freteDocs', files)
                        e.target.value = ''
                      }}
                    />
                    {canManageFreightDocuments && (
                      <div className="flex flex-wrap gap-2">
                        <label
                          htmlFor="upload-frete-docs"
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-lg text-gray-700 ${
                            uploadingDocument === 'freteDocs'
                              ? 'cursor-wait opacity-60'
                              : 'hover:bg-gray-100 cursor-pointer'
                          }`}
                        >
                          {uploadingDocument === 'freteDocs' ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Upload className="w-3.5 h-3.5" />
                          )}
                          {uploadingDocument === 'freteDocs' ? 'Enviando...' : 'Adicionar arquivos'}
                        </label>
                      </div>
                    )}

                    <FreightDocumentGallery
                      documents={documents.freteDocs}
                      canRemove={canManageFreightDocuments}
                      removingPath={removingDocumentPath}
                      onPreview={setSelectedPhoto}
                      onRemove={(doc) => void handleRemoveDocument('freteDocs', doc)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Rodapé de ações */}
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between gap-3 shrink-0 bg-gray-100">
              <p className="text-xs text-gray-500">
                Frete #{selectedRoute.freight_id} · {getStatusDisplay(selectedRoute.status).label}
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-5 py-2.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors font-medium"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleCloseModal()
                    handleOpenEdit(selectedRoute)
                  }}
                  className="px-5 py-2.5 bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 rounded-lg hover:bg-slate-900 dark:hover:bg-slate-300 transition-colors font-medium flex items-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Editar rota
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal de Visualização de Foto */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-[60] overflow-y-auto overflow-x-hidden bg-black/90 p-4 flex items-center justify-center min-h-0"
          onClick={() => setSelectedPhoto(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative my-auto flex w-full max-w-5xl shrink-0 justify-center"
            onClick={(e) => e.stopPropagation()}
          >
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
                target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="800" height="600"%3E%3Crect fill="%23ddd" width="800" height="600"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EImagem não disponível%3C/text%3E%3C/svg%3E'
              }}
            />
          </motion.div>
        </div>
      )}

      {/* Modal de Criar Nova Rota */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-800 rounded-lg flex items-center justify-center">
                  <Plus className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Criar Nova Rota</h2>
              </div>
              <button
                onClick={handleCloseCreateModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <form onSubmit={handleCreateRoute} noValidate className="p-6 space-y-6">
              {/* CEP será adicionado antes dos campos de origem */}
              {renderCompanyFields()}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Status de Pagamento
                  </label>
                  <select
                    value={formData.paymentStatus}
                    onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                  >
                    <option value="">Selecione</option>
                    {PAYMENT_STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Tipo de Pagamento
                  </label>
                  <select
                    value={formData.paymentType}
                    onChange={(e) => setFormData({ ...formData, paymentType: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                  >
                    <option value="">Selecione</option>
                    {formData.paymentType && !PAYMENT_TYPE_OPTIONS.some((type) => type === formData.paymentType) && (
                      <option value={formData.paymentType}>{formData.paymentType} (cadastro anterior)</option>
                    )}
                    {PAYMENT_TYPE_OPTIONS.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="create-freight-type" className="block text-sm font-semibold text-gray-900 mb-2">Tipo de frete</label>
                  <select id="create-freight-type" value={formData.freightType} onChange={(e) => setFormData({ ...formData, freightType: e.target.value })} className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800">
                    <option value="">Selecione</option>
                    <option value="Dedicado">Dedicado</option>
                    <option value="Fracionado">Fracionado</option>
                  </select>
                </div>
              </div>

              <details className="group border-t border-gray-200 pt-4">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 [&::-webkit-details-marker]:hidden">
                  Dados do motorista e datas
                  <ChevronDown className="h-4 w-4 text-gray-500 transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <div className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Nome do Motorista
                  </label>
                  <input
                    type="text"
                    value={formData.driverName}
                    onChange={(e) => setFormData({ ...formData, driverName: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                    placeholder="Digite o nome do motorista"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Celular do Motorista
                  </label>
                  <input
                    type="tel"
                    value={formData.driverPhone}
                    onChange={(e) => setFormData({ ...formData, driverPhone: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                    placeholder="Ex: (11) 99999-9999"
                  />
                  {getWhatsAppWebUrl(formData.driverPhone) && (
                    <a
                      href={getWhatsAppWebUrl(formData.driverPhone) || undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-xs font-medium text-green-700 hover:text-green-800"
                    >
                      Abrir {formData.driverPhone} no WhatsApp Web
                    </a>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Status Motorista
                  </label>
                  <select
                    value={formData.driverPaymentType}
                    onChange={(e) => setFormData({ ...formData, driverPaymentType: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                  >
                    <option value="">Selecione</option>
                    {DRIVER_PAYMENT_TYPE_OPTIONS.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              </div>

              {renderRouteDates()}
                </div>
              </details>

              {/* Origem - Começando pelo CEP */}
              <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200 [&_label]:!text-slate-900 [&_input]:!bg-white [&_input]:!text-slate-900 [&_input]:!border-slate-300">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-blue-600" />
                  Origem / Coleta
                </h3>
                
                <CEPInput
                  value={originCEP}
                  onChange={setOriginCEP}
                  onCEPFound={(data: CEPData) => {
                    setFormData({
                      ...formData,
                      origin: data.localidade || formData.origin,
                      originState: data.uf || formData.originState,
                      originAddress: data.logradouro || formData.originAddress
                    })
                  }}
                  label="CEP de Origem (opcional — preenche cidade e endereço automaticamente)"
                />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Cidade de Origem <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.origin}
                    onChange={(e) => {
                      setFormData({ ...formData, origin: e.target.value })
                      setOriginCityFeedback({ kind: 'idle' })
                    }}
                    onBlur={() => { void resolveCityField('origin') }}
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                      placeholder="Digite a cidade ou use Buscar no CEP acima"
                  />
                  {originCityFeedback.kind === 'loading' && (
                    <p className="mt-1 text-xs text-gray-500 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Verificando cidade...
                    </p>
                  )}
                  {originCityFeedback.kind === 'ok' && (
                    <p className="mt-1 text-xs text-green-700">
                      Cidade reconhecida: <strong>{originCityFeedback.name}</strong> ({originCityFeedback.state})
                    </p>
                  )}
                  {originCityFeedback.kind === 'notfound' && (
                    <p className="mt-1 text-xs text-amber-600">
                      Não encontramos essa cidade na base do IBGE. Confira se está escrita corretamente.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Estado <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={2}
                    value={formData.originState}
                    onChange={(e) => setFormData({ ...formData, originState: e.target.value.toUpperCase() })}
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                      placeholder="UF (preenchida ao sair do campo Cidade)"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Endereço de Origem
                </label>
                <input
                  type="text"
                  value={formData.originAddress}
                  onChange={(e) => setFormData({ ...formData, originAddress: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                    placeholder="Rua, número, complemento (ou use Buscar no CEP acima)"
                />
                </div>
              </div>

              {/* Destino - Começando pelo CEP */}
              <div className="space-y-4 p-4 bg-green-50 rounded-lg border border-green-200 [&_label]:!text-slate-900 [&_input]:!bg-white [&_input]:!text-slate-900 [&_input]:!border-slate-300">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-green-600" />
                  Destino / Entrega
                </h3>
                
                <CEPInput
                  value={destinationCEP}
                  onChange={setDestinationCEP}
                  onCEPFound={(data: CEPData) => {
                    setFormData({
                      ...formData,
                      destination: data.localidade || formData.destination,
                      destinationState: data.uf || formData.destinationState,
                      destinationAddress: data.logradouro || formData.destinationAddress
                    })
                  }}
                  label="CEP de Destino (opcional — preenche cidade e endereço automaticamente)"
                />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Cidade de Destino <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.destination}
                    onChange={(e) => {
                      setFormData({ ...formData, destination: e.target.value })
                      setDestinationCityFeedback({ kind: 'idle' })
                    }}
                    onBlur={() => { void resolveCityField('destination') }}
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                      placeholder="Digite a cidade ou use Buscar no CEP acima"
                  />
                  {destinationCityFeedback.kind === 'loading' && (
                    <p className="mt-1 text-xs text-gray-500 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Verificando cidade...
                    </p>
                  )}
                  {destinationCityFeedback.kind === 'ok' && (
                    <p className="mt-1 text-xs text-green-700">
                      Cidade reconhecida: <strong>{destinationCityFeedback.name}</strong> ({destinationCityFeedback.state})
                    </p>
                  )}
                  {destinationCityFeedback.kind === 'notfound' && (
                    <p className="mt-1 text-xs text-amber-600">
                      Não encontramos essa cidade na base do IBGE. Confira se está escrita corretamente.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Estado <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={2}
                    value={formData.destinationState}
                    onChange={(e) => setFormData({ ...formData, destinationState: e.target.value.toUpperCase() })}
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                      placeholder="UF (preenchida ao sair do campo Cidade)"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Endereço de Destino
                </label>
                <input
                  type="text"
                  value={formData.destinationAddress}
                  onChange={(e) => setFormData({ ...formData, destinationAddress: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                    placeholder="Rua, número, complemento (ou use Buscar no CEP acima)"
                />
                </div>
              </div>

              {renderCargoAndValues()}

              {/* Botões */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleCloseCreateModal}
                  className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    'Criar Rota'
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Modal de Editar Rota */}
      {showEditModal && editingRoute && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-800 rounded-lg flex items-center justify-center">
                  <Edit className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Editar Rota</h2>
              </div>
              <button
                onClick={handleCloseEditModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <form onSubmit={handleUpdateRoute} noValidate className="p-6 space-y-6">
              {renderCompanyFields()}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Status de Pagamento
                  </label>
                  <select
                    value={formData.paymentStatus}
                    onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                  >
                    <option value="">Selecione</option>
                    {PAYMENT_STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Tipo de Pagamento
                  </label>
                  <select
                    value={formData.paymentType}
                    onChange={(e) => setFormData({ ...formData, paymentType: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                  >
                    <option value="">Selecione</option>
                    {formData.paymentType && !PAYMENT_TYPE_OPTIONS.some((type) => type === formData.paymentType) && (
                      <option value={formData.paymentType}>{formData.paymentType} (cadastro anterior)</option>
                    )}
                    {PAYMENT_TYPE_OPTIONS.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="edit-freight-type" className="block text-sm font-semibold text-gray-900 mb-2">Tipo de frete</label>
                  <select id="edit-freight-type" value={formData.freightType} onChange={(e) => setFormData({ ...formData, freightType: e.target.value })} className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800">
                    <option value="">Selecione</option>
                    <option value="Dedicado">Dedicado</option>
                    <option value="Fracionado">Fracionado</option>
                  </select>
                </div>
              </div>

              <details className="group border-t border-gray-200 pt-4">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 [&::-webkit-details-marker]:hidden">
                  Dados do motorista e datas
                  <ChevronDown className="h-4 w-4 text-gray-500 transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <div className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Nome do Motorista
                  </label>
                  <input
                    type="text"
                    value={formData.driverName}
                    onChange={(e) => setFormData({ ...formData, driverName: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                    placeholder="Digite o nome do motorista"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Celular do Motorista
                  </label>
                  <input
                    type="tel"
                    value={formData.driverPhone}
                    onChange={(e) => setFormData({ ...formData, driverPhone: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                    placeholder="Ex: (11) 99999-9999"
                  />
                  {getWhatsAppWebUrl(formData.driverPhone) && (
                    <a
                      href={getWhatsAppWebUrl(formData.driverPhone) || undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-xs font-medium text-green-700 hover:text-green-800"
                    >
                      Abrir {formData.driverPhone} no WhatsApp Web
                    </a>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Status Motorista
                  </label>
                  <select
                    value={formData.driverPaymentType}
                    onChange={(e) => setFormData({ ...formData, driverPaymentType: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                  >
                    <option value="">Selecione</option>
                    {DRIVER_PAYMENT_TYPE_OPTIONS.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              </div>

              {renderRouteDates()}
                </div>
              </details>

              {/* Origem - Começando pelo CEP */}
              <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200 [&_label]:!text-slate-900 [&_input]:!bg-white [&_input]:!text-slate-900 [&_input]:!border-slate-300">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-blue-600" />
                  Origem / Coleta
                </h3>
                
                <CEPInput
                  value={originCEP}
                  onChange={setOriginCEP}
                  onCEPFound={(data: CEPData) => {
                    setFormData({
                      ...formData,
                      origin: data.localidade || formData.origin,
                      originState: data.uf || formData.originState,
                      originAddress: data.logradouro || formData.originAddress
                    })
                  }}
                  label="CEP de Origem (opcional — preenche cidade e endereço automaticamente)"
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Cidade de Origem <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.origin}
                      onChange={(e) => {
                        setFormData({ ...formData, origin: e.target.value })
                        setOriginCityFeedback({ kind: 'idle' })
                      }}
                      onBlur={() => { void resolveCityField('origin') }}
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                      placeholder="Digite a cidade ou use Buscar no CEP acima"
                    />
                    {originCityFeedback.kind === 'loading' && (
                      <p className="mt-1 text-xs text-gray-500 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Verificando cidade...
                      </p>
                    )}
                    {originCityFeedback.kind === 'ok' && (
                      <p className="mt-1 text-xs text-green-700">
                        Cidade reconhecida: <strong>{originCityFeedback.name}</strong> ({originCityFeedback.state})
                      </p>
                    )}
                    {originCityFeedback.kind === 'notfound' && (
                      <p className="mt-1 text-xs text-amber-600">
                        Não encontramos essa cidade na base do IBGE. Confira se está escrita corretamente.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Estado <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={2}
                      value={formData.originState}
                      onChange={(e) => setFormData({ ...formData, originState: e.target.value.toUpperCase() })}
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                      placeholder="UF (preenchida ao sair do campo Cidade)"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Endereço de Origem
                  </label>
                  <input
                    type="text"
                    value={formData.originAddress}
                    onChange={(e) => setFormData({ ...formData, originAddress: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                    placeholder="Rua, número, complemento (ou use Buscar no CEP acima)"
                  />
                </div>
              </div>

              {/* Destino - Começando pelo CEP */}
              <div className="space-y-4 p-4 bg-green-50 rounded-lg border border-green-200 [&_label]:!text-slate-900 [&_input]:!bg-white [&_input]:!text-slate-900 [&_input]:!border-slate-300">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-green-600" />
                  Destino / Entrega
                </h3>
                
                <CEPInput
                  value={destinationCEP}
                  onChange={setDestinationCEP}
                  onCEPFound={(data: CEPData) => {
                    setFormData({
                      ...formData,
                      destination: data.localidade || formData.destination,
                      destinationState: data.uf || formData.destinationState,
                      destinationAddress: data.logradouro || formData.destinationAddress
                    })
                  }}
                  label="CEP de Destino (opcional — preenche cidade e endereço automaticamente)"
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Cidade de Destino <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.destination}
                      onChange={(e) => {
                        setFormData({ ...formData, destination: e.target.value })
                        setDestinationCityFeedback({ kind: 'idle' })
                      }}
                      onBlur={() => { void resolveCityField('destination') }}
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                      placeholder="Digite a cidade ou use Buscar no CEP acima"
                    />
                    {destinationCityFeedback.kind === 'loading' && (
                      <p className="mt-1 text-xs text-gray-500 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Verificando cidade...
                      </p>
                    )}
                    {destinationCityFeedback.kind === 'ok' && (
                      <p className="mt-1 text-xs text-green-700">
                        Cidade reconhecida: <strong>{destinationCityFeedback.name}</strong> ({destinationCityFeedback.state})
                      </p>
                    )}
                    {destinationCityFeedback.kind === 'notfound' && (
                      <p className="mt-1 text-xs text-amber-600">
                        Não encontramos essa cidade na base do IBGE. Confira se está escrita corretamente.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Estado <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={2}
                      value={formData.destinationState}
                      onChange={(e) => setFormData({ ...formData, destinationState: e.target.value.toUpperCase() })}
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                      placeholder="UF (preenchida ao sair do campo Cidade)"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Endereço de Destino
                  </label>
                  <input
                    type="text"
                    value={formData.destinationAddress}
                    onChange={(e) => setFormData({ ...formData, destinationAddress: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                    placeholder="Rua, número, complemento (ou use Buscar no CEP acima)"
                  />
                </div>
              </div>

              {renderCargoAndValues()}

              {/* Botões */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleCloseEditModal}
                  className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar Alterações'
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  )
}
