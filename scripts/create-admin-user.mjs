/**
 * Script one-time: remove usuário existente (se houver) e cria
 * admin@transporteja.com com senha 123456.
 *
 * Requer no .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL=
 *   SUPABASE_SERVICE_ROLE_KEY=
 *
 * Executar: node scripts/create-admin-user.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { pathToFileURL } from 'url'
import path from 'path'

const EMAIL = 'admin@transporteja.com'
// Supabase exige senha com no mínimo 6 caracteres; se der erro, mude para '123456'
const PASSWORD = '123456'

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!existsSync(envPath)) {
    console.error('Arquivo .env.local não encontrado na raiz do projeto.')
    process.exit(1)
  }
  const content = readFileSync(envPath, 'utf8')
  const env = {}
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*([^#=]+)=(.*)$/)
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return env
}

async function main() {
  const env = loadEnv()
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    console.error('Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local')
    console.error('A Service Role Key está em: Supabase Dashboard > Project Settings > API')
    process.exit(1)
  }

  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

  // 1) Listar usuários com esse email e remover
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
  if (listError) {
    console.error('Erro ao listar usuários:', listError.message)
    process.exit(1)
  }

  const existing = users.find((u) => u.email?.toLowerCase() === EMAIL.toLowerCase())
  if (existing) {
    const { error: delError } = await supabase.auth.admin.deleteUser(existing.id)
    if (delError) {
      console.error('Erro ao remover usuário antigo:', delError.message)
      process.exit(1)
    }
    console.log('Usuário antigo removido:', EMAIL)
  } else {
    console.log('Nenhum usuário existente com esse email.')
  }

  // 2) Criar novo usuário (role admin para popular public.users via trigger ou metadata)
  const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { name: 'Admin', role: 'admin' }
  })

  if (createError) {
    console.error('Erro ao criar usuário:', createError.message)
    process.exit(1)
  }

  console.log('Usuário criado com sucesso.')
  console.log('  Email:', EMAIL)
  console.log('  Senha:', PASSWORD)
  console.log('  ID:', newUser.user.id)

  // 3) Garantir que public.users tenha o registro com role admin (se o trigger não existir ou não tiver role)
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', newUser.user.id)
    .single()

  if (!profileError && profile && profile.role !== 'admin') {
    const { error: updateError } = await supabase
      .from('users')
      .update({ role: 'admin', name: 'Admin', updated_at: new Date().toISOString() })
      .eq('id', newUser.user.id)
    if (updateError) {
      console.warn('Aviso: não foi possível definir role admin em public.users:', updateError.message)
    } else {
      console.log('Perfil em public.users atualizado para role admin.')
    }
  } else if (profileError) {
    const { error: insertError } = await supabase.from('users').insert({
      id: newUser.user.id,
      email: EMAIL,
      name: 'Admin',
      role: 'admin'
    })
    if (insertError) {
      console.warn('Aviso: inserção em public.users falhou (pode ser trigger já criou):', insertError.message)
    } else {
      console.log('Perfil criado em public.users com role admin.')
    }
  }
}

main()
