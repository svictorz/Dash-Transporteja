import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/dashboard/bem-vindo'

  if (code) {
    const supabase = createServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      const redirectUrl = new URL('/login', requestUrl.origin)
      redirectUrl.searchParams.set('erro', 'auth')
      return NextResponse.redirect(redirectUrl)
    }
  }

  const redirectUrl = new URL(next.startsWith('/') ? next : `/${next}`, requestUrl.origin)
  return NextResponse.redirect(redirectUrl)
}
