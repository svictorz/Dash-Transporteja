'use client'

import { useState, useEffect } from 'react'
import { rateLimiter } from '@/lib/middleware/rate-limiting'

interface RateLimitResult {
  isBlocked: boolean
  remaining: number | null
  resetAt: Date | null
  limit: number | null
}

/**
 * Hook React para verificar rate limiting
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isBlocked, remaining, resetAt } = useRateLimit('/api/drivers')
 *   
 *   if (isBlocked) {
 *     return <div>Limite excedido. Tente novamente em {resetAt?.toLocaleTimeString()}</div>
 *   }
 *   
 *   return <div>Requisições restantes: {remaining}</div>
 * }
 * ```
 */
export function useRateLimit(endpoint: string): RateLimitResult {
  const [isBlocked, setIsBlocked] = useState(false)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [resetAt, setResetAt] = useState<Date | null>(null)
  const [limit, setLimit] = useState<number | null>(null)

  useEffect(() => {
    const checkLimit = async () => {
      const result = await rateLimiter.checkRateLimit(endpoint)
      setIsBlocked(!result.allowed || result.blocked === true)
      setRemaining(result.remaining ?? null)
      setLimit(result.limit ?? null)
      if (result.reset_at) {
        setResetAt(new Date(result.reset_at))
      } else {
        setResetAt(null)
      }
    }

    checkLimit()
    const interval = setInterval(checkLimit, 10000) // Verificar a cada 10 segundos

    return () => clearInterval(interval)
  }, [endpoint])

  return { isBlocked, remaining, resetAt, limit }
}

