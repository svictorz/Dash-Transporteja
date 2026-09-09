import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

/**
 * Origem pública da requisição.
 *
 * Atrás do Traefik, `request.url` carrega o endereço interno do container
 * (`https://0.0.0.0:3000`), e redirecionar para ele leva o usuário a uma
 * página inexistente — foi o que quebrava a recuperação de senha. O domínio
 * real chega em `x-forwarded-host`.
 */
function publicOrigin(request: Request, fallback: string): string {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  if (!host) return fallback

  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0].trim()
  const isLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1')
  const proto = forwardedProto || (isLocal ? 'http' : 'https')

  return `${proto}://${host}`
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/bem-vindo'
  const origin = publicOrigin(request, requestUrl.origin)

  if (code) {
    const supabase = createServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      const redirectUrl = new URL('/login', origin)
      redirectUrl.searchParams.set('erro', 'auth')
      return NextResponse.redirect(redirectUrl)
    }
  }

  const redirectUrl = new URL(next.startsWith('/') ? next : `/${next}`, origin)
  return NextResponse.redirect(redirectUrl)
}
