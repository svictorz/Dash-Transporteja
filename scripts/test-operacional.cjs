const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')
const source = fs.readFileSync('lib/utils/roles.ts', 'utf8')
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const context = { exports: {} }
vm.runInNewContext(output, context)
const r = context.exports
for (const [role, global, edit, finance] of [
  ['admin', true, true, true], ['financeiro', true, true, true],
  ['fiscal', true, true, true], ['supervisor', true, false, false],
  ['comercial', false, false, false], ['operator', false, false, false],
  ['driver', false, false, false], [null, false, false, false],
  ['operacional', true, false, false],
]) {
  assert.equal(r.isGlobalPerformanceViewer(role), global, `${role}: global`)
  assert.equal(r.canEditPerformance(role), edit, `${role}: broad edit`)
  assert.equal(r.canManageFinancials(role), finance, `${role}: financial area`)
}
assert.equal(r.dashboardRoleLabel('operator'), 'Comercial')
assert.equal(r.dashboardRoleLabel('operacional'), 'Operacional')
assert.equal(r.PANEL_ROLES.includes('operacional'), true)
for (const role of ['admin', 'financeiro', 'fiscal', 'operacional']) {
  assert.equal(r.canEditPerformanceOperationalFields(role), true)
}
for (const role of ['supervisor', 'comercial', 'operator', 'driver', null]) {
  assert.equal(r.canEditPerformanceOperationalFields(role), false)
}
assert.equal(r.canOperacionalAccessPanelPath('/performance'), true)
assert.equal(r.canOperacionalAccessPanelPath('/usuarios'), false)
for (const path of ['/inicio', '/clientes', '/rotas', '/propostas', '/calendario', '/performance']) {
  assert.equal(r.canOperacionalAccessPanelPath(path), true, path)
}
assert.equal(r.canOperacionalAccessPanelPath('/controle-financeiro'), false)
assert.equal(r.canCreateClients('operacional'), true)
assert.equal(r.shouldScopeOperationalDataToOwner('operacional'), true)
assert.equal(r.isPerformanceSellerRole('operacional'), true)
assert.equal(r.canViewRouteInRoutesPage('operacional', 'me', 'other'), false)
assert.equal(r.canViewRouteInRoutesPage('operacional', 'me', 'me'), true)
console.log('PASS: matriz de permissões antigas e cargo Operacional')
for (const role of ['admin', 'financeiro', 'fiscal', 'operacional']) {
  assert.equal(r.canEditValePedagioIncluso(role), true, role)
}
for (const role of ['comercial', 'operator', 'supervisor', 'driver', null]) {
  assert.equal(r.canEditValePedagioIncluso(role), false, String(role))
}
