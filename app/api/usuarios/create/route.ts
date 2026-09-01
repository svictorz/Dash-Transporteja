import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { isSuperAdminEmail, type DashboardUserRole } from '@/lib/utils/roles'

type AssignableRole = 'admin' | 'financeiro' | 'fiscal' | 'supervisor' | 'comercial'

const ASSIGNABLE_ROLES: AssignableRole[] = ['admin', 'financeiro', 'fiscal', 'supervisor', 'comercial']

function normalizeEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function normalizeName(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeRole(value: unknown): AssignableRole | null {
  if (typeof value !== 'string') return null
  return ASSIGNABLE_ROLES.includes(value as AssignableRole) ? (value as AssignableRole) : null
}

function normalizeCommissionRate(value: unknown) {
  if (value === undefined || value === null || value === '') return 0
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

  const email = normalizeEmail(payload.email)
  const name = normalizeName(payload.name)
  const password = typeof payload.password === 'string' ? payload.password : ''
  const role = normalizeRole(payload.role)
  const commissionRate = normalizeCommissionRate(payload.commissionRate)

  if (!name) {
    return NextResponse.json({ error: 'Nome e obrigatorio' }, { status: 400 })
  }
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'E-mail invalido' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'A senha precisa ter pelo menos 6 caracteres' }, { status: 400 })
  }
  if (!role) {
    return NextResponse.json({ error: 'Funcao invalida' }, { status: 400 })
  }
  if (commissionRate === null) {
    return NextResponse.json({ error: 'Comissao deve estar entre 0 e 100' }, { status: 400 })
  }

  const serverClient = createServerClient()
  const {
    data: { user: caller },
  } = await serverClient.auth.getUser()

  if (!caller) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
  }

  const { data: callerProfile } = await serverClient
    .from('users')
    .select('role')
    .eq('id', caller.id)
    .single()

  const callerIsSuperAdmin = isSuperAdminEmail(caller.email)
  const callerIsAdmin = callerProfile?.role === 'admin'

  if (!callerIsSuperAdmin && !callerIsAdmin) {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 403 })
  }
  if (!callerIsSuperAdmin && role === 'admin') {
    return NextResponse.json(
      { error: 'Apenas o super admin pode criar outro administrador' },
      { status: 403 },
    )
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Supabase nao configurado' }, { status: 500 })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
    app_metadata: { role },
  })

  if (createError || !created.user) {
    const message = createError?.message ?? 'Erro ao criar usuario'
    const isDuplicate = /already|registered|exists/i.test(message)
    return NextResponse.json(
      { error: isDuplicate ? 'Este e-mail ja esta cadastrado' : message },
      { status: isDuplicate ? 409 : 500 },
    )
  }

  const profile = {
    id: created.user.id,
    email,
    name,
    role: role as DashboardUserRole,
    commission_rate: role === 'comercial' ? commissionRate : 0,
    onboarding_completed: true,
  }

  const { data: savedProfile, error: profileError } = await admin
    .from('users')
    .upsert(profile, { onConflict: 'id' })
    .select('id, email, name, role, commission_rate, created_at')
    .single()

  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({ user: savedProfile }, { status: 201 })
}
