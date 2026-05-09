import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'
import { rateLimit } from '@/lib/utils/rate-limit'
import { legacyDashboardRewrite } from '@/lib/constants/painel-routes'

/**
 * Limites por endpoint. Subiu o `count` → 429.
 */
const API_RATE_LIMITS: { prefix: string; limit: number; windowMs: number }[] = [
  // Cotação consulta serviços externos (Nominatim/OSRM): mais sensível
  { prefix: '/api/cotacao/rota', limit: 30, windowMs: 60_000 },
  { prefix: '/api/rotas/distancia', limit: 30, windowMs: 60_000 },
  { prefix: '/api/geocode/reverse', limit: 60, windowMs: 60_000 },
]

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  const real = request.headers.get('x-real-ip')
  if (real) return real
  return request.ip ?? 'unknown'
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Redirect 308 (permanent, preserva método) das URLs legadas /dashboard/*
  // para a nova estrutura sem prefixo. Mantém querystring intacta.
  const legacyTarget = legacyDashboardRewrite(pathname)
  if (legacyTarget) {
    const url = request.nextUrl.clone()
    url.pathname = legacyTarget
    return NextResponse.redirect(url, 308)
  }

  // Rate limit em /api/* — vale também em desenvolvimento, ajuda a flagrar
  // loops do front. Para força total em produção use Vercel Firewall.
  if (pathname.startsWith('/api/')) {
    const cfg = API_RATE_LIMITS.find((c) => pathname.startsWith(c.prefix))
    if (cfg) {
      const ip = getClientIp(request)
      const key = `${ip}:${cfg.prefix}`
      const result = rateLimit(key, cfg.limit, cfg.windowMs)
      if (!result.allowed) {
        return new NextResponse(
          JSON.stringify({ error: 'Too Many Requests', retryAfter: result.retryAfter }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': String(result.retryAfter),
              'X-RateLimit-Limit': String(result.limit),
              'X-RateLimit-Remaining': '0',
            },
          },
        )
      }
    }
  }

  if (process.env.NODE_ENV === 'development') {
    return NextResponse.next()
  }
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Não passar por este middleware nada em /_next/* (CSS, chunks, dados de RSC etc.),
     * senão o painel pode renderizar sem estilos em alguns proxies/hosts.
     */
    '/((?!_next/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
