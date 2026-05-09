/**
 * Rate limit simples em memória (sliding window).
 *
 * - Sem dependências externas.
 * - Funciona por instância serverless: em um deploy multi-região da Vercel
 *   cada Lambda tem seu próprio Map; um atacante distribuído pode contornar.
 *   Para força total use Vercel Firewall (Settings → Firewall → Rate Limit)
 *   ou Upstash Redis com @upstash/ratelimit.
 * - Suficiente para:
 *   - reduzir abuso casual / scraping
 *   - bloquear loops acidentais do front
 *
 * Estratégia: para cada chave (ex: IP + caminho), guarda a lista de
 * timestamps em ms; em cada chamada descarta tudo que está fora da janela.
 */

const buckets = new Map<string, number[]>()
const CLEANUP_THRESHOLD = 1024 // varre o Map de tempos em tempos para evitar leak

function cleanupIfNeeded(now: number, windowMs: number) {
  if (buckets.size < CLEANUP_THRESHOLD) return
  buckets.forEach((hits, key) => {
    const filtered = hits.filter((t) => now - t < windowMs)
    if (filtered.length === 0) buckets.delete(key)
    else buckets.set(key, filtered)
  })
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  /** Em segundos, quanto tempo até a janela liberar uma vaga. */
  retryAfter: number
  limit: number
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now()
  const hits = buckets.get(key) ?? []
  const fresh = hits.filter((t) => now - t < windowMs)

  if (fresh.length >= limit) {
    const earliest = fresh[0]
    const retryAfter = Math.max(1, Math.ceil((windowMs - (now - earliest)) / 1000))
    buckets.set(key, fresh)
    cleanupIfNeeded(now, windowMs)
    return { allowed: false, remaining: 0, retryAfter, limit }
  }

  fresh.push(now)
  buckets.set(key, fresh)
  cleanupIfNeeded(now, windowMs)
  return {
    allowed: true,
    remaining: limit - fresh.length,
    retryAfter: 0,
    limit,
  }
}
