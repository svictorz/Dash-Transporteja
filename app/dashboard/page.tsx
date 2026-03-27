'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import FadeIn from '@/components/animations/FadeIn'
import {
  Truck,
  CheckCircle2,
  MapPin,
  ArrowUpRight,
  RefreshCw,
  AlertTriangle,
  Route as RouteIcon,
  ArrowRight,
  Loader2
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRoutes } from '@/lib/hooks/useRoutes'
import { useDrivers } from '@/lib/hooks/useDrivers'
import { supabase } from '@/lib/supabase/client'


interface Alert {
  id: string
  type: 'warning' | 'info' | 'success' | 'error'
  title: string
  message: string
  time: string
}

interface RoutePreview {
  id: string
  freightId: number
  driver: string
  driverCNH: string
  driverPhone: string
  origin: string
  originState: string
  destination: string
  destinationState: string
  vehicle: string
  plate: string
  weight: string
  estimatedDelivery: string
  pickupDate: string
  status: 'pending' | 'inTransit' | 'pickedUp' | 'delivered'
}

export default function DashboardPage() {
  const router = useRouter()
  const { routes, loading: routesLoading } = useRoutes()
  const { drivers, loading: driversLoading } = useDrivers()
  
  const [mounted, setMounted] = useState(false)
  const [checkIns, setCheckIns] = useState<any[]>([])
  
  const [checkInStats, setCheckInStats] = useState({
    today: 0,
    week: 0,
    month: 0,
    total: 0,
    pickup: 0,
    delivery: 0
  })

  const isLoadingCheckInsRef = useRef(false)

  // Carregar check-ins do Supabase (reutilizado no Realtime)
  const loadCheckIns = useCallback(async () => {
    if (isLoadingCheckInsRef.current) return
    isLoadingCheckInsRef.current = true
    try {
      const { data, error } = await supabase
        .from('checkins')
        .select('*')
        .order('timestamp', { ascending: false })
      if (error) throw error
      setCheckIns(data || [])
    } catch (err) {
      console.error('Erro ao carregar check-ins:', err)
      setCheckIns([])
    } finally {
      isLoadingCheckInsRef.current = false
    }
  }, [])

  // Carregar check-ins na montagem
  useEffect(() => {
    loadCheckIns()
  }, [loadCheckIns])

  // Realtime: atualizar check-ins quando o app motorista ou outro cliente inserir/alterar
  useEffect(() => {
    const channel = supabase
      .channel('checkins-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'checkins' },
        () => {
          loadCheckIns()
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadCheckIns])

  // Calcular estatísticas de check-ins
  useEffect(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

    const todayCount = checkIns.filter(item => {
      const itemDate = new Date(item.timestamp)
      return itemDate >= today
    }).length

    const weekCount = checkIns.filter(item => {
      const itemDate = new Date(item.timestamp)
      return itemDate >= weekAgo
    }).length

    const monthCount = checkIns.filter(item => {
      const itemDate = new Date(item.timestamp)
      return itemDate >= monthAgo
    }).length

    const pickupCount = checkIns.filter(item => item.type === 'pickup').length
    const deliveryCount = checkIns.filter(item => item.type === 'delivery').length

    setCheckInStats({
      today: todayCount,
      week: weekCount,
      month: monthCount,
      total: checkIns.length,
      pickup: pickupCount,
      delivery: deliveryCount
    })
  }, [checkIns])

  // Calcular estatísticas de motoristas
  const driverStats = useMemo(() => {
    const active = drivers.filter(d => d.status === 'active').length
    const onRoute = drivers.filter(d => d.status === 'onRoute').length
    const inactive = drivers.filter(d => d.status === 'inactive').length
    const available = active - onRoute

    return {
      active,
      total: drivers.length,
      onRoute,
      available: Math.max(0, available),
      inactive
    }
  }, [drivers])

  // Calcular estatísticas de rotas
  const routeStats = useMemo(() => {
    const active = routes.filter(r => r.status === 'inTransit' || r.status === 'pickedUp').length
    const completed = routes.filter(r => r.status === 'delivered').length
    const pending = routes.filter(r => r.status === 'pending').length
    const cancelled = routes.filter(r => r.status === 'cancelled').length

    return {
      active,
      completed,
      pending,
      delayed: 0, // TODO: Implementar cálculo de atrasos
      avgDeliveryTime: 'N/A', // TODO: Implementar cálculo
      successRate: completed > 0 ? (completed / (completed + cancelled) * 100) : 0
    }
  }, [routes])

  // Função para formatar data
  const formatDateBR = (dateString: string) => {
    if (!dateString) return ''
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

  // Rotas recentes (últimas 5)
  const recentRoutes = useMemo(() => {
    return routes
      .slice(0, 5)
      .map(route => {
        const driver = drivers.find(d => d.id === route.driver_id)
        return {
          id: route.id,
          freightId: route.freight_id,
          driver: driver?.name || 'N/A',
          driverCNH: driver ? `CNH: ${driver.cnh}` : 'N/A',
          driverPhone: driver?.phone || 'N/A',
          origin: route.origin,
          originState: route.origin_state,
          destination: route.destination,
          destinationState: route.destination_state,
          vehicle: route.vehicle,
          plate: route.plate,
          weight: route.weight,
          estimatedDelivery: formatDateBR(route.estimated_delivery),
          pickupDate: formatDateBR(route.pickup_date),
          status: route.status
        } as RoutePreview
      })
  }, [routes, drivers])

  // Alertas (mockados por enquanto - pode ser implementado depois)
  const alerts: Alert[] = []

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'inTransit':
        return {
          label: 'Em Trânsito',
          dotColor: 'bg-orange-500'
        }
      case 'delivered':
        return {
          label: 'Entregue',
          dotColor: 'bg-green-500'
        }
      case 'pickedUp':
        return {
          label: 'Coletado',
          dotColor: 'bg-gray-500'
        }
      case 'pending':
        return {
          label: 'Pendente',
          dotColor: 'bg-yellow-500'
        }
      default:
        return {
          label: 'Desconhecido',
          dotColor: 'bg-gray-500'
        }
    }
  }

  useEffect(() => {
    setMounted(true)
  }, [])
  
  // Inicializar loading como false após montagem
  const isLoading = !mounted

  // Mostrar loading apenas na primeira carga
  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-slate-800" />
          <p className="text-gray-600">Carregando dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header com Filtros */}
      <FadeIn delay={0.1}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">Visão geral das operações em tempo real</p>
            </div>
            <div className="flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.05, rotate: 180 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 glass-card rounded-xl border border-white/30 backdrop-blur-sm hover:bg-white/90 transition-colors"
                title="Atualizar dados"
              >
                <RefreshCw className="w-5 h-5 text-gray-600" />
              </motion.button>
            </div>
          </div>

        </div>
      </FadeIn>

      {/* Alertas Importantes */}
      {alerts.length > 0 && (
        <FadeIn delay={0.15}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {alerts.map((alert, index) => (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.1 }}
                className={`glass-card rounded-xl p-4 border border-white/30 backdrop-blur-xl ${
                  alert.type === 'warning' ? 'border-yellow-300/50' :
                  alert.type === 'error' ? 'border-red-300/50' :
                  alert.type === 'success' ? 'border-green-300/50' :
                  'border-blue-300/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    alert.type === 'warning' ? 'bg-yellow-100' :
                    alert.type === 'error' ? 'bg-red-100' :
                    alert.type === 'success' ? 'bg-green-100' :
                    'bg-blue-100'
                  }`}>
                    {alert.type === 'warning' || alert.type === 'error' ? (
                      <AlertTriangle className={`w-5 h-5 ${
                        alert.type === 'warning' ? 'text-yellow-600' :
                        alert.type === 'error' ? 'text-red-600' :
                        'text-gray-600'
                      }`} />
                    ) : (
                      <CheckCircle2 className={`w-5 h-5 ${
                        alert.type === 'success' ? 'text-green-600' :
                        'text-blue-600'
                      }`} />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 text-sm">{alert.title}</h3>
                    <p className="text-xs text-gray-600 mt-1">{alert.message}</p>
                    <p className="text-xs text-gray-400 mt-1">{alert.time}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </FadeIn>
      )}

      {/* KPIs Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <FadeIn delay={0.2} direction="up">
          <motion.div
            whileHover={{ scale: 1.02, y: -2 }}
            className="glass-card rounded-xl p-6 border border-white/30 backdrop-blur-xl"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <RouteIcon className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex items-center gap-1 text-green-600">
                <ArrowUpRight className="w-4 h-4" />
                <span className="text-xs font-semibold">+12%</span>
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">{routeStats.active}</div>
            <div className="text-sm text-gray-600">Rotas Ativas</div>
            <div className="text-xs text-gray-500 mt-2">de {routeStats.active + routeStats.pending} total</div>
          </motion.div>
        </FadeIn>

        <FadeIn delay={0.25} direction="up">
          <motion.div
            whileHover={{ scale: 1.02, y: -2 }}
            className="glass-card rounded-xl p-6 border border-white/30 backdrop-blur-xl"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <div className="flex items-center gap-1 text-green-600">
                <ArrowUpRight className="w-4 h-4" />
                <span className="text-xs font-semibold">+5.2%</span>
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">{checkInStats.today}</div>
            <div className="text-sm text-gray-600">Check-ins Hoje</div>
            <div className="text-xs text-gray-500 mt-2">{checkInStats.pickup} coletas • {checkInStats.delivery} entregas</div>
          </motion.div>
        </FadeIn>

        <FadeIn delay={0.3} direction="up">
          <motion.div
            whileHover={{ scale: 1.02, y: -2 }}
            className="glass-card rounded-xl p-6 border border-white/30 backdrop-blur-xl"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Truck className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex items-center gap-1 text-green-600">
                <ArrowUpRight className="w-4 h-4" />
                <span className="text-xs font-semibold">+8%</span>
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">{driverStats.onRoute}</div>
            <div className="text-sm text-gray-600">Motoristas em Rota</div>
            <div className="text-xs text-gray-500 mt-2">{driverStats.available} disponíveis</div>
          </motion.div>
        </FadeIn>

      </div>

      {/* Preview de Rotas - Estilo Referência */}
      <FadeIn delay={0.6}>
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-900">Fretes</h2>
              <span className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">
                {recentRoutes.length}
              </span>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => router.push('/dashboard/rotas')}
              className="text-sm text-gray-600 hover:text-gray-900 font-medium"
            >
              Ver todos →
            </motion.button>
          </div>

          {/* Tabela Preview */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {recentRoutes.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <RouteIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Nenhuma rota cadastrada</p>
                <button
                  onClick={() => router.push('/dashboard/rotas')}
                  className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors font-medium"
                >
                  Criar primeira rota
                </button>
              </div>
            ) : (
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
                    {recentRoutes.map((route, index) => {
                    const statusDisplay = getStatusDisplay(route.status)
                    return (
                      <motion.tr
                        key={route.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.65 + index * 0.05 }}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-gray-900">
                            #{route.freightId}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-sm text-gray-900">{route.driver}</span>
                            <span className="text-xs text-gray-500 mt-1">{route.driverCNH}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-gray-600" />
                                <span className="text-sm text-gray-900">
                                  {route.origin}, {route.originState}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <ArrowRight className="w-4 h-4 text-gray-400" />
                                <MapPin className="w-4 h-4 text-gray-600" />
                                <span className="text-sm text-gray-900">
                                  {route.destination}, {route.destinationState}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-sm text-gray-900">{route.vehicle}</span>
                            <span className="text-xs text-gray-500 mt-1">{route.plate} • {route.weight}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-sm text-gray-900">{route.estimatedDelivery}</span>
                            <span className="text-xs text-gray-500 mt-1">Coletado: {route.pickupDate}</span>
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
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => router.push('/dashboard/rotas')}
                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                          >
                            Ver mais
                          </motion.button>
                        </td>
                      </motion.tr>
                    )
                  })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </FadeIn>

    </div>
  )
}
