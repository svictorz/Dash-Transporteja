'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import SidebarTransporteja from '@/components/transporteja/SidebarTransporteja'
import TopBarTransporteja from '@/components/transporteja/TopBarTransporteja'
import { useAuthState } from '@/lib/hooks/useAuthState'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { session, loading: authLoading } = useAuthState()
  const [mounted, setMounted] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || authLoading) return
    if (!session) router.replace('/login')
  }, [mounted, authLoading, session, router])

  // Fechar menu mobile ao redimensionar para desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  if (!mounted || authLoading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-slate-800 border-t-transparent rounded-full animate-spin mx-auto mb-4" aria-hidden />
          <p className="text-gray-600">{authLoading ? 'Verificando autenticação…' : 'Redirecionando para login…'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-gray-50 via-gray-100 to-slate-100">
      <SidebarTransporteja 
        isMobileOpen={isMobileMenuOpen}
        onMobileClose={() => setIsMobileMenuOpen(false)}
      />
      <div className="flex-1 flex flex-col overflow-hidden w-full md:w-auto">
        <TopBarTransporteja onMenuClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
        <main className="flex-1 overflow-y-auto bg-gradient-to-br from-gray-50 via-gray-100 to-slate-100 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

