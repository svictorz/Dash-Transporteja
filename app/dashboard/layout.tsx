'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldAlert, LogOut } from 'lucide-react'
import SidebarTransporteja from '@/components/transporteja/SidebarTransporteja'
import TopBarTransporteja from '@/components/transporteja/TopBarTransporteja'
import BrandLoading from '@/components/transporteja/BrandLoading'
import { useAuthState } from '@/lib/hooks/useAuthState'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import { supabase } from '@/lib/supabase/client'
import { PANEL_ROLES } from '@/lib/utils/roles'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { session, loading: authLoading } = useAuthState()
  const { user: currentUser, loading: userLoading } = useCurrentUser()
  const [mounted, setMounted] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

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

  const handleSignOut = async () => {
    try {
      setSigningOut(true)
      await supabase.auth.signOut()
      router.replace('/login')
    } finally {
      setSigningOut(false)
    }
  }

  if (!mounted || authLoading || !session) {
    return (
      <BrandLoading
        message={authLoading ? 'Verificando autenticação…' : 'Redirecionando para login…'}
      />
    )
  }

  // Só bloqueamos o painel quando temos CERTEZA que o role do usuário é inválido.
  // Enquanto o useCurrentUser ainda está carregando, deixamos o painel renderizar
  // (RLS protege os dados se o usuário ainda não tiver permissão).
  const userRole = currentUser?.role ?? null
  const hasPanelAccess =
    userRole !== null && (PANEL_ROLES as readonly string[]).includes(userRole)

  if (!userLoading && !hasPanelAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-gray-100 to-slate-100 p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-200 p-6 sm:p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-7 h-7" aria-hidden />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Acesso ao CRM pendente</h1>
          <p className="text-sm text-gray-600 mt-2 leading-relaxed">
            Sua conta {currentUser?.email ? <strong>{currentUser.email}</strong> : null} ainda não tem permissão para
            acessar o CRM. Solicite ao administrador que libere seu acesso.
          </p>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 text-white text-sm font-medium hover:bg-slate-900 transition-colors disabled:opacity-60"
          >
            <LogOut className="w-4 h-4" aria-hidden />
            {signingOut ? 'Saindo…' : 'Sair'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-gray-50 via-gray-100 to-slate-100 print:block print:h-auto print:overflow-visible print:bg-white">
      <div className="print:hidden">
        <SidebarTransporteja
          isMobileOpen={isMobileMenuOpen}
          onMobileClose={() => setIsMobileMenuOpen(false)}
        />
      </div>
      <div className="flex-1 flex min-w-0 flex-col overflow-hidden w-full md:w-auto">
        <div className="print:hidden">
          <TopBarTransporteja onMenuClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
        </div>
        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden bg-gradient-to-br from-gray-50 via-gray-100 to-slate-100 p-4 md:p-6 print:overflow-visible print:bg-white print:p-0">
          {children}
        </main>
      </div>
    </div>
  )
}

