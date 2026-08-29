import fs from 'node:fs'

const file = 'app/(painel)/performance/page.tsx'
const source = fs.readFileSync(file, 'utf8')

const checks = [
  {
    label: 'defines payment status filter options',
    pattern: /PAYMENT_STATUS_FILTER_OPTIONS\s*=\s*\['Pendente', '50%', '70%', '100%'\]/,
  },
  {
    label: 'tracks client, freight, and driver payment filters',
    pattern: /clientPaymentStatusFilter[\s\S]*freightStatusFilter[\s\S]*driverPaymentStatusFilter/,
  },
  {
    label: 'filters rows by client payment status',
    pattern: /clientPaymentStatusFilter === 'all'[\s\S]*r\.payment_status/,
  },
  {
    label: 'filters rows by freight status',
    pattern: /freightStatusFilter === 'all'[\s\S]*r\.status === freightStatusFilter/,
  },
  {
    label: 'filters rows by driver payment status',
    pattern: /driverPaymentStatusFilter === 'all'[\s\S]*r\.driver_payment_status/,
  },
  {
    label: 'normalizes legacy payment status values',
    pattern: /case 'pending':[\s\S]*return 'Pendente'[\s\S]*case 'paid':[\s\S]*return '100%'[\s\S]*case 'partial':[\s\S]*return '50%'/,
  },
  {
    label: 'driver payment editor uses percentage statuses',
    pattern: /Status pagamento motorista[\s\S]*PAYMENT_STATUS_FILTER_OPTIONS\.map/,
  },
  {
    label: 'renders client payment status filter',
    pattern: /aria-label="Filtrar por status de pagamento do cliente"/,
  },
  {
    label: 'renders freight status filter',
    pattern: /aria-label="Filtrar por status do frete"/,
  },
  {
    label: 'renders driver payment status filter',
    pattern: /aria-label="Filtrar por status de pagamento do motorista"/,
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