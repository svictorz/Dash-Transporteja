'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { Route, MapPin, ArrowRight, X, Truck, User, Calendar, Building2, Phone, Mail, Plus, Edit, Trash2, Loader2, Camera, CheckCircle2, RefreshCw, Upload, Eye } from 'lucide-react'
import { useRoutes } from '@/lib/hooks/useRoutes'
import { useDrivers } from '@/lib/hooks/useDrivers'
import { useClients } from '@/lib/hooks/useClients'
import { Route as RouteType, CreateRouteData } from '@/lib/services/routes'
import { Driver } from '@/lib/services/drivers'
import { Client } from '@/lib/services/clients'
import CEPInput from '@/components/transporteja/CEPInput'
import { CEPData } from '@/lib/services/cep'
import { supabase } from '@/lib/supabase/client'
import { generateFreightCode } from '@/lib/utils/freight-code'
import { useAuthState } from '@/lib/hooks/useAuthState'
import { canCreateRoute } from '@/lib/services/credits'
import { useDebouncedRouteDistance } from '@/lib/hooks/useDebouncedRouteDistance'

// Interface para exibição (com dados do motorista e cliente)
interface RouteDisplayData extends RouteType {
  driver?: Driver
  client?: Client
}

interface CheckInRecord {
  id: string
  type: 'pickup' | 'delivery'
  timestamp: string
  photo_url: string
  coords_lat: number
  coords_lng: number
  address?: string
}

type DocumentKey =
  | 'driverDocs'
  | 'freteDocs'

const EMPTY_DOCUMENT_URLS: Record<DocumentKey, string | null> = {
  driverDocs: null,
  freteDocs: null,
}

