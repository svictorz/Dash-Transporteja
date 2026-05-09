import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isPainelPath } from '@/lib/constants/painel-routes'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() revalida o JWT com o servidor Auth (mais seguro que getSession(), que pode
  // confiar só no cookie). Mantém refresh de sessão via setAll nos cookies.
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isPainel = isPainelPath(pathname)
  const isDev = process.env.NODE_ENV === 'development'

  // Em desenvolvimento: deixar o layout do painel fazer o redirect se não houver sessão,
  // para evitar bloqueio quando os cookies não forem lidos corretamente no middleware (ex.: localhost).
  if ((!user || userError) && isPainel && !isDev) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && !userError && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/inicio'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
