'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { DashboardUserRole } from '@/lib/utils/roles'

export interface CurrentUser {
  id: string
  email: string
  name: string | null
  role: DashboardUserRole | null
  /**
   * Indica se a leitura do role em public.users foi conclusiva.
   *  - `true`  → resposta válida do banco (mesmo que role venha null por
   *              registro inexistente). Camada de UI pode confiar e
   *              bloquear acesso se necessário.
   *  - `false` → falhas transitórias (timeout/rede) exauriram os retries.
   *              Render otimista: NÃO bloqueie o painel; a próxima
   *              tentativa (refresh / re-render) pode resolver.
   */
  roleResolved: boolean
}

interface UseCurrentUserResult {
  user: CurrentUser | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const SESSION_TIMEOUT_MS = 4000
/**
 * Timeout por tentativa. Mais generoso que antes (5s era curto demais para
 * 3G / picos de latência da Vercel/Supabase em horário de pico). Combinado
 * com `ROLE_MAX_ATTEMPTS`, dá no pior caso ~24s antes de desistir, o que é
 * aceitável para evitar a tela de "Acesso ao CRM pendente" falso-positiva.
 */
const ROLE_TIMEOUT_MS = 8000
/** Número de tentativas para ler o role em public.users (1 inicial + 2 retries). */
const ROLE_MAX_ATTEMPTS = 3

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

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

      /**
       * Tenta ler o role com retries exponenciais. Erros transitórios
       * (timeout, instabilidade de rede, hiccup do PostgREST) NÃO podem
       * derrubar o usuário para a tela "Acesso ao CRM pendente" — isso só
       * deve acontecer quando temos certeza de que o registro em
       * public.users está faltando/com role inválido.
       */
      let lastResult: RoleQueryResult = { data: null, error: { message: 'not_attempted' } }
      let transientFailure = false
      for (let attempt = 1; attempt <= ROLE_MAX_ATTEMPTS; attempt++) {
        const rolePromise: Promise<RoleQueryResult> = Promise.resolve(
          supabase.from('users').select('id, email, name, role').eq('id', uid).single(),
        ).then(({ data, error }) => ({
          data: data as RoleRow | null,
          error: error ? { message: error.message } : null,
        }))

        lastResult = await withTimeout<RoleQueryResult>(rolePromise, ROLE_TIMEOUT_MS, {
          data: null,
          error: { message: 'timeout' },
        })

        if (!mountedRef.current) return

        if (lastResult.data) break

        const errMsg = lastResult.error?.message ?? ''
        // PGRST116 = single() não encontrou linha — não é transiente, é
        // "user não existe em public.users". Não vale a pena retry.
        const isNotFound = errMsg.includes('PGRST116') || errMsg.toLowerCase().includes('no rows')
        if (isNotFound) break

        // Demais erros (timeout, network, 5xx) são transientes — retry.
        transientFailure = true
        if (attempt < ROLE_MAX_ATTEMPTS) {
          await sleep(600 * attempt) // 600ms, 1200ms
          if (!mountedRef.current) return
        }
      }

      const { data, error: err } = lastResult

      if (err || !data) {
        if (transientFailure) {
          // Falha transitória após retries — não confirmamos role, mas
          // também não bloqueamos o painel. Mantemos o usuário com role
          // null, o `roleResolved=false` sinaliza que a verificação é
          // inconclusiva (camada acima decide ser otimista).
          setUser({
            id: uid,
            email: sessionEmail,
            name: null,
            role: null,
            roleResolved: false,
          })
        } else {
          // De fato não há registro em public.users — role é nulo confirmado.
          setUser({
            id: uid,
            email: sessionEmail,
            name: null,
            role: null,
            roleResolved: true,
          })
        }
        return
      }

      setUser({
        id: data.id,
        email: data.email ?? sessionEmail,
        name: data.name ?? null,
        role: (data.role as DashboardUserRole) ?? null,
        roleResolved: true,
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