export default function RotasPage() {
  const { session } = useAuthState()
  const { routes, loading: routesLoading, error: routesError, createRoute, updateRoute, deleteRoute } = useRoutes()
  const { drivers, loading: driversLoading } = useDrivers()
  const { clients, loading: clientsLoading } = useClients()
  
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'inTransit' | 'pickedUp' | 'delivered' | 'cancelled'>('all')
  const [selectedRoute, setSelectedRoute] = useState<RouteDisplayData | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingRoute, setEditingRoute] = useState<RouteType | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [checkIns, setCheckIns] = useState<CheckInRecord[]>([])
  const [loadingCheckIns, setLoadingCheckIns] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)
  const [documentUrls, setDocumentUrls] = useState<Record<DocumentKey, string | null>>(EMPTY_DOCUMENT_URLS)
  const [uploadingDocument, setUploadingDocument] = useState<DocumentKey | null>(null)
  
  // Estados para seleção de motorista e empresa
  const [companyInput, setCompanyInput] = useState('')
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null)
  const [selectedCompany, setSelectedCompany] = useState<Client | null>(null)
  
  // Estado do formulário
  const [formData, setFormData] = useState({
    origin: '',
    originState: '',
    originAddress: '',
    destination: '',
    destinationState: '',
    destinationAddress: '',
    weight: '',
    nfValue: '',
    observation: '',
    estimatedDelivery: '',
    pickupDate: ''
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

  // Combinar rotas com dados de motoristas e clientes
  const routesWithDetails = useMemo(() => {
    return routes.map(route => {
      const driver = drivers.find(d => d.id === route.driver_id)
      const client = clients.find(c => 
        c.company_name === route.company_name || 
        (route.company_email && c.email === route.company_email)
      )
      
      return {
        ...route,
        driver,
        client
      } as RouteDisplayData
    })
  }, [routes, drivers, clients])

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
          dotColor: 'bg-orange-500',
          bgColor: 'bg-orange-100',
          textColor: 'text-orange-700'
        }
      case 'delivered':
        return {
          label: 'Entregue',
          dotColor: 'bg-green-500',
          bgColor: 'bg-green-100',
          textColor: 'text-green-700'
        }
      case 'pickedUp':
        return {
          label: 'Coletado',
          dotColor: 'bg-gray-500',
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-700'
        }
      case 'pending':
        return {
          label: 'Pendente',
          dotColor: 'bg-yellow-500',
          bgColor: 'bg-yellow-100',
          textColor: 'text-yellow-700'
        }
      default:
        return {
          label: 'Desconhecido',
          dotColor: 'bg-gray-500',
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-700'
        }
    }
  }

  const selectedRouteRef = useRef(selectedRoute)
  useEffect(() => {
    selectedRouteRef.current = selectedRoute
  }, [selectedRoute])

  const syncPhotosFromStorage = useCallback(async (route: RouteDisplayData) => {
    if (!route.id || !route.freight_id || !route.driver_id) return
    try {
      await fetch('/api/admin/sync-photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          route_id: route.id,
          freight_id: route.freight_id,
          driver_id: route.driver_id
        })
      })
    } catch { /* silent */ }
  }, [])

  const fetchCheckInsForRoute = useCallback(async (route: RouteDisplayData) => {
    try {
      await syncPhotosFromStorage(route)

      const freightId = route.freight_id
      const driverId = route.driver_id

      if (!driverId) {
        const { data } = await supabase
          .from('checkins')
          .select('id, type, timestamp, photo_url, coords_lat, coords_lng, address')
          .eq('freight_id', freightId)
          .order('timestamp', { ascending: false })
        setCheckIns(data || [])
        return
      }

      const [ciResult, routesResult] = await Promise.all([
        supabase
          .from('checkins')
          .select('id, type, timestamp, photo_url, coords_lat, coords_lng, address, freight_id, route_id')
          .eq('driver_id', driverId)
          .order('timestamp', { ascending: false }),
        supabase
          .from('routes')
          .select('id, freight_id, created_at')
          .eq('driver_id', driverId)
          .order('created_at', { ascending: true })
      ])

      const allCheckins = ciResult.data || []
      const allRoutes = routesResult.data || []

      if (allRoutes.length === 0) {
        setCheckIns([])
        return
      }

      const routeTimestamps = allRoutes.map(r => ({
        ...r,
        createdMs: new Date(r.created_at).getTime()
      }))

      const toFix: { id: string; correctFreightId: number | null; correctRouteId: string | null }[] = []
      const myCheckins: typeof allCheckins = []

      for (const ci of allCheckins) {
        const ciTime = new Date(ci.timestamp).getTime()

        let bestRoute: typeof routeTimestamps[number] | null = null
        for (const rt of routeTimestamps) {
          if (rt.createdMs <= ciTime) {
            bestRoute = rt
          } else {
            break
          }
        }

        const correctFreightId = bestRoute ? bestRoute.freight_id : null
        const correctRouteId = bestRoute ? bestRoute.id : null

        if (ci.freight_id !== correctFreightId || ci.route_id !== correctRouteId) {
          toFix.push({ id: ci.id, correctFreightId, correctRouteId })
        }

        if (correctFreightId === freightId) {
          myCheckins.push(ci)
        }
      }

      if (toFix.length > 0) {
        try {
          await fetch('/api/admin/fix-checkins', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fixes: toFix })
          })
        } catch { /* silent */ }
      }

      myCheckins.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      setCheckIns(myCheckins)
    } catch {
      setCheckIns([])
    }
  }, [syncPhotosFromStorage])

  const handleViewMore = async (route: RouteDisplayData) => {
    setSelectedRoute(route)
    setDocumentUrls(EMPTY_DOCUMENT_URLS)
    setUploadingDocument(null)
    setLoadingCheckIns(true)
    try {
      await fetchCheckInsForRoute(route)
    } finally {
      setLoadingCheckIns(false)
    }
  }

  // Realtime: atualizar check-ins do frete selecionado quando houver novos ou alterações
  useEffect(() => {
    const channel = supabase
      .channel('rotas-checkins-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'checkins' },
        () => {
          const route = selectedRouteRef.current
          if (route) {
            fetchCheckInsForRoute(route)
          }
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchCheckInsForRoute])

  const handleOpenEdit = (route: RouteDisplayData) => {
    setEditingRoute(route)
    // Buscar motorista e cliente relacionados
    const driver = drivers.find(d => d.id === route.driver_id)
    const client = clients.find(c => 
      c.company_name === route.company_name || 
      (route.company_email && c.email === route.company_email)
    )
    setSelectedDriver(driver || null)
    setSelectedCompany(client || null)
    setCompanyInput(client?.company_name || '')
    setFormData({
      origin: route.origin,
      originState: route.origin_state,
      originAddress: route.origin_address || '',
      destination: route.destination,
      destinationState: route.destination_state,
      destinationAddress: route.destination_address || '',
      weight: route.weight,
      nfValue: route.nf_value != null ? String(route.nf_value).replace('.', ',') : '',
      observation: route.observation || '',
      estimatedDelivery: route.estimated_delivery,
      pickupDate: route.pickup_date
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
    setCheckIns([])
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

  const handleCreateRoute = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const driverToUse = selectedDriver ?? drivers[0] ?? null
    if (!driverToUse || !selectedCompany) {
      alert('Por favor, selecione uma empresa e tenha ao menos um motorista cadastrado')
      return
    }

    if (session?.user?.id) {
      const { ok, error: creditsError } = await canCreateRoute(session.user.id)
      if (!ok && creditsError) {
        alert(creditsError)
        return
      }
    }

    setIsSubmitting(true)

    try {
      const routeData: CreateRouteData = {
        freight_id: generateFreightCode(),
        driver_id: driverToUse.id,
      origin: formData.origin,
        origin_state: formData.originState,
        origin_address: formData.originAddress || undefined,
      destination: formData.destination,
        destination_state: formData.destinationState,
        destination_address: formData.destinationAddress || undefined,
      vehicle: driverToUse.vehicle,
      plate: driverToUse.plate,
      weight: formData.weight,
      nf_value: formData.nfValue.trim() ? parseFloat(formData.nfValue.replace(',', '.')) : null,
      observation: formData.observation.trim() || null,
        estimated_delivery: formData.estimatedDelivery,
        pickup_date: formData.pickupDate,
        status: 'pending',
        company_name: selectedCompany.company_name,
        company_responsible: selectedCompany.responsible,
        company_phone: selectedCompany.whatsapp,
        company_email: selectedCompany.email,
        company_address: selectedCompany.address,
        company_city: selectedCompany.city,
        company_state: selectedCompany.state,
        distance_km:
          routeDistance.distanciaKm ??
          null,
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
    
    const driverToUse =
      selectedDriver ??
      drivers.find((d) => d.id === editingRoute?.driver_id) ??
      null
    if (!editingRoute || !driverToUse || !selectedCompany) {
      alert('Por favor, selecione uma empresa e mantenha um motorista válido no frete')
      return
    }

    setIsSubmitting(true)

    try {
      await updateRoute(editingRoute.id, {
        driver_id: driverToUse.id,
        origin: formData.origin,
        origin_state: formData.originState,
        origin_address: formData.originAddress || null,
        destination: formData.destination,
        destination_state: formData.destinationState,
        destination_address: formData.destinationAddress || null,
        vehicle: driverToUse.vehicle,
        plate: driverToUse.plate,
        weight: formData.weight,
        nf_value: formData.nfValue.trim() ? parseFloat(formData.nfValue.replace(',', '.')) : null,
        observation: formData.observation.trim() || null,
        estimated_delivery: formData.estimatedDelivery,
        pickup_date: formData.pickupDate,
        status: editingRoute.status,
        company_name: selectedCompany.company_name,
        company_responsible: selectedCompany.responsible,
        company_phone: selectedCompany.whatsapp,
        company_email: selectedCompany.email,
        company_address: selectedCompany.address,
        company_city: selectedCompany.city,
        company_state: selectedCompany.state,
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
    setSelectedDriver(null)
    setSelectedCompany(null)
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
      weight: '',
      nfValue: '',
      observation: '',
      estimatedDelivery: '',
      pickupDate: ''
    })
  }

  const handleCloseEditModal = () => {
    setShowEditModal(false)
    setEditingRoute(null)
    setSelectedDriver(null)
    setSelectedCompany(null)
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
      weight: '',
      nfValue: '',
      observation: '',
      estimatedDelivery: '',
      pickupDate: ''
    })
  }

  return (
    <div className="space-y-6">
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

      {/* Tabela - Estilo Referência Limpo */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  ID do Frete
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Atribuído a
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Rota
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Km
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
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRoutes.map((route) => {
                const statusDisplay = getStatusDisplay(route.status)
                return (
                  <tr
                    key={route.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">
                        #{route.freight_id}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm text-gray-900">{route.driver?.name || 'N/A'}</span>
                        <span className="text-xs text-gray-500 mt-1">CNH: {route.driver?.cnh || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-gray-600" />
                            <span className="text-sm text-gray-900">
                              {route.origin}, {route.origin_state}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <ArrowRight className="w-4 h-4 text-gray-400" />
                            <MapPin className="w-4 h-4 text-gray-600" />
                            <span className="text-sm text-gray-900">
                              {route.destination}, {route.destination_state}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900 tabular-nums">
                        {route.distance_km != null && route.distance_km > 0
                          ? `${route.distance_km} km`
                          : '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm text-gray-900">{route.vehicle}</span>
                        <span className="text-xs text-gray-500 mt-1">{route.plate} • {route.weight}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm text-gray-900">{formatDateBR(route.estimated_delivery)}</span>
                        <span className="text-xs text-gray-500 mt-1">Coletado: {formatDateBR(route.pickup_date)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${statusDisplay.dotColor}`}></div>
                        <span className="text-sm text-gray-900">
                          {statusDisplay.label}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleViewMore(route)}
                          className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                      >
                        Ver mais
                      </motion.button>
                        <button
                          onClick={() => handleOpenEdit(route)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteRoute(route.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
      {(routesLoading || driversLoading || clientsLoading) && (
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

      {!routesLoading && !driversLoading && !clientsLoading && filteredRoutes.length === 0 && (
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
              {/* Informações do Motorista */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Motorista
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Nome</p>
                    <p className="text-sm font-medium text-gray-900">{selectedRoute.driver?.name || 'N/A'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">CNH</p>
                    <p className="text-sm font-medium text-gray-900">CNH: {selectedRoute.driver?.cnh || 'N/A'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Telefone</p>
                    <p className="text-sm font-medium text-gray-900">{selectedRoute.driver?.phone || 'N/A'}</p>
                  </div>
                </div>
              </div>

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
                  <div className="bg-gray-50 rounded-lg p-4 md:col-span-2">
                    <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      Endereço
                    </p>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedRoute.client?.address || selectedRoute.company_address || 'N/A'}, {selectedRoute.client?.city || selectedRoute.company_city || ''} - {selectedRoute.client?.state || selectedRoute.company_state || ''}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Valor da NF</p>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedRoute.nf_value != null
                        ? `R$ ${selectedRoute.nf_value.toFixed(2).replace('.', ',')}`
                        : '—'}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Observação</p>
                    <p className="text-sm font-medium text-gray-900 whitespace-pre-wrap">
                      {selectedRoute.observation || '—'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Documentação do Motorista e do Frete */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                    <User className="w-5 h-5" />
                    Informações do Motorista
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-xs text-gray-700 font-semibold uppercase tracking-wide mb-1">
                      Adicione fotos / documentos
                    </p>
                    <p className="text-sm text-gray-600 mb-3">
                      CNH, documento pessoal e CRLV do motorista.
                    </p>
                    <input
                      id="upload-driver-docs"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleUploadDocument('driverDocs', e.target.files?.[0] ?? null)}
                    />
                    <div className="flex gap-2">
                      <label
                        htmlFor="upload-driver-docs"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 cursor-pointer"
                      >
                        {uploadingDocument === 'driverDocs' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        Adicionar
                      </label>
                      {documentUrls.driverDocs && (
                        <button
                          type="button"
                          onClick={() => setSelectedPhoto(documentUrls.driverDocs)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 text-white rounded-lg hover:bg-slate-700"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Ver
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <Truck className="w-5 h-5" />
                      Informações do Frete
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Frete #{selectedRoute.freight_id}</span>
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setLoadingCheckIns(true)
                          fetchCheckInsForRoute(selectedRoute).finally(() => setLoadingCheckIns(false))
                        }}
                        disabled={loadingCheckIns}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                      >
                        <RefreshCw className={`w-4 h-4 ${loadingCheckIns ? 'animate-spin' : ''}`} />
                        Atualizar comprovantes
                      </motion.button>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 mb-4">
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

                  {loadingCheckIns ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                      <span className="ml-2 text-sm text-gray-500">Carregando comprovantes...</span>
                    </div>
                  ) : (
                    <>
                      {/* Botões de acesso rápido às fotos de comprovante operacional */}
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        {(['pickup', 'delivery'] as const).map((type) => {
                          const ci = checkIns.find((c) => c.type === type)
                          const label = type === 'pickup' ? 'Comprovante de Coleta' : 'Comprovante de Entrega'
                          const colorClass = type === 'pickup'
                            ? 'bg-blue-600 hover:bg-blue-700'
                            : 'bg-green-600 hover:bg-green-700'
                          return ci?.photo_url ? (
                            <motion.button
                              key={type}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => setSelectedPhoto(ci.photo_url)}
                              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-white font-medium text-sm transition-colors ${colorClass}`}
                            >
                              <Camera className="w-4 h-4" />
                              {label}
                            </motion.button>
                          ) : null
                        })}
                      </div>

                      {/* Cards detalhados com miniatura */}
                      {checkIns.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {checkIns.map((checkIn) => {
                            const { date, time } = formatDate(checkIn.timestamp)
                            return (
                              <motion.div
                                key={checkIn.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-gray-300 transition-colors cursor-pointer"
                                onClick={() => setSelectedPhoto(checkIn.photo_url)}
                              >
                                <div className="flex items-start gap-3">
                                  <div className="flex-shrink-0">
                                    <img
                                      src={checkIn.photo_url}
                                      alt={checkIn.type === 'pickup' ? 'Comprovante de coleta' : 'Comprovante de entrega'}
                                      className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement
                                        target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3ESem imagem%3C/text%3E%3C/svg%3E'
                                      }}
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                        checkIn.type === 'pickup'
                                          ? 'bg-blue-100 text-blue-700'
                                          : 'bg-green-100 text-green-700'
                                      }`}>
                                        {checkIn.type === 'pickup' ? 'Coleta' : 'Entrega'}
                                      </span>
                                      <CheckCircle2 className="w-4 h-4 text-gray-400" />
                                    </div>
                                    <p className="text-xs text-gray-500 mb-1">{date} às {time}</p>
                                    {checkIn.address && (
                                      <p className="text-xs text-gray-600 truncate flex items-start gap-1">
                                        <MapPin className="w-3 h-3 flex-shrink-0 mt-0.5" />
                                        {checkIn.address}
                                      </p>
                                    )}
                                    <p className="text-xs text-gray-400 mt-1">Clique para ampliar</p>
                                  </div>
                                </div>
                              </motion.div>
                            )
                          })}
                        </div>
                      )}
                    </>
                  )}
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

            <form onSubmit={handleCreateRoute} className="p-6 space-y-6">
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
                    const v = e.target.value
                    setCompanyInput(v)
                    setSelectedCompany(findCompanyByInput(v))
                  }}
                  onBlur={() => setSelectedCompany(findCompanyByInput(companyInput))}
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
                  {selectedCompany
                    ? `${selectedCompany.company_name} • ${selectedCompany.responsible}`
                    : 'Digite para preencher manualmente e vincular ao cadastro'}
                </p>
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
                  required
                  label="CEP de Origem * (Comece digitando o CEP para preencher automaticamente)"
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
                      placeholder="Cidade (preenchida automaticamente ao buscar CEP)"
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
                    placeholder="Rua, número, complemento (preenchido automaticamente ao buscar CEP)"
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
                  required
                  label="CEP de Destino * (Comece digitando o CEP para preencher automaticamente)"
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
                      placeholder="Cidade (preenchida automaticamente ao buscar CEP)"
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
                    placeholder="Rua, número, complemento (preenchido automaticamente ao buscar CEP)"
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
                    Data de Coleta <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.pickupDate}
                    onChange={(e) => setFormData({ ...formData, pickupDate: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Previsão de Entrega <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.estimatedDelivery}
                    onChange={(e) => setFormData({ ...formData, estimatedDelivery: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <motion.button
                  type="submit"
                  disabled={isSubmitting}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
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
                </motion.button>
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

            <form onSubmit={handleUpdateRoute} className="p-6 space-y-6">
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
                    const v = e.target.value
                    setCompanyInput(v)
                    setSelectedCompany(findCompanyByInput(v))
                  }}
                  onBlur={() => setSelectedCompany(findCompanyByInput(companyInput))}
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
                  {selectedCompany
                    ? `${selectedCompany.company_name} • ${selectedCompany.responsible}`
                    : 'Digite para preencher manualmente e vincular ao cadastro'}
                </p>
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
                  required
                  label="CEP de Origem * (Comece digitando o CEP para preencher automaticamente)"
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
                      placeholder="Cidade (preenchida automaticamente ao buscar CEP)"
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
                    placeholder="Rua, número, complemento (preenchido automaticamente ao buscar CEP)"
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
                  required
                  label="CEP de Destino * (Comece digitando o CEP para preencher automaticamente)"
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
                      placeholder="Cidade (preenchida automaticamente ao buscar CEP)"
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
                    placeholder="Rua, número, complemento (preenchido automaticamente ao buscar CEP)"
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
                    Data de Coleta <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.pickupDate}
                    onChange={(e) => setFormData({ ...formData, pickupDate: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Previsão de Entrega <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.estimatedDelivery}
                    onChange={(e) => setFormData({ ...formData, estimatedDelivery: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Status <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={editingRoute.status}
                  onChange={(e) => setEditingRoute({ ...editingRoute, status: e.target.value as any })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                >
                  <option value="pending">Pendente</option>
                  <option value="inTransit">Em Trânsito</option>
                  <option value="pickedUp">Coletado</option>
                  <option value="delivered">Entregue</option>
                  <option value="cancelled">Cancelado</option>
                </select>
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
                <motion.button
                  type="submit"
                  disabled={isSubmitting}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
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
                </motion.button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  )
}
