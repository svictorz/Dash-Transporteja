'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import FadeIn from '@/components/animations/FadeIn'
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  ChevronLeft,
  Route,
  FileText,
  X,
  Shield,
  BarChart3,
  CalendarDays
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Logo from './Logo'

interface MenuItem {
  icon: LucideIcon
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

  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const stored = localStorage.getItem('transporteja-sidebar-open')
    if (stored !== null) {
      setIsOpen(stored === 'true')
    }
  }, [])

  const handleNavClick = () => {
    if (onMobileClose) onMobileClose()
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
    { icon: Users, label: 'Clientes', path: '/dashboard/clientes' },
    { icon: Route, label: 'Rotas', path: '/dashboard/rotas' },
    { icon: FileText, label: 'Propostas', path: '/dashboard/propostas' },
    { icon: CalendarDays, label: 'Calendário', path: '/dashboard/calendario' },
    { icon: BarChart3, label: 'Performance', path: '/dashboard/performance' },
  ]

  const handleLogout = async () => {
    try {
      const { supabase } = await import('@/lib/supabase/client')
      // Limpar sessão do Supabase
      const { error } = await supabase.auth.signOut()
      
      // Limpar localStorage se houver
      localStorage.removeItem('transporteja-user')
      localStorage.removeItem('transporteja-notifications')
      
      // Redirecionar para login e forçar recarregamento
      router.replace('/login')
      window.location.href = '/login'
    } catch {
      router.replace('/login')
      window.location.href = '/login'
    }
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-white/20 flex-shrink-0">
        <div className="flex items-center justify-between">
          {isOpen && (
            <div className="flex flex-col min-w-0 flex-1 pr-2">
              <motion.div whileHover={{ scale: 1.02 }} className="flex-shrink-0 w-fit">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo-header.png"
                  alt=""
                  className="h-8 w-auto max-w-[min(100%,240px)] object-contain opacity-90"
                  aria-hidden
                />
              </motion.div>
            </div>
          )}
          {!isOpen && (
            <motion.div
              whileHover={{ scale: 1.1, rotate: 5 }}
              className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center mx-auto p-1"
            >
              <Logo size={20} />
            </motion.div>
          )}
          <div className="flex items-center gap-2">
            {/* Botão fechar mobile */}
            {onMobileClose && (
              <button
                type="button"
                onClick={onMobileClose}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600 md:hidden"
                aria-label="Fechar menu"
              >
                <X className="w-5 h-5" />
              </button>
            )}
            {/* Botão toggle desktop */}
            <button
              type="button"
              onClick={toggleSidebar}
              className={`p-2 rounded-lg hover:bg-gray-100 transition-colors hidden md:block ${
                isOpen ? 'text-orange-500' : 'text-gray-600'
              }`}
              aria-label={isOpen ? 'Recolher menu' : 'Expandir menu'}
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

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto min-h-0">
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
              <Link
                href={item.path}
                onClick={handleNavClick}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive
                    ? 'bg-slate-800/90 text-white shadow-lg backdrop-blur-sm'
                    : 'text-gray-700 hover:bg-white/50 backdrop-blur-sm'
                }`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                {isOpen && <span className="font-medium">{item.label}</span>}
                {isOpen && item.badge != null && (
                  <span className="ml-auto bg-green-500 text-white text-xs px-2 py-1 rounded-full font-semibold">
                    {item.badge}
                  </span>
                )}
              </Link>
            </FadeIn>
          )
        })}
      </nav>

      <div className="mt-auto flex-shrink-0">
        <FadeIn delay={0.3}>
          <div className="p-4 border-t border-white/20 space-y-3">
          <Link
            href="/dashboard/configuracoes"
            onClick={handleNavClick}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100 transition-all"
          >
            <Settings className="w-5 h-5 text-gray-500" />
            {isOpen && <span>Configurações</span>}
          </Link>
          <Link
            href="/dashboard/dados-pessoais"
            onClick={handleNavClick}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100 transition-all"
          >
            <Shield className="w-5 h-5 text-gray-500" />
            {isOpen && <span>Dados Pessoais</span>}
          </Link>
          <motion.button
            type="button"
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
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={`${isOpen ? 'w-72' : 'w-20'} h-screen glass border-r border-white/20 flex flex-col transition-all duration-300 shadow-lg hidden md:flex backdrop-blur-xl`}>
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
              className="fixed left-0 top-0 h-screen w-72 glass border-r border-white/20 flex flex-col shadow-2xl z-50 md:hidden backdrop-blur-xl"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

