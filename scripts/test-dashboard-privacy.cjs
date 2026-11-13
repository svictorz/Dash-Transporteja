// Render the real dashboard: hidden amounts must be absent, including SVG/ARIA tooltips.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const root = path.resolve(__dirname, '..'), modules = new Map()
function load(file) {
  const filename = path.resolve(root, file)
  if (modules.has(filename)) return modules.get(filename)
  const context = { exports: {}, require(name) {
    if (name === '@/lib/hooks/useMonthlySalesGoals') return { useMonthlySalesGoals() { throw Error('View test must not load authenticated data') } }
    if (name.startsWith('@/') || name.startsWith('.')) {
      const base = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(filename), name)
      return load(base + (fs.existsSync(base + '.tsx') ? '.tsx' : '.ts'))
    }
    return require(name)
  } }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText, context, { filename })
  modules.set(filename, context.exports)
  return context.exports
}
const { DashboardOverview } = load('components/dashboard/DashboardOverview.tsx')
const { MonthlyGoalView } = load('components/dashboard/MonthlyGoalCard.tsx')
const { buildDashboardMetrics } = load('lib/utils/dashboard-metrics.ts')
const route = { id: 'one', freight_id: 321, created_by_user_id: 'seller', created_at: '2026-11-07T12:00:00Z', pickup_date: '2026-11-07', status: 'inTransit', company_name: 'Cliente teste', origin: 'São Paulo', origin_state: 'SP', destination: 'Aracaju', destination_state: 'SE', freight_value: 9876.54, driver_value: 4000, taxes_percent: 18, seguro_percent: 0.2, net_freight_value: 2456.78, commission_value: 654.32 }
const metrics = buildDashboardMetrics([route], 'seller', 'month', new Date(2026, 10, 7))
const render = showValues => renderToStaticMarkup(React.createElement(DashboardOverview, {
  metrics, period: 'month', onPeriodChange() {}, onRefresh() {}, refreshing: false, isAdmin: false,
  savingCommissionId: null, onToggleCommission() {}, showValues, onToggleValues() {},
  customRange: { start: '2026-11-01', end: '2026-11-07' },
  customDraft: { start: '2026-11-01', end: '2026-11-10' },
  goal: React.createElement(MonthlyGoalView, { revenue: 9876.54, amount: 15000, netRevenue: 2456.78, netAmount: 4000, monthLabel: 'novembro de 2026', loading: false, error: null, showValues }),
}))
const shown = render(true), hidden = render(false)
assert.ok(!shown.includes('Data inicial do Dashboard') && !shown.includes('Data final do Dashboard') && !shown.includes('>Aplicar</button>'), 'Date fields must stay hidden outside Personalizado')
assert.ok(shown.includes('Cadastros no período selecionado'))
assert.ok(shown.includes('Quantidade de fretes por dia no período selecionado'))
const custom = renderToStaticMarkup(React.createElement(DashboardOverview, {
  metrics, period: 'custom', onPeriodChange() {}, onRefresh() {}, refreshing: false, isAdmin: false,
  savingCommissionId: null, onToggleCommission() {}, showValues: true, onToggleValues() {},
  customRange: { start: '2026-11-01', end: '2026-11-07' },
  customDraft: { start: '2026-11-01', end: '2026-11-10' },
  onCustomDraftChange() {}, onApplyCustomRange() {},
  goal: React.createElement(MonthlyGoalView, { revenue: 9876.54, amount: 15000, netRevenue: 2456.78, netAmount: 4000, monthLabel: 'novembro de 2026', loading: false, error: null }),
}))
for (const option of ['7 dias', '15 dias', 'Este mês', 'Mês passado', 'Todo o período', 'Personalizado']) assert.ok(custom.includes(option), `Missing period ${option}`)
assert.ok(custom.includes('Data inicial do Dashboard') && custom.includes('Data final do Dashboard'))
assert.ok(custom.includes('Clique em Aplicar para atualizar os indicadores.'))
for (const value of ['9.876,54', '654,32', '2.456,78', '4.000,00', '15.000,00', '5.123,46', '65,8%']) {
  assert.ok(shown.includes(value), `Visible mode should show ${value}`)
  assert.ok(!hidden.includes(value), `Hidden mode must remove ${value}`)
}
assert.ok(shown.includes('Lucro líquido do mês'))
assert.ok(shown.includes('Meta de lucro líquido'))
assert.ok(shown.includes('#22c55e'), 'The inner profit gauge must be green')
assert.ok(!hidden.includes('Lucro líquido do mês'))
assert.ok(!hidden.includes('9,9 mil'), 'Revenue axis must be hidden too')
assert.ok(!hidden.includes('pathLength="100"'), 'Goal gauge must not disclose its percentage')
assert.ok(hidden.includes('R$ ••••••'))
assert.ok(hidden.includes('Mostrar valores do Dashboard'))
assert.ok(shown.includes('Ocultar valores do Dashboard'))
assert.ok(hidden.includes('Cliente teste') && hidden.includes('São Paulo') && hidden.includes('#321'), 'Keep operational data visible')

