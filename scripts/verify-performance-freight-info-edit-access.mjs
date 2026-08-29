import { readFileSync } from 'node:fs'

const source = readFileSync('app/(painel)/performance/page.tsx', 'utf8')

const checks = [
  {
    label: 'grants modal management to admin, financeiro and fiscal',
    pattern: /canManagePerfModal\s*=\s*role === 'admin' \|\| role === 'financeiro' \|\| role === 'fiscal'/,
  },
  {
    label: 'tracks freight info editing state',
    pattern: /editingFreightInfo[\s\S]*setEditingFreightInfo[\s\S]*editingFreightInfoFields/,
  },
  {
    label: 'saves core freight info fields',
    pattern: /handleSaveFreightInfoFields[\s\S]*company_name[\s\S]*origin[\s\S]*destination[\s\S]*pickup_date[\s\S]*estimated_delivery[\s\S]*payment_status[\s\S]*nf_value[\s\S]*freight_value/,
  },
  {
    label: 'all manager roles can edit seguro percent',
    pattern: /const canEditPerfSeguro = canManagePerfModal[\s\S]*disabled=\{!editingFinancial \|\| savingFinancial \|\| !canEditPerfSeguro\}/,
  },
  {
    label: 'renders freight info editor section',
    pattern: /Informações do frete[\s\S]*handleSaveFreightInfoFields[\s\S]*Nome da empresa[\s\S]*Origem[\s\S]*Destino[\s\S]*Status pagamento cliente/,
  },
]

let failed = false
for (const check of checks) {
  if (!check.pattern.test(source)) {
    console.error(`FAIL ${check.label}`)
    failed = true
  } else {
    console.log(`PASS ${check.label}`)
  }
}

if (failed) process.exit(1)