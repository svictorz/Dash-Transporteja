'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
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
  CalendarDays,
  UserCog
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Logo from './Logo'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'

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
  const { user: currentUser } = useCurrentUser()
  const isAdmin = currentUser?.role === 'admin'

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
    { icon: LayoutDashboard, label: 'Dashboard', path: '/inicio' },
    { icon: Users, label: 'Clientes', path: '/clientes' },
    { icon: Route, label: 'Rotas', path: '/rotas' },
    { icon: FileText, label: 'Propostas', path: '/propostas' },
    { icon: CalendarDays, label: 'Calendário', path: '/calendario' },
    { icon: BarChart3, label: 'Performance', path: '/performance' },
    ...(isAdmin
      ? [{ icon: UserCog, label: 'Permissões', path: '/usuarios' } as MenuItem]
      : []),
  ]

  const handleLogout = async () => {
    try {
      const { supabase } = await import('@/lib/supabase/client')
      const { error } = await supabase.auth.signOut()
      void error

      localStorage.removeItem('transporteja-user')
      localStorage.removeItem('transporteja-notifications')

      router.replace('/login')
      window.location.href = '/login'
    } catch {
      router.replace('/login')
      window.location.href = '/login'
    }
  }

  // Conteúdo da sidebar — sem stagger / FadeIn / backdrop-blur internos.
  // Tudo o que precisa de feedback de toque usa CSS (`active:scale-*`),
  // que é processado pela thread de composição em vez do main thread —
  // crucial em mobile com 3G e celular básico.
  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-white/20 flex-shrink-0">
        <div className="flex items-center justify-between">
          {isOpen && (
            <div className="flex flex-col min-w-0 flex-1 pr-2">
              <div className="flex-shrink-0 w-fit">
                <Image
                  src="/logo-header.png"
                  alt=""
                  width={240}
                  height={32}
                  sizes="240px"
                  priority
                  className="h-8 w-auto max-w-[min(100%,240px)] object-contain opacity-90"
                  aria-hidden
                />
              </div>
            </div>
          )}
          {!isOpen && (
            <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center mx-auto p-1">
              <Logo size={20} />
            </div>
          )}
          <div className="flex items-center gap-2">
            {onMobileClose && (
              <button
                type="button"
                onClick={onMobileClose}
                className="p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors text-gray-600 md:hidden"
                aria-label="Fechar menu"
              >
                <X className="w-5 h-5" />
              </button>
            )}
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
        {menuItems.map((item) => {
          const Icon = item.icon
          let isActive = false
          if (item.path === '/inicio') {
            isActive = pathname === '/inicio'
          } else {
            isActive = pathname === item.path || (pathname?.startsWith(item.path + '/') && pathname !== '/inicio')
          }

          return (
            <Link
              key={item.path}
              href={item.path}
              onClick={handleNavClick}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors active:scale-[0.98] ${
                isActive
                  ? 'bg-slate-800/90 text-white shadow-sm'
                  : 'text-gray-700 hover:bg-white/60'
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
          )
        })}
      </nav>

      <div className="mt-auto flex-shrink-0">
        <div className="p-4 border-t border-white/20 space-y-3">
          <Link
            href="/configuracoes"
            onClick={handleNavClick}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100 active:bg-gray-200 transition-colors"
          >
            <Settings className="w-5 h-5 text-gray-500" />
            {isOpen && <span>Configurações</span>}
          </Link>
          <Link
            href="/dados-pessoais"
            onClick={handleNavClick}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100 active:bg-gray-200 transition-colors"
          >
            <Shield className="w-5 h-5 text-gray-500" />
            {isOpen && <span>Dados Pessoais</span>}
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 hover:bg-white/60 active:scale-[0.98] transition-colors"
          >
            <LogOut className="w-5 h-5 text-gray-500" />
            {isOpen && <span>Sair</span>}
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar — mantém glass/backdrop-blur (GPU desktop dá conta). */}
      <aside
        className={`${
          isOpen ? 'w-72' : 'w-20'
        } h-screen glass border-r border-white/20 flex flex-col transition-[width] duration-300 shadow-lg hidden md:flex backdrop-blur-xl`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile drawer — fundo sólido (sem backdrop-blur) e tween curto.
          backdrop-blur em GPU mobile gasta MUITO frame budget;
          spring causa cálculos extras vs tween linear. */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: 'linear' }}
              onClick={onMobileClose}
              className="fixed inset-0 bg-black/40 z-40 md:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
              className="fixed left-0 top-0 h-screen w-72 bg-white border-r border-gray-200 flex flex-col shadow-xl z-50 md:hidden will-change-transform"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
