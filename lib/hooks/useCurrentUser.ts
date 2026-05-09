'use client'

import { useEffect, useRef, useState } from 'react'
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

const SESSION_TIMEOUT_MS = 4000
const ROLE_TIMEOUT_MS = 5000

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    let done = false
    const timer = setTimeout(() => {
      if (done) return
      done = true
      resolve(fallback)
    }, ms)
    promise
      .then((value) => {
        if (done) return
        done = true
        clearTimeout(timer)
        resolve(value)
      })
      .catch(() => {
        if (done) return
        done = true
        clearTimeout(timer)
        resolve(fallback)
      })
  })
}

/**
 * Carrega a sessão atual + o registro em public.users (com o role).
 * Compartilhe livremente entre páginas: o Supabase já cacheia internamente.
 */
export function useCurrentUser(): UseCurrentUserResult {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const load = async () => {
    try {
      setError(null)

      const sessionResult = await withTimeout(
        supabase.auth.getSession(),
        SESSION_TIMEOUT_MS,
        { data: { session: null } } as Awaited<ReturnType<typeof supabase.auth.getSession>>,
      )

      const session = sessionResult.data.session
      if (!session?.user) {
        if (mountedRef.current) setUser(null)
        return
      }

      const uid = session.user.id
      const sessionEmail = session.user.email ?? ''

      type RoleRow = { id: string; email: string | null; name: string | null; role: string | null }
      type RoleQueryResult = { data: RoleRow | null; error: { message: string } | null }

      const rolePromise: Promise<RoleQueryResult> = Promise.resolve(
        supabase.from('users').select('id, email, name, role').eq('id', uid).single(),
      ).then(({ data, error }) => ({
        data: data as RoleRow | null,
        error: error ? { message: error.message } : null,
      }))

      const roleResult = await withTimeout<RoleQueryResult>(rolePromise, ROLE_TIMEOUT_MS, {
        data: null,
        error: { message: 'timeout' },
      })

      if (!mountedRef.current) return

      const { data, error: err } = roleResult

      if (err || !data) {
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
      if (!mountedRef.current) return
      const msg = e instanceof Error ? e.message : 'Erro ao carregar usuário'
      setError(msg)
      setUser(null)
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }

  useEffect(() => {
    mountedRef.current = true
    load()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'TOKEN_REFRESHED') return
      if (event === 'SIGNED_OUT') {
        setUser(null)
        return
      }
      load()
    })

    return () => {
      mountedRef.current = false
      subscription.unsubscribe()
    }
  }, [])

  return { user, loading, error, refresh: load }
}
