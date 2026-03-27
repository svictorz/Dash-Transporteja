'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import FadeIn from '@/components/animations/FadeIn'
import { Search, Settings, User, ChevronDown, X, Truck, RefreshCw, Menu, LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { BRAND_NAME_SHORT } from '@/lib/constants/brand'
import { dashboardRoleLabel } from '@/lib/utils/roles'

interface UserInfo {
  name?: string | null
  email?: string | null
  credits_balance?: number
  role?: string | null
  [key: string]: unknown
}

interface TopBarTransportejaProps {
  onMenuClick?: () => void
}

export default function TopBarTransporteja({ onMenuClick }: TopBarTransportejaProps) {
  const router = useRouter()
  const [user, setUser] = useState<UserInfo | null>(null)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [currentDate, setCurrentDate] = useState<string>('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const userLoadAttemptedRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    
    let isMounted = true
    
    const loadUser = async () => {
      if (userLoadAttemptedRef.current) return
      userLoadAttemptedRef.current = true
      
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!isMounted) return
        
        if (session?.user) {
          try {
            const { data: userData, error } = await supabase
              .from('users')
              .select('id, email, name, role, credits_balance')
              .eq('id', session.user.id)
              .single()

            if (userData && !error) {
              if (isMounted) setUser(userData)
            } else {
              if (isMounted) {
                setUser({
                  name: session.user.email?.split('@')[0] || 'Usuário',
                  email: session.user.email || ''
                })
              }
            }
          } catch {
            if (isMounted) {
              setUser({
                name: session.user.email?.split('@')[0] || 'Usuário',
                email: session.user.email || ''
              })
            }
          }
        } else {
          if (isMounted) setUser(null)
        }
      } catch {
        /* silently fail */
      }
    }

    loadUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return
      if (event === 'TOKEN_REFRESHED') return
      
      if (event === 'SIGNED_IN' && session?.user) {
        userLoadAttemptedRef.current = false
        loadUser()
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        userLoadAttemptedRef.current = false
      }
    })

    const creditsInterval = setInterval(() => {
      userLoadAttemptedRef.current = false
      loadUser()
    }, 60000)

    // Fechar dropdown ao clicar fora
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    
    return () => {
      isMounted = false
      subscription.unsubscribe()
      clearInterval(creditsInterval)
      document.removeEventListener('mousedown', handleClickOutside)
    }
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

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data: userData } = await supabase
          .from('users')
          .select('id, email, name, role, credits_balance')
          .eq('id', session.user.id)
          .single()
        if (userData) setUser(userData)
      }
      router.refresh()
    } catch { /* ignore */ }
    setIsRefreshing(false)
  }

  const handleSettings = () => {
    router.push('/dashboard/configuracoes')
  }

  const handleLogout = async () => {
    try {
      // Limpar sessão do Supabase
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        console.error('Erro ao fazer logout:', error)
      }
      
      // Limpar estado local
      setUser(null)
      
      // Redirecionar para login e forçar recarregamento
      router.replace('/login')
      
      // Forçar recarregamento completo para limpar qualquer cache
      window.location.href = '/login'
    } catch (error) {
      console.error('Erro ao fazer logout:', error)
      // Mesmo com erro, redirecionar para login
      router.replace('/login')
      window.location.href = '/login'
    }
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
            <button type="button" className="p-2 text-gray-600 hover:bg-white/50 rounded-xl transition-colors backdrop-blur-sm lg:hidden" aria-label="Buscar" title="Buscar">
              <Search className="w-5 h-5" />
            </button>
          </FadeIn>

          {/* Refresh */}
          <FadeIn delay={0.25} direction="down">
            <motion.button
              type="button"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 text-gray-600 hover:bg-white/50 rounded-xl transition-colors backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Atualizar página"
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
              type="button"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSettings}
              className="p-2 text-gray-600 hover:bg-white/50 rounded-xl transition-colors backdrop-blur-sm"
              aria-label="Configurações"
              title="Configurações"
            >
              <Settings className="w-5 h-5" />
            </motion.button>
          </FadeIn>

          {/* Perfil */}
          <FadeIn delay={0.35} direction="down">
            <div className="relative" ref={profileRef}>
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/50 transition-colors backdrop-blur-sm"
                aria-label="Abrir menu do perfil"
                aria-expanded={showProfileMenu}
              >
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center text-white text-sm font-medium shadow-lg uppercase"
                >
                  {(user?.name?.trim().charAt(0) || 'U').toUpperCase()}
                </motion.div>
                <div className="text-left hidden md:block">
                  <div className="text-sm font-medium text-gray-900">
                    {user?.name || 'Usuário'}
                  </div>
                  <div className="text-xs text-gray-500 space-y-0.5">
                    <div className="text-gray-600">
                      Função:{' '}
                      <span className="font-medium text-gray-800">
                        {dashboardRoleLabel(user?.role as string | undefined)}
                      </span>
                    </div>
                    <div className="text-gray-400">{BRAND_NAME_SHORT}</div>
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
                  <div className="text-sm font-medium text-gray-900">{user?.name || 'Usuário'}</div>
                  <div className="text-xs text-gray-500">{user?.email || ''}</div>
                  <div className="text-xs text-gray-600 mt-1.5">
                    Função: {dashboardRoleLabel(user?.role as string | undefined)}
                  </div>
                </div>
                <div className="p-2">
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
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
