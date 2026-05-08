'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Route, MapPin, ArrowRight, X, Truck, Calendar, Building2, Phone, Mail, Plus, Edit, Trash2, Loader2, Upload, Eye, ChevronDown } from 'lucide-react'
import { useRoutes } from '@/lib/hooks/useRoutes'
import { useClients } from '@/lib/hooks/useClients'
import { useDrivers } from '@/lib/hooks/useDrivers'
import {
  Route as RouteType,
  CreateRouteData,
  ROUTE_NO_DRIVER_PLATE,
  ROUTE_NO_DRIVER_VEHICLE,
} from '@/lib/services/routes'
import { Client, ensureClientFromRoute } from '@/lib/services/clients'
import { Driver } from '@/lib/services/drivers'
import CEPInput from '@/components/transporteja/CEPInput'
import { CEPData } from '@/lib/services/cep'
import { supabase } from '@/lib/supabase/client'
import { useAuthState } from '@/lib/hooks/useAuthState'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import { useDebouncedRouteDistance } from '@/lib/hooks/useDebouncedRouteDistance'

const TAXES_PERCENT_OPTIONS = [0, 10, 12, 18] as const

function normalizeTaxesPercent(value: unknown): (typeof TAXES_PERCENT_OPTIONS)[number] {
  const n = typeof value === 'number' && !Number.isNaN(value) ? value : Number(value)
  if (n === 0 || n === 10 || n === 12 || n === 18) return n
  return 18
}

