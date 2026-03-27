'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { Session } from '@supabase/supabase-js'

const SESSION_CHECK_TIMEOUT_MS = 2500

function delay(ms: number): Promise<null> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(null), ms)
  })
}

export function useAuthState() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)
  const loadingDoneRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    loadingDoneRef.current = false

    const setLoadingFalse = () => {
      if (!loadingDoneRef.current && mountedRef.current) {
        loadingDoneRef.current = true
        setLoading(false)
      }
    }

    const loadSession = async () => {
      try {
        const getSessionPromise = supabase.auth.getSession().then(({ data }) => data.session)
        const s = await Promise.race([
          getSessionPromise,
          delay(SESSION_CHECK_TIMEOUT_MS),
        ])
        if (mountedRef.current) {
          setSession(s ?? null)
        }
      } catch {
        if (mountedRef.current) {
          setSession(null)
        }
      } finally {
        setLoadingFalse()
      }
    }

    loadSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'TOKEN_REFRESHED') return
      if (mountedRef.current) {
        setSession(newSession)
      }
    })

    return () => {
      mountedRef.current = false
      subscription.unsubscribe()
    }
  }, [])

  return { session, loading }
}
