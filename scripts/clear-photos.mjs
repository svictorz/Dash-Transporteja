import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) {
    throw new Error('.env.local não encontrado')
  }

  const raw = fs.readFileSync(envPath, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1).trim()
    if (!(key in process.env)) process.env[key] = value
  }
}

async function listFilesRecursively(client, bucket, prefix = '') {
  const paths = []
  let offset = 0

  while (true) {
    const { data, error } = await client.storage.from(bucket).list(prefix, {
      limit: 100,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    })

    if (error) {
      // Bucket inexistente ou sem acesso: tratar como vazio.
      if (error.message?.toLowerCase().includes('not found')) return paths
      throw new Error(`Erro ao listar ${bucket}/${prefix || ''}: ${error.message}`)
    }

    if (!data || data.length === 0) break

    for (const item of data) {
      const itemPath = prefix ? `${prefix}/${item.name}` : item.name
      const isFolder = item.id == null
      if (isFolder) {
        const nested = await listFilesRecursively(client, bucket, itemPath)
        paths.push(...nested)
      } else {
        paths.push(itemPath)
      }
    }

    if (data.length < 100) break
    offset += 100
  }

  return paths
}

async function removeInChunks(client, bucket, filePaths) {
  if (!filePaths.length) return 0
  let removed = 0
  const chunkSize = 100

  for (let i = 0; i < filePaths.length; i += chunkSize) {
    const chunk = filePaths.slice(i, i + chunkSize)
    const { error } = await client.storage.from(bucket).remove(chunk)
    if (error) throw new Error(`Erro ao remover no bucket ${bucket}: ${error.message}`)
    removed += chunk.length
  }

  return removed
}

async function main() {
  loadEnvLocal()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Variáveis NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes')
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const buckets = ['checkin-photos', 'transport-photos']
  for (const bucket of buckets) {
    const files = await listFilesRecursively(client, bucket)
    const count = await removeInChunks(client, bucket, files)
    console.log(`Bucket ${bucket}: ${count} arquivo(s) removido(s).`)
  }

  const { error: checkinsError } = await client.from('checkins').delete().not('id', 'is', null)
  if (checkinsError) throw new Error(`Erro ao limpar checkins: ${checkinsError.message}`)

  console.log('Tabela public.checkins limpa com sucesso.')
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})

