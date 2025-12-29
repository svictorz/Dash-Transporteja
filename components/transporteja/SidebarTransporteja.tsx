'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import FadeIn from '@/components/animations/FadeIn'
import {
  LayoutDashboard,
  MapPin,
  Truck,
  Users,
  Settings,
  LogOut,
  ChevronLeft,
  CheckCircle2,
  Route,
  Crown,
  FileText,
  X
} from 'lucide-react'

interface MenuItem {
  icon: any
  label: string
  path: string
  badge?: number
}

interface SidebarTransportejaProps {
  isMobileOpen?: boolean
  onMobileClose?: () => void
}

export default function SidebarTransporteja({ isMobileOpen = false, onMobileClose }: SidebarTransportejaProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(true)
  const [planData, setPlanData] = useState({
    planName: 'Plano Básico',
    used: 92,
    total: 100,
    unit: 'rotas'
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const stored = localStorage.getItem('transporteja-sidebar-open')
    if (stored !== null) {
      setIsOpen(stored === 'true')
    }
  }, [])

  const handleNavigation = (path: string) => {
    router.push(path)
    // Fechar menu mobile após navegação
    if (onMobileClose) {
      onMobileClose()
    }
  }

  const toggleSidebar = () => {
    setIsOpen(prev => {
      const next = !prev
      localStorage.setItem('transporteja-sidebar-open', String(next))
      return next
    })
  }

  const menuItems: MenuItem[] = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Route, label: 'Rotas', path: '/dashboard/rotas' },
    { icon: FileText, label: 'Analytics', path: '/dashboard/relatorios' },
    { icon: Users, label: 'Clientes', path: '/dashboard/clientes' },
    { icon: Truck, label: 'Motoristas', path: '/dashboard/motoristas' },
    { icon: MapPin, label: 'Rastreio', path: '/rastreio/driver' },
  ]

  const handleLogout = () => {
    localStorage.removeItem('transporteja-user')
    router.push('/login')
  }

  const sidebarContent = (
    <>
      <div className="p-4 border-b border-white/20">
        <div className="flex items-center justify-between">
          {isOpen && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center">
                <Truck className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">TransporteJá</h2>
                <p className="text-xs text-gray-500">Sistema de Rastreio</p>
              </div>
            </div>
          )}
          {!isOpen && (
            <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center mx-auto">
              <Truck className="w-5 h-5 text-white" />
            </div>
          )}
          <div className="flex items-center gap-2">
            {/* Botão fechar mobile */}
            {onMobileClose && (
              <button
                onClick={onMobileClose}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600 md:hidden"
              >
                <X className="w-5 h-5" />
              </button>
            )}
            {/* Botão toggle desktop */}
            <button
              onClick={toggleSidebar}
              className={`p-2 rounded-lg hover:bg-gray-100 transition-colors hidden md:block ${
                isOpen ? 'text-orange-500' : 'text-gray-600'
              }`}
            >
              <ChevronLeft 
                className={`w-5 h-5 transition-transform duration-300 ${
                  isOpen ? 'rotate-0' : 'rotate-180'
                }`} 
              />
            </button>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {menuItems.map((item, index) => {
          const Icon = item.icon
          // Melhor detecção de rota ativa
          let isActive = false
          if (item.path === '/dashboard') {
            // Para dashboard, só ativo se for exatamente /dashboard
            isActive = pathname === '/dashboard'
          } else {
            // Para outras rotas, verifica se começa com o path
            isActive = pathname === item.path || (pathname?.startsWith(item.path + '/') && pathname !== '/dashboard')
          }
          
          return (
            <FadeIn key={item.path} delay={0.1 + index * 0.05} direction="right">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleNavigation(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive
                    ? 'bg-slate-800/90 text-white shadow-lg backdrop-blur-sm'
                    : 'text-gray-700 hover:bg-white/50 backdrop-blur-sm'
                }`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                {isOpen && <span className="font-medium">{item.label}</span>}
                {isOpen && item.badge && (
                  <span className="ml-auto bg-green-500 text-white text-xs px-2 py-1 rounded-full font-semibold">
                    {item.badge}
                  </span>
                )}
              </motion.button>
            </FadeIn>
          )
        })}
      </nav>

      <FadeIn delay={0.3}>
        <div className="p-4 border-t border-white/20 space-y-3">
          {/* Status do Plano */}
          {isOpen ? (
            <div className="bg-white/50 backdrop-blur-sm rounded-xl p-4 border border-white/30 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900">{planData.planName}</h3>
                <button
                  onClick={() => handleNavigation('/dashboard/planos')}
                  className="text-xs text-blue-600 hover:text-blue-700 underline font-medium"
                >
                  Upgrade
                </button>
              </div>
              
              {/* Barra de Progresso */}
              <div className="space-y-2">
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(planData.used / planData.total) * 100}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-600">
                  {planData.used} rotas usadas de {planData.total} rotas disponíveis
                </p>
              </div>

              {/* Status do Plano */}
              <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                <Crown className="w-4 h-4 text-orange-500" />
                <span className="text-xs font-medium text-gray-700">{planData.planName}</span>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <Crown className="w-5 h-5 text-orange-500" />
            </div>
          )}

          <button 
            onClick={() => handleNavigation('/dashboard/configuracoes')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100 transition-all"
          >
            <Settings className="w-5 h-5 text-gray-500" />
            {isOpen && <span>Configurações</span>}
          </button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 hover:bg-white/50 backdrop-blur-sm transition-all"
          >
            <LogOut className="w-5 h-5 text-gray-500" />
            {isOpen && <span>Sair</span>}
          </motion.button>
        </div>
      </FadeIn>
    </>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={`${isOpen ? 'w-72' : 'w-20'} h-screen glass border-r border-white/20 flex-col transition-all duration-300 shadow-lg hidden md:flex backdrop-blur-xl`}>
        <FadeIn delay={0.1}>
          {sidebarContent}
        </FadeIn>
      </aside>

      {/* Mobile Sidebar Drawer */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onMobileClose}
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
            />
            {/* Drawer */}
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 h-screen w-72 glass border-r border-white/20 flex-col shadow-2xl z-50 md:hidden backdrop-blur-xl"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

