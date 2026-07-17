import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { isSuperAdminEmail } from '@/lib/utils/roles'

export async function POST(request: Request) {
  const { userId } = await request.json()
  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'userId é obrigatório' }, { status: 400 })
  }

  const serverClient = createServerClient()
  const { data: { user: caller } } = await serverClient.auth.getUser()
  if (!caller || !isSuperAdminEmail(caller.email)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }
  if (caller.id === userId) {
    return NextResponse.json({ error: 'Você não pode remover o próprio acesso' }, { status: 400 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: target } = await admin
    .from('users')
    .select('email')
    .eq('id', userId)
    .single()

  if (target?.email && isSuperAdminEmail(target.email)) {
    return NextResponse.json({ error: 'O proprietário do sistema não pode ser removido' }, { status: 400 })
  }

  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