// Exercise the real page's preference loading and toggle without an authenticated server.
function pageHarness(storage) {
  const state = [], effects = []
  let cursor = 0
  const react = { ...React, useState(initial) {
    const index = cursor++
    if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial
    return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value }]
  }, useMemo: fn => fn(), useEffect: effect => effects.push(effect) }
  const context = { exports: {}, localStorage: storage, setInterval() { return 1 }, clearInterval() {}, require(name) {
    if (name === 'react') return react
    if (name === '@/lib/hooks/useRoutes') return { useRoutes: () => ({ routes: [route], loading: false }) }
    if (name === '@/lib/hooks/useAuthState') return { useAuthState: () => ({ session: { user: { id: 'seller' } }, loading: false }) }
    if (name === '@/lib/hooks/useCurrentUser') return { useCurrentUser: () => ({ user: { role: 'comercial' } }) }
    if (name === '@/components/transporteja/BrandLoading') return { default: () => null }
    return name.startsWith('@/') ? load(name.slice(2) + (name.startsWith('@/components/') ? '.tsx' : '.ts')) : require(name)
  } }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, 'app/(painel)/inicio/page.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText, context)
  function render() { cursor = 0; return context.exports.default() }
  render()
  for (const effect of effects.splice(0)) effect()
  return () => React.Children.toArray(render().props.children).find(child => child.type === DashboardOverview).props
}
const storage = new Map([['dashboard:showValues', 'false']])
const preference = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }
const page = pageHarness(preference)
assert.equal(page().showValues, false, 'Restore the hidden preference before showing the dashboard')
page().onToggleValues()
assert.equal(page().showValues, true)
assert.equal(storage.get('dashboard:showValues'), 'true')
page().onToggleValues()
assert.equal(pageHarness(preference)().showValues, false, 'Hidden preference must survive remount')
const blockedStorage = pageHarness({ getItem() { throw Error('Blocked') }, setItem() { throw Error('Blocked') } })
blockedStorage().onToggleValues()
assert.equal(blockedStorage().showValues, false, 'Toggle must still work if storage is blocked')
const customStorage = new Map([['dashboard:period', 'custom']])
const customPreference = { getItem: key => customStorage.get(key) ?? null, setItem: (key, value) => customStorage.set(key, value) }
const customPage = pageHarness(customPreference)
assert.equal(customPage().period, 'custom')
customPage().onCustomDraftChange('start', '2026-11-03')
customPage().onCustomDraftChange('end', '2026-11-08')
customPage().onApplyCustomRange()
assert.equal(customPage().customRange.start, '2026-11-03')
assert.equal(customPage().customRange.end, '2026-11-08')
assert.deepEqual(JSON.parse(customStorage.get('dashboard:customRange')), { start: '2026-11-03', end: '2026-11-08' })
customPage().onCustomDraftChange('start', '2026-11-10')
customPage().onApplyCustomRange()
assert.equal(customPage().customRange.start, '2026-11-03', 'Invalid range must retain the last applied dates')
assert.match(customPage().customError, /intervalo válido/i)
console.log('PASS: dashboard amounts, percentages, goal gauge, chart and accessible tooltips are masked while routes stay visible')
