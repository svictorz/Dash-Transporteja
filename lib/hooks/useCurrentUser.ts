'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { DashboardUserRole } from '@/lib/utils/roles'

export interface CurrentUser {
  id: string
  email: string
  name: string | null
  role: DashboardUserRole | null
}

interface UseCurrentUserResult {
  user: CurrentUser | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

/**
 * Carrega a sessão atual + o registro em public.users (com o role).
 * Compartilhe livremente entre páginas: o Supabase já cacheia internamente.
 */
export function useCurrentUser(): UseCurrentUserResult {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        setUser(null)
        return
      }

      const uid = session.user.id
      const sessionEmail = session.user.email ?? ''

      const { data, error: err } = await supabase
        .from('users')
        .select('id, email, name, role')
        .eq('id', uid)
        .single()

      if (err) {
        setUser({ id: uid, email: sessionEmail, name: null, role: null })
        return
      }

      setUser({
        id: data.id,
        email: data.email ?? sessionEmail,
        name: data.name ?? null,
        role: (data.role as DashboardUserRole) ?? null,
      })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao carregar usuário'
      setError(msg)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (cancelled) return
      await load()
    })()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'TOKEN_REFRESHED') return
      if (event === 'SIGNED_OUT') {
        setUser(null)
        return
      }
      load()
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  return { user, loading, error, refresh: load }
}
