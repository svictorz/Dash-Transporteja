import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export async function middleware(request: NextRequest) {
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
