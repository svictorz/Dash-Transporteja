'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import FadeIn from '@/components/animations/FadeIn'
import {
  Truck,
  CheckCircle2,
  MapPin,
  DollarSign,
  ArrowUpRight,
  RefreshCw,
  AlertTriangle,
  Route as RouteIcon,
  ArrowRight
} from 'lucide-react'
import { useRouter } from 'next/navigation'


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
  const [mounted, setMounted] = useState(false)
  const [checkInStats, setCheckInStats] = useState({
    today: 0,
    week: 0,
    month: 0,
    total: 0,
    pickup: 0,
    delivery: 0
  })
  const [driverStats, setDriverStats] = useState({
    active: 12,
    total: 15,
    onRoute: 8,
    available: 4,
    inactive: 3
  })
  const [routeStats, setRouteStats] = useState({
    active: 8,
    completed: 24,
    pending: 3,
    delayed: 2,
    totalRevenue: 446700,
    avgDeliveryTime: '4h 32m',
    successRate: 94.5
  })

  const alerts: Alert[] = [
    {
      id: '1',
      type: 'warning',
      title: 'Rota com Atraso',
      message: 'Frete #1030 está 15 minutos atrasado',
      time: '5 min atrás'
    },
    {
      id: '2',
      type: 'info',
      title: 'Nova Rota Criada',
      message: 'Frete #1032 foi adicionado ao sistema',
      time: '12 min atrás'
    },
    {
      id: '3',
      type: 'success',
      title: 'Entrega Concluída',
      message: 'Frete #1028 foi entregue com sucesso',
      time: '18 min atrás'
    }
  ]

  const recentRoutes: RoutePreview[] = [
    {
      id: '1',
      freightId: 875412903,
      driver: 'José Silva',
      driverCNH: 'CNH: 12345678901',
      driverPhone: '11999991111',
      origin: 'São Paulo',
      originState: 'SP',
      destination: 'Curitiba',
      destinationState: 'PR',
      vehicle: 'Volvo FH16',
      plate: 'ABC-1234',
      weight: '15.500 kg',
      estimatedDelivery: '05 Out, 2025',
      pickupDate: '03 Out, 2025',
      status: 'inTransit'
    },
    {
      id: '2',
      freightId: 458729654,
      driver: 'Antônio Santos',
      driverCNH: 'CNH: 98765432109',
      driverPhone: '11999992222',
      origin: 'Rio de Janeiro',
      originState: 'RJ',
      destination: 'Belo Horizonte',
      destinationState: 'MG',
      vehicle: 'Mercedes Actros',
      plate: 'DEF-5678',
      weight: '22.300 kg',
      estimatedDelivery: '05 Out, 2025',
      pickupDate: '04 Out, 2025',
      status: 'delivered'
    },
    {
      id: '3',
      freightId: 913562478,
      driver: 'Roberto Costa',
      driverCNH: 'CNH: 11223344556',
      driverPhone: '11999993333',
      origin: 'Porto Alegre',
      originState: 'RS',
      destination: 'Florianópolis',
      destinationState: 'SC',
      vehicle: 'MAN TGX',
      plate: 'GHI-9012',
      weight: '18.750 kg',
      estimatedDelivery: '05 Out, 2025',
      pickupDate: '04 Out, 2025',
      status: 'pickedUp'
    }
  ]

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
    
    if (typeof window === 'undefined') return

    // Carregar dados do localStorage
    try {
      const stored = localStorage.getItem('checkin-history')
      if (stored) {
        const history = JSON.parse(stored)
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
        const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

        const todayCount = history.filter((item: any) => {
          const itemDate = new Date(item.timestamp)
          return itemDate >= today
        }).length

        const weekCount = history.filter((item: any) => {
          const itemDate = new Date(item.timestamp)
          return itemDate >= weekAgo
        }).length

        const monthCount = history.filter((item: any) => {
          const itemDate = new Date(item.timestamp)
          return itemDate >= monthAgo
        }).length

        const pickupCount = history.filter((item: any) => item.type === 'pickup').length
        const deliveryCount = history.filter((item: any) => item.type === 'delivery').length

        setCheckInStats({
          today: todayCount,
          week: weekCount,
          month: monthCount,
          total: history.length,
          pickup: pickupCount,
          delivery: deliveryCount
        })
      }
    } catch (error) {
      console.error('Erro ao carregar histórico:', error)
    }
  }, [])

  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-800 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
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
                    {alert.type === 'warning' ? (
                      <AlertTriangle className={`w-5 h-5 ${
                        alert.type === 'warning' ? 'text-yellow-600' :
                        alert.type === 'error' ? 'text-red-600' :
                        alert.type === 'success' ? 'text-green-600' :
                        'text-blue-600'
                      }`} />
                    ) : (
                      <CheckCircle2 className={`w-5 h-5 ${
                        alert.type === 'warning' ? 'text-yellow-600' :
                        alert.type === 'error' ? 'text-red-600' :
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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

        <FadeIn delay={0.35} direction="up">
          <motion.div
            whileHover={{ scale: 1.02, y: -2 }}
            className="glass-card rounded-xl p-6 border border-white/30 backdrop-blur-xl"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-orange-600" />
              </div>
              <div className="flex items-center gap-1 text-green-600">
                <ArrowUpRight className="w-4 h-4" />
                <span className="text-xs font-semibold">+15.3%</span>
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">
              R$ {(routeStats.totalRevenue / 1000).toFixed(1)}K
            </div>
            <div className="text-sm text-gray-600">Receita Total</div>
            <div className="text-xs text-gray-500 mt-2">Este mês</div>
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
          </div>
        </div>
      </FadeIn>

    </div>
  )
}
