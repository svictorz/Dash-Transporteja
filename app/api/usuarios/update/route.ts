import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { isSuperAdminEmail, type DashboardUserRole } from '@/lib/utils/roles'

type AssignableRole = 'admin' | 'financeiro' | 'fiscal' | 'comercial'

const ASSIGNABLE_ROLES: AssignableRole[] = ['admin', 'financeiro', 'fiscal', 'comercial']

function normalizeRole(value: unknown): AssignableRole | undefined | null {
  if (value === undefined) return undefined
  if (typeof value !== 'string') return null
  return ASSIGNABLE_ROLES.includes(value as AssignableRole) ? (value as AssignableRole) : null
}

function normalizeCommissionRate(value: unknown): number | undefined | null {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(',', '.'))
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return null
  return Math.round(parsed * 100) / 100
}

export async function POST(request: Request) {
  let payload: Record<string, unknown>
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Dados invalidos' }, { status: 400 })
  }

  const userId = typeof payload.userId === 'string' ? payload.userId : ''
  const role = normalizeRole(payload.role)
  const commissionRate = normalizeCommissionRate(payload.commissionRate)

  if (!userId) {
    return NextResponse.json({ error: 'userId e obrigatorio' }, { status: 400 })
  }
  if (role === null) {
    return NextResponse.json({ error: 'Funcao invalida' }, { status: 400 })
  }
  if (commissionRate === null) {
    return NextResponse.json({ error: 'Comissao deve estar entre 0 e 100' }, { status: 400 })
  }
  if (role === undefined && commissionRate === undefined) {
    return NextResponse.json({ error: 'Nenhuma alteracao informada' }, { status: 400 })
  }

  const serverClient = createServerClient()
  const { data: { user: caller } } = await serverClient.auth.getUser()
  if (!caller || !isSuperAdminEmail(caller.email)) {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 403 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Supabase nao configurado' }, { status: 500 })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: target, error: targetError } = await admin
    .from('users')
    .select('id, email, role, commission_rate')
    .eq('id', userId)
    .single()

  if (targetError || !target) {
    return NextResponse.json({ error: targetError?.message ?? 'Usuario nao encontrado' }, { status: 404 })
  }

  if (target.email && isSuperAdminEmail(target.email) && role !== undefined && role !== 'admin') {
    return NextResponse.json({ error: 'Super admins nao podem deixar de ser administradores' }, { status: 400 })
  }

  const update: { role?: DashboardUserRole; commission_rate?: number } = {}
  if (role !== undefined) update.role = role as DashboardUserRole
  if (commissionRate !== undefined) update.commission_rate = commissionRate

  const { data: savedProfile, error: updateError } = await admin
    .from('users')
    .update(update)
    .eq('id', userId)
    .select('id, email, name, role, commission_rate, created_at')
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  if (role !== undefined) {
    await admin.auth.admin.updateUserById(userId, { app_metadata: { role } })
  }

  return NextResponse.json({ user: savedProfile })
}

