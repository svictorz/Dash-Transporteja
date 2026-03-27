/**
 * Rate Limiting Middleware
 * 
 * Este módulo implementa rate limiting no frontend
 * para complementar o rate limiting do backend
 */

interface RateLimitResult {
  allowed: boolean
  blocked?: boolean
  remaining?: number
  limit?: number
  reset_at?: string
  blocked_until?: string
  message?: string
}

const RATE_LIMIT_CACHE_KEY = 'rate_limit_cache'
const CACHE_DURATION = 60000 // 1 minuto

interface CachedRateLimit {
  endpoint: string
  result: RateLimitResult
  timestamp: number
}

class RateLimiter {
  private cache: Map<string, CachedRateLimit> = new Map()

  /**
   * Verifica rate limit antes de fazer uma requisição
   */
  async checkRateLimit(endpoint: string): Promise<RateLimitResult> {
    // Verificar cache local primeiro
    const cached = this.getCached(endpoint)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.result
    }

    try {
      // Chamar função SQL do Supabase para verificar rate limit
      const { supabase } = await import('@/lib/supabase/client')
      
      const { data, error } = await supabase.rpc('check_rate_limit', {
        p_identifier: await this.getIdentifier(),
        p_endpoint: endpoint
      })

      if (error) {
        console.error('Erro ao verificar rate limit:', error)
        // Em caso de erro, permitir requisição (fail open)
        return {
          allowed: true,
          remaining: 999999
        }
      }

      const result = data as RateLimitResult
      
      // Cachear resultado
      this.setCached(endpoint, result)

      return result
    } catch (error) {
      console.error('Erro ao verificar rate limit:', error)
      // Em caso de erro, permitir requisição (fail open)
      return {
        allowed: true,
        remaining: 999999
      }
    }
  }

  /**
   * Obtém identificador único (user_id ou IP)
   */
  private async getIdentifier(): Promise<string> {
    try {
      const { supabase } = await import('@/lib/supabase/client')
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.user?.id) {
        return `user:${session.user.id}`
      }
    } catch (error) {
      console.error('Erro ao obter identificador:', error)
    }

    // Fallback para IP (será obtido pelo backend)
    return 'anonymous'
  }

  /**
   * Obtém resultado do cache
   */
  private getCached(endpoint: string): CachedRateLimit | null {
    const key = `${RATE_LIMIT_CACHE_KEY}:${endpoint}`
    const cached = localStorage.getItem(key)
    
    if (!cached) return null

    try {
      const parsed = JSON.parse(cached) as CachedRateLimit
      // Verificar se cache ainda é válido
      if (Date.now() - parsed.timestamp < CACHE_DURATION) {
        return parsed
      }
      // Remover cache expirado
      localStorage.removeItem(key)
      return null
    } catch {
      return null
    }
  }

  /**
   * Armazena resultado no cache
   */
  private setCached(endpoint: string, result: RateLimitResult): void {
    const key = `${RATE_LIMIT_CACHE_KEY}:${endpoint}`
    const cached: CachedRateLimit = {
      endpoint,
      result,
      timestamp: Date.now()
    }
    
    try {
      localStorage.setItem(key, JSON.stringify(cached))
    } catch (error) {
      // Ignorar erros de localStorage (pode estar cheio)
      console.warn('Erro ao cachear rate limit:', error)
    }
  }

  /**
   * Limpa cache
   */
  clearCache(): void {
    const keys = Object.keys(localStorage)
    keys.forEach(key => {
      if (key.startsWith(RATE_LIMIT_CACHE_KEY)) {
        localStorage.removeItem(key)
      }
    })
    this.cache.clear()
  }

  /**
   * Verifica se deve bloquear requisição
   */
  async shouldBlock(endpoint: string): Promise<boolean> {
    const result = await this.checkRateLimit(endpoint)
    return !result.allowed || (result.blocked === true)
  }

  /**
   * Obtém mensagem de erro se bloqueado
   */
  async getBlockMessage(endpoint: string): Promise<string | null> {
    const result = await this.checkRateLimit(endpoint)
    
    if (!result.allowed || result.blocked) {
      return result.message || 'Limite de requisições excedido. Tente novamente mais tarde.'
    }
    
    return null
  }
}

// Instância singleton
export const rateLimiter = new RateLimiter()

/**
 * Wrapper para requisições com rate limiting
 */
export async function withRateLimit<T>(
  endpoint: string,
  requestFn: () => Promise<T>
): Promise<T> {
  // Verificar rate limit antes de fazer requisição
  const shouldBlock = await rateLimiter.shouldBlock(endpoint)
  
  if (shouldBlock) {
    const message = await rateLimiter.getBlockMessage(endpoint)
    throw new Error(message || 'Limite de requisições excedido')
  }

  try {
    const result = await requestFn()
    
    // Atualizar cache após requisição bem-sucedida
    await rateLimiter.checkRateLimit(endpoint)
    
    return result
  } catch (error) {
    // Em caso de erro, limpar cache para forçar nova verificação
    rateLimiter.clearCache()
    throw error
  }
}

/**
 * Hook para usar rate limiting em componentes React
 * 
 * Para usar este hook, importe React no seu componente:
 * import { useState, useEffect } from 'react'
 * import { useRateLimit } from '@/lib/middleware/rate-limiting'
 */
export function createUseRateLimit(React: { useState: (initial: unknown) => [unknown, (s: unknown) => void]; useEffect: (effect: () => void | (() => void), deps?: unknown[]) => void }) {
  return function useRateLimit(endpoint: string) {
    const [isBlocked, setIsBlocked] = React.useState(false)
    const [remaining, setRemaining] = React.useState(null as number | null)
    const [resetAt, setResetAt] = React.useState(null as Date | null)

    React.useEffect(() => {
      const checkLimit = async () => {
        const result = await rateLimiter.checkRateLimit(endpoint)
        setIsBlocked(!result.allowed || result.blocked === true)
        setRemaining(result.remaining ?? null)
        if (result.reset_at) {
          setResetAt(new Date(result.reset_at))
        }
      }

      checkLimit()
      const interval = setInterval(checkLimit, 10000) // Verificar a cada 10 segundos

      return () => clearInterval(interval)
    }, [endpoint])

    return { isBlocked, remaining, resetAt }
  }
}