/** Infere o percentual a partir de valores já gravados (rotas antigas sem coluna). */
function inferTaxesPercentFromValues(
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

function getRouteTaxesPercent(route: RouteType): (typeof TAXES_PERCENT_OPTIONS)[number] {
  const raw = route.taxes_percent
  if (raw === 0 || raw === 10 || raw === 12 || raw === 18) return raw
  return inferTaxesPercentFromValues(route.freight_value ?? route.nf_value ?? undefined, route.taxes_value ?? undefined)
}

// Interface para exibição (com dados do cliente)
interface RouteDisplayData extends RouteType {
  client?: Client
  driver?: Driver
}

type DocumentKey = 'freteDocs'
type RouteStatus = RouteType['status']
const EMPTY_DOCUMENT_URLS: Record<DocumentKey, string | null> = {
  freteDocs: null,
}

const ROUTE_STATUS_OPTIONS: RouteStatus[] = ['pending', 'pickedUp', 'inTransit', 'delivered', 'cancelled']
const PAYMENT_STATUS_OPTIONS = ['Pendente', '50%', '70%', '100%'] as const
const PAYMENT_TYPE_OPTIONS = ['Pix', 'Cartão de crédito', 'Transferencia', 'Boleto'] as const
const DRIVER_PAYMENT_TYPE_OPTIONS = ['Pendente', '50%', '70%', '100%'] as const

export default function RotasPage() {
  const { session } = useAuthState()
  const { user: currentUser } = useCurrentUser()
  const isAdminUser = currentUser?.role === 'admin'
  const { routes, loading: routesLoading, error: routesError, createRoute, updateRoute, deleteRoute } = useRoutes()
  const { clients, loading: clientsLoading } = useClients()
  const { drivers, loading: driversLoading } = useDrivers()
  
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'inTransit' | 'pickedUp' | 'delivered' | 'cancelled'>('all')
  const [selectedRoute, setSelectedRoute] = useState<RouteDisplayData | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingRoute, setEditingRoute] = useState<RouteType | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)
  const [documentUrls, setDocumentUrls] = useState<Record<DocumentKey, string | null>>(EMPTY_DOCUMENT_URLS)
  const [uploadingDocument, setUploadingDocument] = useState<DocumentKey | null>(null)
  const [updatingStatusRouteId, setUpdatingStatusRouteId] = useState<string | null>(null)
  
  const [companyInput, setCompanyInput] = useState('')
  
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
    weight: '',
    freightValue: '',
    driverValue: '',
    taxesValue: '',
    netFreightValue: '',
    commissionValue: '',
    paymentStatus: '',
    paymentType: '',
    driverName: '',
    driverPhone: '',
    driverPaymentStatus: '',
    driverPaymentType: '',
    nfValue: '',
    observation: '',
    estimatedDelivery: '',
    pickupDate: '',
    taxesPercent: '18',
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
    return routes.map(route => {
      const client = clients.find(c => 
        c.company_name === route.company_name || 
        (route.company_email && c.email === route.company_email)
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
  }, [routes, clients, drivers])

  const filteredRoutes = useMemo(() => {
    return routesWithDetails.filter(route => {
    return filterStatus === 'all' || route.status === filterStatus
  })
  }, [routesWithDetails, filterStatus])

  const statusCounts = useMemo(() => ({
    all: routes.length,
    pending: routes.filter(r => r.status === 'pending').length,
    inTransit: routes.filter(r => r.status === 'inTransit').length,
    pickedUp: routes.filter(r => r.status === 'pickedUp').length,
    delivered: routes.filter(r => r.status === 'delivered').length,
    cancelled: routes.filter(r => r.status === 'cancelled').length
  }), [routes])

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

  const handleViewMore = (route: RouteDisplayData) => {
    setSelectedRoute(route)
    setDocumentUrls(EMPTY_DOCUMENT_URLS)
    setUploadingDocument(null)
  }

  const handleOpenEdit = (route: RouteDisplayData) => {
    setEditingRoute(route)
    const client = clients.find(c => 
      c.company_name === route.company_name || 
      (route.company_email && c.email === route.company_email)
    )
    setCompanyInput(client?.company_name || route.company_name || '')
    setFormData({
      origin: route.origin,
      originState: route.origin_state,
      originAddress: route.origin_address || '',
      destination: route.destination,
      destinationState: route.destination_state,
      destinationAddress: route.destination_address || '',
      companyPhone: route.company_phone || client?.whatsapp || '',
      companyEmail: route.company_email || client?.email || '',
      weight: route.weight,
      freightValue: route.freight_value != null ? String(route.freight_value).replace('.', ',') : '',
      driverValue: route.driver_value != null ? String(route.driver_value).replace('.', ',') : '',
      taxesValue: route.taxes_value != null ? String(route.taxes_value).replace('.', ',') : '',
      netFreightValue: route.net_freight_value != null ? String(route.net_freight_value).replace('.', ',') : '',
      commissionValue: route.commission_value != null ? String(route.commission_value).replace('.', ',') : '',
      paymentStatus: route.payment_status || '',
      paymentType: route.payment_type || '',
      driverName: route.driver_name || route.driver?.name || '',
      driverPhone: route.driver_phone || route.driver?.phone || '',
      driverPaymentStatus: route.driver_payment_status || '',
      driverPaymentType: route.driver_payment_type || '',
      nfValue: route.nf_value != null ? String(route.nf_value).replace('.', ',') : '',
      observation: route.observation || '',
      estimatedDelivery: route.estimated_delivery,
      pickupDate: route.pickup_date,
      taxesPercent: String(getRouteTaxesPercent(route)),
    })
    setShowEditModal(true)
  }

  const handleDeleteRoute = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta rota?')) return
    
    try {
      await deleteRoute(id)
    } catch (err: any) {
      alert(`Erro ao excluir: ${err.message}`)
    }
  }

  const handleCloseModal = () => {
    setSelectedRoute(null)
    setSelectedPhoto(null)
    setDocumentUrls(EMPTY_DOCUMENT_URLS)
    setUploadingDocument(null)
  }

  const handleUploadDocument = async (documentKey: DocumentKey, file: File | null) => {
    if (!file || !selectedRoute) return

    const isImage = file.type.startsWith('image/')
    if (!isImage) {
      alert('Envie apenas imagem (JPG, PNG, WEBP).')
      return
    }

    try {
      setUploadingDocument(documentKey)
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const filePath = `documents/${selectedRoute.id}/${documentKey}-${Date.now()}-${safeName}`
      const { data, error } = await supabase.storage
        .from('checkin-photos')
        .upload(filePath, file, { cacheControl: '3600', upsert: true })

      if (error) throw error

      const { data: publicData } = supabase.storage
        .from('checkin-photos')
        .getPublicUrl(data.path)

      setDocumentUrls((prev) => ({ ...prev, [documentKey]: publicData.publicUrl }))
    } catch (err: any) {
      alert(`Erro ao anexar imagem: ${err?.message || 'tente novamente.'}`)
    } finally {
      setUploadingDocument(null)
    }
  }

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp)
    return {
      date: date.toLocaleDateString('pt-BR'),
      time: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }
  }

  const findCompanyByInput = useCallback((value: string): Client | null => {
    const q = value.trim().toLowerCase()
    if (!q) return null
    return (
      clients.find((c) =>
        c.company_name.toLowerCase() === q || c.email.toLowerCase() === q || c.responsible.toLowerCase() === q
      ) ||
      clients.find((c) =>
        c.company_name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.responsible.toLowerCase().includes(q)
      ) ||
      null
    )
  }, [clients])

  /** Cliente do cadastro ou nome digitado (texto livre) para preencher os campos da rota. */
  const resolveCompanyForRoute = useCallback(
    (matched: Client | null, rawInput: string) => {
      const raw = rawInput.trim()
      if (matched) {
        return {
          company_name: matched.company_name,
          company_responsible: matched.responsible,
          company_phone: matched.whatsapp,
          company_email: matched.email,
          company_address: matched.address,
          company_city: matched.city,
          company_state: matched.state,
        }
      }
      if (raw) {
        return {
          company_name: raw,
          company_responsible: 'Não informado',
          company_phone: '',
          company_email: '',
          company_address: '',
          company_city: '',
          company_state: '',
        }
      }
      return null
    },
    []
  )

  const companyInputMatch = useMemo(
    () => findCompanyByInput(companyInput),
    [companyInput, findCompanyByInput]
  )

  const formatDateBR = (dateString: string) => {
    if (!dateString) return ''
    // Se já está formatado (ex: "05 Out, 2025"), retornar como está
    if (dateString.includes(',')) return dateString
    
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

  const calculateTaxesValue = (freightValue?: number | null, taxesPercent?: number | null) => {
    if (freightValue == null) return null
    const p = normalizeTaxesPercent(taxesPercent) / 100
    return Math.round(freightValue * p * 100) / 100
  }

  const calculateCommissionValue = (netFreightValue?: number | null) => {
    if (netFreightValue == null) return null
    return Math.round(netFreightValue * 0.3 * 100) / 100
  }

  const calculateNetFreightValue = (
    freightValue?: number | null,
    driverValue?: number | null,
    taxesPercent?: number | null,
  ) => {
    if (freightValue == null) return null
    const taxesValue = calculateTaxesValue(freightValue, taxesPercent) ?? 0
    return Math.round((freightValue - taxesValue - (driverValue ?? 0)) * 100) / 100
  }

  const getWhatsAppWebUrl = (phone?: string | null) => {
    const digits = phone?.replace(/\D/g, '') || ''
    if (!digits) return null
    const normalized = digits.startsWith('55') ? digits : `55${digits}`
    return `https://web.whatsapp.com/send?phone=${normalized}`
  }

  const handleCreateRoute = async (e: React.FormEvent) => {
    e.preventDefault()

    const matchedCompany = findCompanyByInput(companyInput)
    const companyResolved = resolveCompanyForRoute(matchedCompany, companyInput)
    if (!companyResolved) {
      alert('Informe a empresa: escolha um cliente da lista ou digite o nome da empresa.')
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

    setIsSubmitting(true)

    try {
      const freightValue = parseCurrencyInput(formData.freightValue)
      const driverValue = parseCurrencyInput(formData.driverValue)
      const taxesPercent = isAdminUser
        ? normalizeTaxesPercent(Number(formData.taxesPercent))
        : 18
      const netFreightValue = calculateNetFreightValue(freightValue, driverValue, taxesPercent)
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
      freight_value: freightValue,
      driver_value: driverValue,
      taxes_value: calculateTaxesValue(freightValue, taxesPercent),
      taxes_percent: taxesPercent,
      net_freight_value: netFreightValue,
      commission_value: calculateCommissionValue(netFreightValue),
      payment_status: formData.paymentStatus.trim() || null,
      payment_type: formData.paymentType.trim() || null,
      driver_name: formData.driverName.trim() || null,
      driver_phone: formData.driverPhone.trim() || null,
      driver_payment_status: formData.driverPaymentStatus.trim() || null,
      driver_payment_type: formData.driverPaymentType.trim() || null,
      nf_value: parseCurrencyInput(formData.nfValue),
      observation: formData.observation.trim() || null,
        estimated_delivery: formData.estimatedDelivery.trim(),
        pickup_date: formData.pickupDate.trim(),
        status: 'pending',
        company_name: companyResolved.company_name,
        company_responsible: companyResolved.company_responsible,
        company_phone: formData.companyPhone.trim() || companyResolved.company_phone,
        company_email: formData.companyEmail.trim() || companyResolved.company_email,
        company_address: companyResolved.company_address,
        company_city: companyResolved.company_city,
        company_state: companyResolved.company_state,
        distance_km:
          routeDistance.distanciaKm ??
          null,
        created_by_user_id: session?.user?.id,
      }

      await createRoute(routeData)

      await ensureClientFromRoute({
        companyName: companyResolved.company_name,
        responsible: companyResolved.company_responsible,
        phone: routeData.company_phone ?? null,
        email: routeData.company_email ?? null,
        city: companyResolved.company_city,
        state: companyResolved.company_state,
        address: companyResolved.company_address,
      })

      handleCloseCreateModal()
    } catch (err: any) {
      alert(`Erro ao criar rota: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateRoute = async (e: React.FormEvent) => {
    e.preventDefault()

    const matchedCompany = findCompanyByInput(companyInput)
    const companyResolved = resolveCompanyForRoute(matchedCompany, companyInput)
    if (!companyResolved) {
      alert('Informe a empresa: escolha um cliente da lista ou digite o nome da empresa.')
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

    setIsSubmitting(true)

    try {
      const freightValue = parseCurrencyInput(formData.freightValue)
      const driverValue = parseCurrencyInput(formData.driverValue)
      const taxesPercent = isAdminUser
        ? normalizeTaxesPercent(Number(formData.taxesPercent))
        : getRouteTaxesPercent(editingRoute)
      const netFreightValue = calculateNetFreightValue(freightValue, driverValue, taxesPercent)
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
        freight_value: freightValue,
        driver_value: driverValue,
        taxes_value: calculateTaxesValue(freightValue, taxesPercent),
        taxes_percent: taxesPercent,
        net_freight_value: netFreightValue,
        commission_value: calculateCommissionValue(netFreightValue),
        payment_status: formData.paymentStatus.trim() || null,
        payment_type: formData.paymentType.trim() || null,
        driver_name: formData.driverName.trim() || null,
        driver_phone: formData.driverPhone.trim() || null,
        driver_payment_status: formData.driverPaymentStatus.trim() || null,
        driver_payment_type: formData.driverPaymentType.trim() || null,
        nf_value: parseCurrencyInput(formData.nfValue),
        observation: formData.observation.trim() || null,
        estimated_delivery: formData.estimatedDelivery.trim(),
        pickup_date: formData.pickupDate.trim(),
        status: editingRoute.status,
        company_name: companyResolved.company_name,
        company_responsible: companyResolved.company_responsible,
        company_phone: formData.companyPhone.trim() || companyResolved.company_phone,
        company_email: formData.companyEmail.trim() || companyResolved.company_email,
        company_address: companyResolved.company_address,
        company_city: companyResolved.company_city,
        company_state: companyResolved.company_state,
        distance_km:
          routeDistance.distanciaKm ??
          editingRoute.distance_km ??
          null,
      })

      await ensureClientFromRoute({
        companyName: companyResolved.company_name,
        responsible: companyResolved.company_responsible,
        phone: formData.companyPhone.trim() || companyResolved.company_phone,
        email: formData.companyEmail.trim() || companyResolved.company_email,
        city: companyResolved.company_city,
        state: companyResolved.company_state,
        address: companyResolved.company_address,
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
    setOriginCEP('')
    setDestinationCEP('')
    setFormData({
      origin: '',
      originState: '',
      originAddress: '',
      destination: '',
      destinationState: '',
      destinationAddress: '',
      companyPhone: '',
      companyEmail: '',
      weight: '',
      freightValue: '',
      driverValue: '',
      taxesValue: '',
      netFreightValue: '',
      commissionValue: '',
      paymentStatus: '',
      paymentType: '',
      driverName: '',
      driverPhone: '',
      driverPaymentStatus: '',
      driverPaymentType: '',
      nfValue: '',
      observation: '',
      estimatedDelivery: '',
      pickupDate: '',
      taxesPercent: '18',
    })
  }

  const handleCloseEditModal = () => {
    setShowEditModal(false)
    setEditingRoute(null)
    setCompanyInput('')
    setOriginCEP('')
    setDestinationCEP('')
    setFormData({
      origin: '',
      originState: '',
      originAddress: '',
      destination: '',
      destinationState: '',
      destinationAddress: '',
      companyPhone: '',
      companyEmail: '',
      weight: '',
      freightValue: '',
      driverValue: '',
      taxesValue: '',
      netFreightValue: '',
      commissionValue: '',
      paymentStatus: '',
      paymentType: '',
      driverName: '',
      driverPhone: '',
      driverPaymentStatus: '',
      driverPaymentType: '',
      nfValue: '',
      observation: '',
      estimatedDelivery: '',
      pickupDate: '',
      taxesPercent: '18',
    })
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

      {/* Filtros de Status - Estilo Referência */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
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
          Pendente {statusCounts.pickedUp}
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
      </div>

      {/* Tabela — scroll horizontal + coluna de ações fixa à direita em telas estreitas */}
      <div className="bg-white rounded-xl border border-gray-200 min-w-0 overflow-hidden">
        <div className="overflow-x-auto overflow-y-visible overscroll-x-contain touch-pan-x">
          <table className="w-full min-w-[640px] table-auto border-separate border-spacing-0">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-3 sm:px-4 lg:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Frete
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
                    <td className="px-3 sm:px-4 lg:px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-gray-600 shrink-0" />
                            <span className="text-sm text-gray-900">
                              {route.origin}, {route.origin_state}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <ArrowRight className="w-4 h-4 text-gray-400 shrink-0" />
                            <MapPin className="w-4 h-4 text-gray-600 shrink-0" />
                            <span className="text-sm text-gray-900">
                              {route.destination}, {route.destination_state}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-3 sm:px-4 lg:px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900 tabular-nums">
                        {formatCurrencyBR(route.freight_value ?? route.nf_value)}
                      </span>
                    </td>
                    <td className="hidden lg:table-cell px-3 sm:px-4 lg:px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900 tabular-nums">
                        {formatCurrencyBR(route.driver_value)}
                      </span>
                    </td>
                    <td className="hidden xl:table-cell px-3 sm:px-4 lg:px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900 tabular-nums">
                        {formatCurrencyBR(
                          route.taxes_value ??
                            calculateTaxesValue(route.freight_value ?? route.nf_value, getRouteTaxesPercent(route)),
                        )}
                      </span>
                    </td>
                    <td className="hidden xl:table-cell px-3 sm:px-4 lg:px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900 tabular-nums">
                        {formatCurrencyBR(
                          route.net_freight_value ??
                            calculateNetFreightValue(
                              route.freight_value ?? route.nf_value,
                              route.driver_value,
                              getRouteTaxesPercent(route),
                            ),
                        )}
                      </span>
                    </td>
                    <td className="hidden 2xl:table-cell px-3 sm:px-4 lg:px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900 tabular-nums">
                        {formatCurrencyBR(
                          route.commission_value ??
                            calculateCommissionValue(
                              calculateNetFreightValue(
                                route.freight_value ?? route.nf_value,
                                route.driver_value,
                                getRouteTaxesPercent(route),
                              ),
                            ),
                        )}
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
            className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
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

            <div className="p-6 space-y-6">
              {/* Informações da Empresa */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Empresa
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Nome da Empresa</p>
                    <p className="text-sm font-medium text-gray-900">{selectedRoute.client?.company_name || selectedRoute.company_name || 'N/A'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Responsável</p>
                    <p className="text-sm font-medium text-gray-900">{selectedRoute.client?.responsible || selectedRoute.company_responsible || 'N/A'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      Telefone
                    </p>
                    <p className="text-sm font-medium text-gray-900">{selectedRoute.client?.whatsapp || selectedRoute.company_phone || 'N/A'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      E-mail
                    </p>
                    <p className="text-sm font-medium text-gray-900">{selectedRoute.client?.email || selectedRoute.company_email || 'N/A'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Status de Pagamento</p>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedRoute.payment_status || '—'}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Tipo de Pagamento</p>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedRoute.payment_type || '—'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Informações da Rota */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Route className="w-5 h-5" />
                  Rota
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Origem - Lado Esquerdo */}
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-blue-600 font-semibold mb-2 uppercase tracking-wide">De onde foi coletado</p>
                        <p className="text-sm font-bold text-gray-900 mb-1">
                          {selectedRoute.origin}, {selectedRoute.origin_state}
                        </p>
                        {selectedRoute.origin_address && (
                          <p className="text-xs text-gray-600 mt-1">
                            {selectedRoute.origin_address}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Destino - Lado Direito */}
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-green-600 font-semibold mb-2 uppercase tracking-wide">Lugar de entrega</p>
                        <p className="text-sm font-bold text-gray-900 mb-1">
                          {selectedRoute.destination}, {selectedRoute.destination_state}
                        </p>
                        {selectedRoute.destination_address && (
                          <p className="text-xs text-gray-600 mt-1">
                            {selectedRoute.destination_address}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Informações do Veículo */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Truck className="w-5 h-5" />
                  Veículo
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Modelo</p>
                    <p className="text-sm font-medium text-gray-900">{selectedRoute.vehicle}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Placa</p>
                    <p className="text-sm font-medium text-gray-900">{selectedRoute.plate}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Peso</p>
                    <p className="text-sm font-medium text-gray-900">{selectedRoute.weight}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Nome do Motorista</p>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedRoute.driver_name || selectedRoute.driver?.name || '—'}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Celular do Motorista</p>
                    {getWhatsAppWebUrl(selectedRoute.driver_phone || selectedRoute.driver?.phone) ? (
                      <a
                        href={getWhatsAppWebUrl(selectedRoute.driver_phone || selectedRoute.driver?.phone) || undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-green-700 hover:text-green-800"
                      >
                        {selectedRoute.driver_phone || selectedRoute.driver?.phone}
                      </a>
                    ) : (
                      <p className="text-sm font-medium text-gray-900">—</p>
                    )}
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Status Motorista</p>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedRoute.driver_payment_type || '—'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Informações de Datas */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Datas
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Data de Coleta</p>
                    <p className="text-sm font-medium text-gray-900">{formatDateBR(selectedRoute.pickup_date)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Previsão de Entrega</p>
                    <p className="text-sm font-medium text-gray-900">{formatDateBR(selectedRoute.estimated_delivery)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Valor do Frete</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrencyBR(selectedRoute.freight_value ?? selectedRoute.nf_value)}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Valor do Motorista</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrencyBR(selectedRoute.driver_value)}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Tribultos*</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrencyBR(
                        selectedRoute.taxes_value ??
                          calculateTaxesValue(
                            selectedRoute.freight_value ?? selectedRoute.nf_value,
                            getRouteTaxesPercent(selectedRoute),
                          ),
                      )}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Alíquota: {getRouteTaxesPercent(selectedRoute)}% sobre o frete
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Frete Líquido</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrencyBR(
                        selectedRoute.net_freight_value ??
                          calculateNetFreightValue(
                            selectedRoute.freight_value ?? selectedRoute.nf_value,
                            selectedRoute.driver_value,
                            getRouteTaxesPercent(selectedRoute),
                          ),
                      )}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Comissão</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrencyBR(
                        selectedRoute.commission_value ??
                          calculateCommissionValue(
                            calculateNetFreightValue(
                              selectedRoute.freight_value ?? selectedRoute.nf_value,
                              selectedRoute.driver_value,
                              getRouteTaxesPercent(selectedRoute),
                            ),
                          ),
                      )}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Valor da NF</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrencyBR(selectedRoute.nf_value)}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 md:col-span-3">
                    <p className="text-xs text-gray-500 mb-1">Observação</p>
                    <p className="text-sm font-medium text-gray-900 whitespace-pre-wrap">
                      {selectedRoute.observation || '—'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Documentação do Frete */}
              <div className="space-y-6">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <Truck className="w-5 h-5" />
                      Informações do Frete
                    </h3>
                    <span className="text-xs text-gray-500">Frete #{selectedRoute.freight_id}</span>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-xs text-gray-700 font-semibold uppercase tracking-wide mb-1">
                      Adicione fotos / documentos
                    </p>
                    <p className="text-sm text-gray-600 mb-3">
                      Nota fiscal, CT-e, comprovantes de pagamento e demais anexos do frete.
                    </p>
                    <input
                      id="upload-frete-docs"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleUploadDocument('freteDocs', e.target.files?.[0] ?? null)}
                    />
                    <div className="flex gap-2">
                      <label
                        htmlFor="upload-frete-docs"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 cursor-pointer"
                      >
                        {uploadingDocument === 'freteDocs' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        Adicionar
                      </label>
                      {documentUrls.freteDocs && (
                        <button
                          type="button"
                          onClick={() => setSelectedPhoto(documentUrls.freteDocs)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 text-white rounded-lg hover:bg-slate-700"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Ver
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal de Visualização de Foto */}
      {selectedPhoto && (
        <div 
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative max-w-5xl w-full max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-10"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={selectedPhoto}
              alt="Foto do check-in"
              className="w-full h-full object-contain rounded-lg"
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
              {/* Empresa (preenchimento manual) */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Empresa <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  list="companies-list-create"
                  value={companyInput}
                  onChange={(e) => {
                    setCompanyInput(e.target.value)
                  }}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                  placeholder="Digite nome da empresa, responsável ou e-mail"
                />
                <datalist id="companies-list-create">
                  {clients.map((c) => (
                    <option key={c.id} value={c.company_name}>
                      {`${c.responsible} • ${c.city}/${c.state}`}
                    </option>
                  ))}
                </datalist>
                <p className="text-xs text-gray-500 mt-1">
                  {companyInputMatch
                    ? `${companyInputMatch.company_name} • ${companyInputMatch.responsible} (cadastro)`
                    : companyInput.trim()
                      ? `Será usado o nome digitado: "${companyInput.trim()}"`
                      : 'Escolha um cliente da lista ou digite o nome da empresa'}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Telefone
                  </label>
                  <input
                    type="tel"
                    value={formData.companyPhone}
                    onChange={(e) => setFormData({ ...formData, companyPhone: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                    placeholder="Ex: (11) 99999-9999"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={formData.companyEmail}
                    onChange={(e) => setFormData({ ...formData, companyEmail: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                    placeholder="empresa@email.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    {PAYMENT_TYPE_OPTIONS.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              </div>

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

              {/* Origem - Começando pelo CEP */}
              <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
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
                  autoSearch={false}
                  label="CEP de Origem (opcional — clique em Buscar para preencher cidade e endereço)"
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
                    onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                      placeholder="Digite a cidade ou use Buscar no CEP acima"
                  />
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
                      placeholder="Estado (preenchido automaticamente)"
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
              <div className="space-y-4 p-4 bg-green-50 rounded-lg border border-green-200">
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
                  autoSearch={false}
                  label="CEP de Destino (opcional — clique em Buscar para preencher cidade e endereço)"
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
                    onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                      placeholder="Digite a cidade ou use Buscar no CEP acima"
                  />
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
                      placeholder="Estado (preenchido automaticamente)"
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

              {/* Outras Informações */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Peso <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                    placeholder="Ex: 15.500 kg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Data de Coleta <span className="text-gray-500 font-normal">(opcional)</span>
                  </label>
                  <input
                    type="date"
                    value={formData.pickupDate}
                    onChange={(e) => setFormData({ ...formData, pickupDate: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Previsão de Entrega <span className="text-gray-500 font-normal">(opcional)</span>
                  </label>
                  <input
                    type="date"
                    value={formData.estimatedDelivery}
                    onChange={(e) => setFormData({ ...formData, estimatedDelivery: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Valor do Frete
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formData.freightValue}
                    onChange={(e) => setFormData({ ...formData, freightValue: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                    placeholder="Ex: 12500,00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Valor do Motorista
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formData.driverValue}
                    onChange={(e) => setFormData({ ...formData, driverValue: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                    placeholder="Ex: 8500,00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Tribultos*
                  </label>
                  {isAdminUser ? (
                    <select
                      value={formData.taxesPercent}
                      onChange={(e) => setFormData({ ...formData, taxesPercent: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800 mb-2 text-gray-900"
                      aria-label="Percentual de tributos sobre o frete"
                    >
                      {TAXES_PERCENT_OPTIONS.map((p) => (
                        <option key={p} value={String(p)}>
                          {p}% sobre o frete
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="mb-2 text-xs text-gray-600">
                      Alíquota de <strong>{normalizeTaxesPercent(Number(formData.taxesPercent))}%</strong> — somente administrador pode alterar (0%, 10%, 12% ou 18%).
                    </p>
                  )}
                  <input
                    type="text"
                    inputMode="decimal"
                    readOnly
                    value={formatCurrencyBR(
                      calculateTaxesValue(
                        parseCurrencyInput(formData.freightValue),
                        normalizeTaxesPercent(Number(formData.taxesPercent)),
                      ),
                    )}
                    className="w-full px-4 py-3 bg-slate-100 border border-gray-300 rounded-lg text-gray-700 focus:outline-none"
                    placeholder="Valor calculado"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Calculado automaticamente: {normalizeTaxesPercent(Number(formData.taxesPercent))}% do valor do frete.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Frete Líquido
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    readOnly
                    value={formatCurrencyBR(
                      calculateNetFreightValue(
                        parseCurrencyInput(formData.freightValue),
                        parseCurrencyInput(formData.driverValue),
                        normalizeTaxesPercent(Number(formData.taxesPercent)),
                      ),
                    )}
                    className="w-full px-4 py-3 bg-slate-100 border border-gray-300 rounded-lg text-gray-700 focus:outline-none"
                    placeholder="Valor do frete - tribultos - motorista"
                  />
                  <p className="mt-1 text-xs text-gray-500">Calculado automaticamente: frete - tribultos - motorista.</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Comissão
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    readOnly
                    value={formatCurrencyBR(
                      calculateCommissionValue(
                        calculateNetFreightValue(
                          parseCurrencyInput(formData.freightValue),
                          parseCurrencyInput(formData.driverValue),
                          normalizeTaxesPercent(Number(formData.taxesPercent)),
                        ),
                      ),
                    )}
                    className="w-full px-4 py-3 bg-slate-100 border border-gray-300 rounded-lg text-gray-700 focus:outline-none"
                    placeholder="30% do frete líquido"
                  />
                  <p className="mt-1 text-xs text-gray-500">Calculado automaticamente: 30% do frete líquido.</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Valor da NF
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formData.nfValue}
                    onChange={(e) => setFormData({ ...formData, nfValue: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                    placeholder="Ex: 12500,00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Observação
                </label>
                <textarea
                  rows={3}
                  value={formData.observation}
                  onChange={(e) => setFormData({ ...formData, observation: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800 resize-y"
                  placeholder="Informações adicionais do frete"
                />
              </div>

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
              {/* Empresa (preenchimento manual) */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Empresa <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  list="companies-list-edit"
                  value={companyInput}
                  onChange={(e) => {
                    setCompanyInput(e.target.value)
                  }}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                  placeholder="Digite nome da empresa, responsável ou e-mail"
                />
                <datalist id="companies-list-edit">
                  {clients.map((c) => (
                    <option key={c.id} value={c.company_name}>
                      {`${c.responsible} • ${c.city}/${c.state}`}
                    </option>
                  ))}
                </datalist>
                <p className="text-xs text-gray-500 mt-1">
                  {companyInputMatch
                    ? `${companyInputMatch.company_name} • ${companyInputMatch.responsible} (cadastro)`
                    : companyInput.trim()
                      ? `Será usado o nome digitado: "${companyInput.trim()}"`
                      : 'Escolha um cliente da lista ou digite o nome da empresa'}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Telefone
                  </label>
                  <input
                    type="tel"
                    value={formData.companyPhone}
                    onChange={(e) => setFormData({ ...formData, companyPhone: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                    placeholder="Ex: (11) 99999-9999"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={formData.companyEmail}
                    onChange={(e) => setFormData({ ...formData, companyEmail: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                    placeholder="empresa@email.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    {PAYMENT_TYPE_OPTIONS.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              </div>

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

              {/* Origem - Começando pelo CEP */}
              <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
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
                  autoSearch={false}
                  label="CEP de Origem (opcional — clique em Buscar para preencher cidade e endereço)"
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
                      onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                      placeholder="Digite a cidade ou use Buscar no CEP acima"
                    />
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
                      placeholder="Estado (preenchido automaticamente)"
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
              <div className="space-y-4 p-4 bg-green-50 rounded-lg border border-green-200">
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
                  autoSearch={false}
                  label="CEP de Destino (opcional — clique em Buscar para preencher cidade e endereço)"
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
                      onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                      placeholder="Digite a cidade ou use Buscar no CEP acima"
                    />
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
                      placeholder="Estado (preenchido automaticamente)"
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

              {/* Outras Informações */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Peso <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                    placeholder="Ex: 15.500 kg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Data de Coleta <span className="text-gray-500 font-normal">(opcional)</span>
                  </label>
                  <input
                    type="date"
                    value={formData.pickupDate}
                    onChange={(e) => setFormData({ ...formData, pickupDate: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Previsão de Entrega <span className="text-gray-500 font-normal">(opcional)</span>
                  </label>
                  <input
                    type="date"
                    value={formData.estimatedDelivery}
                    onChange={(e) => setFormData({ ...formData, estimatedDelivery: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Valor do Frete
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formData.freightValue}
                    onChange={(e) => setFormData({ ...formData, freightValue: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                    placeholder="Ex: 12500,00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Valor do Motorista
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formData.driverValue}
                    onChange={(e) => setFormData({ ...formData, driverValue: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                    placeholder="Ex: 8500,00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Tribultos*
                  </label>
                  {isAdminUser ? (
                    <select
                      value={formData.taxesPercent}
                      onChange={(e) => setFormData({ ...formData, taxesPercent: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800 mb-2 text-gray-900"
                      aria-label="Percentual de tributos sobre o frete"
                    >
                      {TAXES_PERCENT_OPTIONS.map((p) => (
                        <option key={p} value={String(p)}>
                          {p}% sobre o frete
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="mb-2 text-xs text-gray-600">
                      Alíquota de <strong>{normalizeTaxesPercent(Number(formData.taxesPercent))}%</strong> — somente administrador pode alterar (0%, 10%, 12% ou 18%).
                    </p>
                  )}
                  <input
                    type="text"
                    inputMode="decimal"
                    readOnly
                    value={formatCurrencyBR(
                      calculateTaxesValue(
                        parseCurrencyInput(formData.freightValue),
                        normalizeTaxesPercent(Number(formData.taxesPercent)),
                      ),
                    )}
                    className="w-full px-4 py-3 bg-slate-100 border border-gray-300 rounded-lg text-gray-700 focus:outline-none"
                    placeholder="Valor calculado"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Calculado automaticamente: {normalizeTaxesPercent(Number(formData.taxesPercent))}% do valor do frete.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Frete Líquido
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    readOnly
                    value={formatCurrencyBR(
                      calculateNetFreightValue(
                        parseCurrencyInput(formData.freightValue),
                        parseCurrencyInput(formData.driverValue),
                        normalizeTaxesPercent(Number(formData.taxesPercent)),
                      ),
                    )}
                    className="w-full px-4 py-3 bg-slate-100 border border-gray-300 rounded-lg text-gray-700 focus:outline-none"
                    placeholder="Valor do frete - tribultos - motorista"
                  />
                  <p className="mt-1 text-xs text-gray-500">Calculado automaticamente: frete - tribultos - motorista.</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Comissão
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    readOnly
                    value={formatCurrencyBR(
                      calculateCommissionValue(
                        calculateNetFreightValue(
                          parseCurrencyInput(formData.freightValue),
                          parseCurrencyInput(formData.driverValue),
                          normalizeTaxesPercent(Number(formData.taxesPercent)),
                        ),
                      ),
                    )}
                    className="w-full px-4 py-3 bg-slate-100 border border-gray-300 rounded-lg text-gray-700 focus:outline-none"
                    placeholder="30% do frete líquido"
                  />
                  <p className="mt-1 text-xs text-gray-500">Calculado automaticamente: 30% do frete líquido.</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Valor da NF
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formData.nfValue}
                    onChange={(e) => setFormData({ ...formData, nfValue: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                    placeholder="Ex: 12500,00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Observação
                </label>
                <textarea
                  rows={3}
                  value={formData.observation}
                  onChange={(e) => setFormData({ ...formData, observation: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800 resize-y"
                  placeholder="Informações adicionais do frete"
                />
              </div>

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
