import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PANEL_ROLES,
  canCreateClients,
  canManageFinancials,
  canEditPerformance,
  canSupervisorAccessPanelPath,
  canViewRouteInRoutesPage,
  dashboardRoleLabel,
  isGlobalPerformanceViewer,
  shouldScopeOperationalDataToOwner,
} from './roles.ts'

test('supervisor can access panel and view global performance without edit privileges', () => {
  assert.equal(PANEL_ROLES.includes('supervisor'), true)
  assert.equal(dashboardRoleLabel('supervisor'), 'Supervisor')
  assert.equal(isGlobalPerformanceViewer('supervisor'), true)
  assert.equal(canEditPerformance('supervisor'), false)
})

test('admin, financeiro and fiscal keep global performance edit privileges', () => {
  for (const role of ['admin', 'financeiro', 'fiscal']) {
    assert.equal(isGlobalPerformanceViewer(role), true)
    assert.equal(canEditPerformance(role), true)
  }
})

test('comercial remains scoped to own performance data', () => {
  assert.equal(isGlobalPerformanceViewer('comercial'), false)
  assert.equal(canEditPerformance('comercial'), false)
})

test('routes page only shows freights created by the current user', () => {
  for (const role of ['admin', 'financeiro', 'fiscal', 'supervisor', 'comercial']) {
    assert.equal(canViewRouteInRoutesPage(role, 'user-1', 'user-1'), true)
    assert.equal(canViewRouteInRoutesPage(role, 'user-1', 'user-2'), false)
    assert.equal(canViewRouteInRoutesPage(role, 'user-1', null), false)
  }
})
test('supervisor can access operational pages but not financial control or permissions', () => {
  for (const path of [
    '/inicio',
    '/clientes',
    '/rotas',
    '/rotas/nova',
    '/propostas',
    '/calendario',
    '/performance',
    '/configuracoes',
    '/dados-pessoais',
  ]) {
    assert.equal(canSupervisorAccessPanelPath(path), true, path)
  }

  for (const path of [
    '/controle-financeiro',
    '/controle-financeiro/detalhes',
    '/usuarios',
    '/usuarios/novo',
  ]) {
    assert.equal(canSupervisorAccessPanelPath(path), false, path)
  }
})

test('supervisor keeps operational data scoped to the owner outside performance', () => {
  assert.equal(shouldScopeOperationalDataToOwner('supervisor'), true)
  assert.equal(shouldScopeOperationalDataToOwner('comercial'), true)
  assert.equal(shouldScopeOperationalDataToOwner('admin'), false)
  assert.equal(shouldScopeOperationalDataToOwner('financeiro'), false)
  assert.equal(shouldScopeOperationalDataToOwner('fiscal'), false)
})

test('fiscal cannot create clients; supervisor can', () => {
  for (const role of ['admin', 'financeiro', 'comercial', 'supervisor']) {
    assert.equal(canCreateClients(role), true, role)
  }
  assert.equal(canCreateClients('fiscal'), false)
  assert.equal(canCreateClients('driver'), false)
  assert.equal(canCreateClients(null), false)
})

test('admin, financeiro and fiscal manage the financial control screen', () => {
  for (const role of ['admin', 'financeiro', 'fiscal']) {
    assert.equal(canManageFinancials(role), true, role)
  }
  for (const role of ['comercial', 'supervisor', 'driver', null]) {
    assert.equal(canManageFinancials(role), false, String(role))
  }
})
