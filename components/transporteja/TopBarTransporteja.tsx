'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import FadeIn from '@/components/animations/FadeIn'
import { Search, Bell, Settings, User, ChevronDown, X, Truck, RefreshCw, Menu } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Notification {
  id: string
  type: 'checkin' | 'route' | 'alert'
  title: string
  message: string
  time: string
  read: boolean
}

interface TopBarTransportejaProps {
  onMenuClick?: () => void
}

export default function TopBarTransporteja({ onMenuClick }: TopBarTransportejaProps) {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [currentDate, setCurrentDate] = useState<string>('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const notificationRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    
    // Carregar usuário (pode ser mockado)
    const storedUser = localStorage.getItem('transporteja-user')
    if (storedUser) {
      setUser(JSON.parse(storedUser))
    } else {
      // Usuário padrão para demonstração
      setUser({ name: 'Operador', email: 'operador@transporteja.com' })
    }

    // Carregar notificações
    const storedNotifications = localStorage.getItem('transporteja-notifications')
    if (storedNotifications) {
      setNotifications(JSON.parse(storedNotifications))
    } else {
      const defaultNotifications: Notification[] = [
        {
          id: '1',
          type: 'checkin',
          title: 'Novo Check-in',
          message: 'Motorista José realizou check-in de coleta',
          time: '5 minutos atrás',
          read: false
        },
        {
          id: '2',
          type: 'route',
          title: 'Rota Atualizada',
          message: 'Rota #1029 foi atualizada',
          time: '1 hora atrás',
          read: false
        }
      ]
      setNotifications(defaultNotifications)
      localStorage.setItem('transporteja-notifications', JSON.stringify(defaultNotifications))
    }

    // Fechar dropdowns ao clicar fora
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false)
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Atualizar data em tempo real
  useEffect(() => {
    const updateDate = () => {
      const now = new Date()
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      }
      const dateString = now.toLocaleDateString('pt-BR', options)
      // Capitalizar primeira letra do dia da semana
      const capitalizedDate = dateString.charAt(0).toUpperCase() + dateString.slice(1)
      setCurrentDate(capitalizedDate)
    }

    updateDate()
    const interval = setInterval(updateDate, 86400000) // Atualizar uma vez por dia (24 horas)

    return () => clearInterval(interval)
  }, [])

  const getFirstName = (fullName: string) => {
    if (!fullName) return 'Usuário'
    return fullName.split(' ')[0]
  }

  const unreadCount = notifications.filter(n => !n.read).length

  const markAsRead = (id: string) => {
    const updated = notifications.map(n => n.id === id ? { ...n, read: true } : n)
    setNotifications(updated)
    localStorage.setItem('transporteja-notifications', JSON.stringify(updated))
  }

  const markAllAsRead = () => {
    const updated = notifications.map(n => ({ ...n, read: true }))
    setNotifications(updated)
    localStorage.setItem('transporteja-notifications', JSON.stringify(updated))
  }

  const handleRefresh = () => {
    setIsRefreshing(true)
    // Recarregar a página após um pequeno delay para mostrar a animação
    setTimeout(() => {
      window.location.reload()
    }, 500)
  }

  const handleSettings = () => {
    router.push('/dashboard/configuracoes')
  }

  return (
    <header className="glass border-b border-white/20 px-6 py-4 backdrop-blur-xl relative z-10">
      <div className="flex items-center justify-between">
        {/* Logo e Título - Estilo Stakent */}
        <FadeIn delay={0.1} direction="right">
          <div className="flex items-center gap-3 md:gap-4">
            {/* Botão Menu Mobile */}
            <button
              onClick={onMenuClick}
              className="p-2 text-gray-600 hover:bg-white/50 rounded-xl transition-colors backdrop-blur-sm md:hidden"
              aria-label="Abrir menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-base md:text-lg font-bold text-gray-900">
                Olá, {getFirstName(user?.name || 'Usuário')}
              </h1>
              <p className="text-xs text-gray-500 hidden sm:block">{currentDate}</p>
            </div>
          </div>
        </FadeIn>

        {/* Ações do Header - Estilo Stakent */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Busca */}
          <FadeIn delay={0.2} direction="down">
            <div className="relative hidden lg:block">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar..."
                className="w-48 xl:w-64 pl-9 pr-4 py-2 glass-card border border-white/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-800/50 focus:border-transparent transition-all"
              />
            </div>
            {/* Botão busca mobile */}
            <button className="p-2 text-gray-600 hover:bg-white/50 rounded-xl transition-colors backdrop-blur-sm lg:hidden" title="Buscar">
              <Search className="w-5 h-5" />
            </button>
          </FadeIn>

          {/* Refresh */}
          <FadeIn delay={0.25} direction="down">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 text-gray-600 hover:bg-white/50 rounded-xl transition-colors backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed" 
              title="Atualizar"
            >
              <RefreshCw 
                className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} 
              />
            </motion.button>
          </FadeIn>

          {/* Configurações */}
          <FadeIn delay={0.3} direction="down">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSettings}
              className="p-2 text-gray-600 hover:bg-white/50 rounded-xl transition-colors backdrop-blur-sm"
              title="Configurações"
            >
              <Settings className="w-5 h-5" />
            </motion.button>
          </FadeIn>

          {/* Notificações */}
          <FadeIn delay={0.35} direction="down">
            <div className="relative z-[9999]" ref={notificationRef}>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-gray-600 hover:bg-white/50 rounded-xl transition-colors backdrop-blur-sm"
                title="Notificações"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg"
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </motion.span>
                )}
              </motion.button>

              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] glass-card rounded-2xl shadow-2xl border border-white/30 z-[9999] max-h-96 overflow-hidden flex flex-col backdrop-blur-xl"
                >
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="font-bold text-gray-900">Notificações</h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-sm text-gray-600 hover:text-gray-900"
                    >
                      Marcar todas como lidas
                    </button>
                  )}
                </div>
                <div className="overflow-y-auto flex-1">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <Bell className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Nenhuma notificação</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {notifications.map((notification) => (
                        <div
                          key={notification.id}
                          onClick={() => markAsRead(notification.id)}
                          className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                            !notification.read ? 'bg-blue-50' : ''
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium ${!notification.read ? 'text-gray-900' : 'text-gray-700'}`}>
                                {notification.title}
                              </p>
                              <p className="text-xs text-gray-600 mt-1">
                                {notification.message}
                              </p>
                              <p className="text-xs text-gray-400 mt-1">
                                {notification.time}
                              </p>
                            </div>
                            {!notification.read && (
                              <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-1"></div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>
          </FadeIn>

          {/* Perfil - Estilo Stakent */}
          <FadeIn delay={0.4} direction="down">
            <div className="relative" ref={profileRef}>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/50 transition-colors backdrop-blur-sm"
              >
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center text-white text-sm font-medium shadow-lg"
                >
                  {user?.name?.charAt(0) || 'O'}
                </motion.div>
                <div className="text-left hidden md:block">
                  <div className="text-sm font-medium text-gray-900">
                    {user?.name || 'Operador'}
                  </div>
                  <div className="text-xs text-gray-500">
                    TransporteJá
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-gray-500" />
              </motion.button>

              {showProfileMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute right-0 mt-2 w-56 glass-card rounded-2xl shadow-2xl border border-white/30 z-50 backdrop-blur-xl"
                >
                <div className="p-4 border-b border-gray-200">
                  <div className="text-sm font-medium text-gray-900">{user?.name || 'Operador'}</div>
                  <div className="text-xs text-gray-500">{user?.email || ''}</div>
                </div>
                <div className="p-2">
                  <button
                    onClick={() => {
                      localStorage.removeItem('transporteja-user')
                      router.push('/login')
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Sair do Sistema
                  </button>
                </div>
              </motion.div>
            )}
          </div>
          </FadeIn>
        </div>
      </div>
    </header>
  )
}
