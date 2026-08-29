import fs from 'node:fs'

const checks = [
  {
    label: 'routes type exposes vale_pedagio_incluso',
    file: 'lib/services/routes.ts',
    pattern: /vale_pedagio_incluso\?: boolean \| null/,
  },
  {
    label: 'financial control persists vale_pedagio_incluso',
    file: 'app/(painel)/controle-financeiro/page.tsx',
    pattern: /vale_pedagio_incluso:\s*valePedagioIncluso/,
  },
  {
    label: 'financial control renders Incluso selector',
    file: 'app/(painel)/controle-financeiro/page.tsx',
    pattern: /<option value="true">\u2705<\/option>[\s\S]*<option value="false">\u274c<\/option>/,
  },
  {
    label: 'migration adds vale_pedagio_incluso column',
    file: 'supabase/migrations/040_routes_vale_pedagio_incluso.sql',
    pattern: /ADD COLUMN IF NOT EXISTS vale_pedagio_incluso BOOLEAN/,
  },
]

let failed = false

for (const check of checks) {
  if (!fs.existsSync(check.file)) {
    console.error(`FAIL ${check.label}: missing ${check.file}`)
    failed = true
    continue
  }

  const content = fs.readFileSync(check.file, 'utf8')
  if (!check.pattern.test(content)) {
    console.error(`FAIL ${check.label}`)
    failed = true
  } else {
    console.log(`PASS ${check.label}`)
  }
}

async function loadFinancials() {
  const ts = await import('typescript')
  const source = fs.readFileSync('lib/utils/freight-financials.ts', 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText

  const module = { exports: {} }
  const fn = new Function('exports', 'module', 'require', compiled)
  fn(module.exports, module, () => ({}))
  return module.exports
}

const financials = await loadFinancials()

const includedRoute = {
  freight_value: 1000,
  nf_value: null,
  driver_value: 200,
  taxes_percent: 18,
  taxes_value: null,
  seguro_percent: 0,
  seguro_value: 10,
  net_freight_value: null,
  commission_value: null,
  vale_pedagio: 100,
  vale_pedagio_incluso: true,
}
const notIncludedRoute = { ...includedRoute, vale_pedagio_incluso: false }

const includedNet = financials.getRouteNetFreightValue(includedRoute)
const notIncludedNet = financials.getRouteNetFreightValue(notIncludedRoute)
const includedCommission = financials.getRouteCommissionValue(includedRoute, 30)
const notIncludedCommission = financials.getRouteCommissionValue(notIncludedRoute, 30)

if (includedNet !== 510) {
  console.error(`FAIL included vale pedagio discounts net freight: expected 510, got ${includedNet}`)
  failed = true
} else {
  console.log('PASS included vale pedagio discounts net freight')
}

if (notIncludedNet !== 610) {
  console.error(`FAIL not included vale pedagio keeps net freight: expected 610, got ${notIncludedNet}`)
  failed = true
} else {
  console.log('PASS not included vale pedagio keeps net freight')
}

if (includedCommission !== 153) {
  console.error(`FAIL included vale pedagio discounts commission: expected 153, got ${includedCommission}`)
  failed = true
} else {
  console.log('PASS included vale pedagio discounts commission')
}

if (notIncludedCommission !== 183) {
  console.error(`FAIL not included vale pedagio keeps commission: expected 183, got ${notIncludedCommission}`)
  failed = true
} else {
  console.log('PASS not included vale pedagio keeps commission')
}

if (failed) {
  process.exit(1)
}
