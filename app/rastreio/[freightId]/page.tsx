'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Truck, Package, MapPin, Calendar, Navigation, RefreshCw, Clock, Camera } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import TrackingTimeline, { TimelineStep } from '@/components/transporteja/TrackingTimeline'
import { getRouteTrack, type RouteTrack } from '@/lib/services/location-tracking'

interface RouteData {
  id: string
  freight_id: number
  origin: string
  origin_state: string
  destination: string
  destination_state: string
  pickup_date: string
  estimated_delivery: string
  status: 'pending' | 'inTransit' | 'pickedUp' | 'delivered' | 'cancelled'
  vehicle?: string
  plate?: string
}

interface CheckInData {
  id: string
  type: 'pickup' | 'delivery'
  timestamp: string
  address?: string
  photo_url?: string
}

export default function PublicTrackingPage() {
  const params = useParams()
  const freightId = params?.freightId ? parseInt(params.freightId as string) : null
  
  const [routeData, setRouteData] = useState<RouteData | null>(null)
  const [checkIns, setCheckIns] = useState<CheckInData[]>([])
  const [routeTrack, setRouteTrack] = useState<RouteTrack[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [isAutoUpdating, setIsAutoUpdating] = useState(false)
  const [lastLocationPlace, setLastLocationPlace] = useState<{ city: string; state: string } | null>(null)
  const routeDataRef = useRef<RouteData | null>(null)

  // Atualizar ref quando routeData mudar
  useEffect(() => {
    routeDataRef.current = routeData
  }, [routeData])

  // Função para carregar dados de rastreamento
  const loadTrackingData = useCallback(async (isInitialLoad = false) => {
    if (!freightId) {
      setError('ID do frete não fornecido')
      setLoading(false)
      return
    }

    // Não mostrar loading se for atualização automática
    if (isInitialLoad) {
      setLoading(true)
    } else {
      setIsAutoUpdating(true)
    }

    try {
      const { data: routes, error: routeError } = await supabase
        .from('routes')
        .select('*')
        .eq('freight_id', freightId)
        .limit(1)

      if (routeError) throw routeError
      if (!routes?.length) {
        setError(`Frete #${freightId} não encontrado. Verifique se o ID está correto.`)
        setLoading(false)
        return
      }

      const route = routes[0]

      const [checkinsResult, trackResult] = await Promise.all([
        supabase
          .from('checkins')
          .select('id, type, timestamp, address, photo_url')
          .eq('freight_id', freightId)
          .order('timestamp', { ascending: true }),
        getRouteTrack(freightId).catch(() => [] as RouteTrack[])
      ])

      if (!checkinsResult.error) setCheckIns(checkinsResult.data || [])
      setRouteTrack(Array.isArray(trackResult) ? trackResult : [])
      setLastUpdate(new Date())

      if (isInitialLoad || !routeDataRef.current) {
        setRouteData({
          id: route.id,
          freight_id: route.freight_id,
          origin: route.origin,
          origin_state: route.origin_state,
          destination: route.destination,
          destination_state: route.destination_state,
          pickup_date: route.pickup_date,
          estimated_delivery: route.estimated_delivery,
          status: route.status,
          vehicle: route.vehicle,
          plate: route.plate
        })
      } else {
        setRouteData(prev => (prev ? { ...prev, status: route.status } : null))
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      const code = err && typeof err === 'object' && 'code' in err ? String((err as { code?: string }).code) : ''
      if (code === 'PGRST116') {
        setError(`Frete #${freightId} não encontrado. Verifique se o ID está correto.`)
      } else if (msg.includes('permission denied') || msg.includes('row-level security')) {
        setError('Erro de permissão. Verifique se as políticas RLS estão configuradas corretamente. Execute o script rastreio-publico-setup.sql no Supabase.')
      } else if (isInitialLoad) {
        setError(msg || 'Erro ao carregar informações do frete. Tente novamente mais tarde.')
      }
    } finally {
      setLoading(false)
      setIsAutoUpdating(false)
    }
  }, [freightId])

  // Carregar dados iniciais
  useEffect(() => {
    loadTrackingData(true)
  }, [loadTrackingData])

  // Atualização automática a cada 1 hora
  useEffect(() => {
    if (!freightId || error) return

    const interval = setInterval(() => {
      loadTrackingData(false)
    }, 3600000) // Atualizar a cada 1 hora

    return () => clearInterval(interval)
  }, [freightId, error, loadTrackingData])

  // Buscar cidade e estado da última localização (reverse geocoding)
  useEffect(() => {
    if (routeTrack.length === 0) {
      setLastLocationPlace(null)
      return
    }
    const last = routeTrack[routeTrack.length - 1]
    const lat = last.coords_lat
    const lng = last.coords_lng

    let cancelled = false
    fetch(`/api/geocode/reverse?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { city?: string; state?: string } | null) => {
        if (cancelled || !data) return
        setLastLocationPlace({
          city: data.city ?? 'Localização desconhecida',
          state: data.state ?? '',
        })
      })
      .catch(() => { /* ignora erro; cidade/estado ficam vazios */ })
    return () => { cancelled = true }
  }, [routeTrack])

  const calculateTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Hoje'
    if (diffDays === 1) return '1 dia'
    return `${diffDays} dias`
  }

  const getTimelineSteps = (): TimelineStep[] => {
    if (!routeData) return []

    const hasPickup = checkIns.some(ci => ci.type === 'pickup')
    const hasDelivery = checkIns.some(ci => ci.type === 'delivery')
    const pickupCheckIn = checkIns.find(ci => ci.type === 'pickup')
    const deliveryCheckIn = checkIns.find(ci => ci.type === 'delivery')

    const steps: TimelineStep[] = []

    // Etapa 1: Rota criada / Pendente
    steps.push({
      id: 'created',
      title: 'Rota criada',
      status: 'completed',
      date: routeData.pickup_date
    })

    // Etapa 2: Coleta agendada
    if (routeData.status === 'pending' || routeData.status === 'inTransit') {
      steps.push({
        id: 'pickup_scheduled',
        title: 'Coleta agendada',
        description: 'Aguardando coleta',
        status: hasPickup ? 'completed' : 'active',
        date: routeData.pickup_date,
        timeAgo: hasPickup ? calculateTimeAgo(pickupCheckIn!.timestamp) : undefined,
        waitingFor: hasPickup ? undefined : 'candidate'
      })
    } else {
      steps.push({
        id: 'pickup_scheduled',
        title: 'Coleta agendada',
        status: 'completed',
        date: pickupCheckIn?.timestamp || routeData.pickup_date
      })
    }

    // Etapa 3: Coleta realizada
    if (hasPickup) {
      steps.push({
        id: 'picked_up',
        title: 'Coleta realizada',
        description: pickupCheckIn?.address,
        status: 'completed',
        date: pickupCheckIn!.timestamp
      })
    } else if (routeData.status === 'pickedUp' || routeData.status === 'inTransit') {
      steps.push({
        id: 'picked_up',
        title: 'Coleta realizada',
        status: 'completed',
        date: routeData.pickup_date
      })
    }

    // Etapa 4: Em trânsito
    if (hasPickup && !hasDelivery) {
      steps.push({
        id: 'in_transit',
        title: 'Em trânsito',
        description: 'Mercadoria a caminho do destino',
        status: 'active',
        date: pickupCheckIn!.timestamp,
        timeAgo: calculateTimeAgo(pickupCheckIn!.timestamp),
        waitingFor: 'company'
      })
    } else if (hasDelivery) {
      steps.push({
        id: 'in_transit',
        title: 'Em trânsito',
        status: 'completed',
        date: pickupCheckIn?.timestamp || routeData.pickup_date
      })
    }

    // Etapa 5: Entrega agendada
    if (hasDelivery) {
      steps.push({
        id: 'delivery_scheduled',
        title: 'Entrega agendada',
        status: 'completed',
        date: routeData.estimated_delivery
      })
    } else if (hasPickup) {
      steps.push({
        id: 'delivery_scheduled',
        title: 'Entrega agendada',
        description: 'Aguardando entrega',
        status: 'active',
        date: routeData.estimated_delivery,
        waitingFor: 'company'
      })
    } else {
      steps.push({
        id: 'delivery_scheduled',
        title: 'Entrega agendada',
        status: 'pending',
        date: routeData.estimated_delivery
      })
    }

    // Etapa 6: Entrega realizada
    if (hasDelivery) {
      steps.push({
        id: 'delivered',
        title: 'Entrega realizada',
        description: deliveryCheckIn?.address,
        status: 'completed',
        date: deliveryCheckIn!.timestamp
      })
    } else {
      steps.push({
        id: 'delivered',
        title: 'Entrega realizada',
        status: 'pending',
        date: routeData.estimated_delivery
      })
    }

    return steps
  }

  const formatDateBR = (dateString: string) => {
    if (!dateString) return ''
    try {
      const date = new Date(dateString)
      const day = date.getDate().toString().padStart(2, '0')
      const month = (date.getMonth() + 1).toString().padStart(2, '0')
      const year = date.getFullYear()
      return `${day}/${month}/${year}`
    } catch {
      return dateString
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-slate-800 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando informações do frete...</p>
        </div>
      </div>
    )
  }

  if (error || !routeData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 max-w-md text-center">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Frete não encontrado</h1>
          <p className="text-gray-600">{error || 'O frete solicitado não foi encontrado.'}</p>
        </div>
      </div>
    )
  }

  const timelineSteps = getTimelineSteps()
  const activeStep = timelineSteps.find(step => step.status === 'active')
  const activeColor = activeStep?.waitingFor === 'candidate' ? 'purple' : 'orange'

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-slate-100 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-lg border border-gray-200 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-slate-800 rounded-lg flex items-center justify-center">
                <Truck className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Rastreamento de Encomenda</h1>
                <p className="text-sm text-gray-500">Frete #{routeData.freight_id}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 mb-1">Status</p>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                routeData.status === 'delivered' ? 'bg-green-100 text-green-700' :
                routeData.status === 'pickedUp' || routeData.status === 'inTransit' ? 'bg-blue-100 text-blue-700' :
                'bg-yellow-100 text-yellow-700'
              }`}>
                {routeData.status === 'delivered' ? 'Entregue' :
                 routeData.status === 'pickedUp' ? 'Coletado' :
                 routeData.status === 'inTransit' ? 'Em Trânsito' :
                 'Pendente'}
              </span>
            </div>
          </div>

          {/* Informações da Rota */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
              <MapPin className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500 mb-1">Origem</p>
                <p className="text-sm font-semibold text-gray-900">{routeData.origin}, {routeData.origin_state}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
              <MapPin className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500 mb-1">Destino</p>
                <p className="text-sm font-semibold text-gray-900">{routeData.destination}, {routeData.destination_state}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Timeline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <TrackingTimeline steps={timelineSteps} activeColor={activeColor} />
        </motion.div>

        {/* Comprovantes de coleta/entrega — quando há check-ins */}
        {checkIns.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="bg-white rounded-xl shadow-lg border border-gray-200 p-6"
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Comprovantes de coleta e entrega
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(['pickup', 'delivery'] as const).map((type) => {
                const ci = checkIns.find((c) => c.type === type)
                const label = type === 'pickup' ? 'Foto da Coleta' : 'Foto da Entrega'
                const icon = type === 'pickup' ? '📦' : '✅'
                if (!ci) {
                  return (
                    <div
                      key={type}
                      className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300"
                    >
                      <span className="text-2xl">{icon}</span>
                      <div>
                        <p className="text-sm font-medium text-gray-500">{label}</p>
                        <p className="text-xs text-gray-400">Ainda não registrada</p>
                      </div>
                    </div>
                  )
                }
                return ci.photo_url ? (
                  <a
                    key={type}
                    href={ci.photo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-4 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors group"
                  >
                    <Camera className="w-6 h-6 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{label}</p>
                      <p className="text-xs text-slate-300">
                        {new Date(ci.timestamp).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <Navigation className="w-4 h-4 flex-shrink-0 opacity-60 group-hover:opacity-100" />
                  </a>
                ) : (
                  <div
                    key={type}
                    className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <Camera className="w-6 h-6 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">{label}</p>
                      <p className="text-xs text-gray-400">Registrada em {new Date(ci.timestamp).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}

        {/* Rastreamento GPS — quando em trânsito ou após */}
        {(routeData.status === 'inTransit' || routeData.status === 'pickedUp' || routeData.status === 'delivered') && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white rounded-xl shadow-lg border border-gray-200 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Navigation className="w-5 h-5" />
                Rastreamento em tempo real
              </h2>
              <div className="flex items-center gap-2">
                {isAutoUpdating && (
                  <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
                )}
                {lastUpdate && (
                  <div className="flex flex-col items-end gap-0.5 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>Atualizado {lastUpdate.toLocaleTimeString('pt-BR')}</span>
                    </div>
                    <span className="text-gray-400">Atualização a cada 1 hora</span>
                  </div>
                )}
              </div>
            </div>

            {routeTrack.length > 0 ? (
              <div className="space-y-3">
                {/* Cidade e estado — destaque principal */}
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  {lastLocationPlace ? (
                    <>
                      <p className="text-xs font-semibold text-blue-700 mb-1 uppercase tracking-wide">Localização atual</p>
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin className="w-5 h-5 text-blue-600 flex-shrink-0" />
                        <span className="text-lg font-bold text-blue-900">
                          {lastLocationPlace.city}
                          {lastLocationPlace.state ? ` — ${lastLocationPlace.state}` : ''}
                        </span>
                      </div>
                      <p className="text-xs text-blue-600">
                        Registrado em {new Date(routeTrack[routeTrack.length - 1].timestamp).toLocaleString('pt-BR')}
                      </p>
                      {routeTrack[routeTrack.length - 1].speed != null && (
                        <p className="text-xs text-blue-500 mt-0.5">
                          Velocidade: {routeTrack[routeTrack.length - 1].speed!.toFixed(0)} km/h
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-blue-700">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Obtendo cidade e estado...</span>
                    </div>
                  )}
                </div>

                {/* Resumo de pontos + link Google Maps */}
                <div className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg text-xs text-gray-500">
                  <span>{routeTrack.length} pontos de rastreamento registrados</span>
                  {isAutoUpdating && <span className="text-blue-600">Atualizando...</span>}
                </div>

                <a
                  href={`https://www.google.com/maps/dir/${routeTrack.map(p => `${p.coords_lat},${p.coords_lng}`).join('/')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                >
                  <Navigation className="w-4 h-4" />
                  Ver Trajeto no Google Maps
                </a>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                  <Navigation className="w-5 h-5 text-gray-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Rastreamento GPS ainda não iniciado</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Quando o rastreio GPS for iniciado, a cidade e o estado aparecerão aqui e serão atualizados a cada 1 hora.
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Datas Importantes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-xl shadow-lg border border-gray-200 p-6"
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Datas Importantes
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Data de Coleta</p>
              <p className="text-sm font-semibold text-gray-900">{formatDateBR(routeData.pickup_date)}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Previsão de Entrega</p>
              <p className="text-sm font-semibold text-gray-900">{formatDateBR(routeData.estimated_delivery)}</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

