import { readFileSync, existsSync } from 'node:fs'

const checks = [
  {
    name: 'roles helper exposes fiscal as dashboard role',
    file: 'lib/utils/roles.ts',
    includes: [
      "'fiscal'",
      "PANEL_ROLES = ['admin', 'comercial', 'financeiro', 'fiscal']",
      "case 'fiscal':",
      "role === 'fiscal'",
    ],
  },
  {
    name: 'performance grants fiscal admin/financeiro access and observations editing',
    file: 'app/(painel)/performance/page.tsx',
    includes: [
      "type UserRole = 'admin' | 'comercial' | 'financeiro' | 'fiscal'",
      "userRole === 'fiscal'",
      "role === 'fiscal'",
      "role === 'financeiro' || role === 'fiscal'",
      'handleSaveObservation',
      'editingObservation',
      'savingObservation',
      'Observações',
      "supabase.rpc('update_route_observation'",
    ],
  },
  {
    name: 'users UI can assign fiscal role',
    file: 'app/(painel)/usuarios/page.tsx',
    includes: [
      "type AssignableRole = 'admin' | 'comercial' | 'financeiro' | 'fiscal'",
      "value: 'fiscal'",
      "Fiscal",
      "let fiscal = 0",
      "'admin', 'financeiro', 'fiscal', 'comercial'",
    ],
  },
  {
    name: 'users APIs accept fiscal role',
    file: 'app/api/usuarios/create/route.ts',
    includes: [
      "type AssignableRole = 'admin' | 'financeiro' | 'fiscal' | 'comercial'",
      "['admin', 'financeiro', 'fiscal', 'comercial']",
    ],
  },
  {
    name: 'users update API accepts fiscal role',
    file: 'app/api/usuarios/update/route.ts',
    includes: [
      "type AssignableRole = 'admin' | 'financeiro' | 'fiscal' | 'comercial'",
      "['admin', 'financeiro', 'fiscal', 'comercial']",
    ],
  },
  {
    name: 'supabase local types include fiscal',
    file: 'lib/supabase/types.ts',
    includes: [
      "'admin' | 'comercial' | 'financeiro' | 'fiscal' | 'driver'",
      "role?: 'admin' | 'comercial' | 'financeiro' | 'fiscal' | 'driver'",
    ],
  },
  {
    name: 'migration allows fiscal in database and RLS helper',
    file: 'supabase/migrations/041_users_fiscal_role.sql',
    includes: [
      "CHECK (role IN ('admin', 'comercial', 'financeiro', 'fiscal', 'driver'))",
      "ARRAY['admin', 'financeiro', 'fiscal']::text[]",
    ],
  },
]

let failures = 0

for (const check of checks) {
  if (!existsSync(check.file)) {
    failures += 1
    console.error(`FAIL ${check.name}: missing file ${check.file}`)
    continue
  }
  const content = readFileSync(check.file, 'utf8')
  const missing = check.includes.filter((needle) => !content.includes(needle))
  if (missing.length > 0) {
    failures += 1
    console.error(`FAIL ${check.name}: missing ${missing.map((m) => JSON.stringify(m)).join(', ')}`)
  } else {
    console.log(`PASS ${check.name}`)
  }
}

if (failures > 0) process.exit(1)
