import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PANEL_ROLES,
  canEditPerformance,
  canViewRouteInRoutesPage,
  dashboardRoleLabel,
  isGlobalPerformanceViewer,
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
