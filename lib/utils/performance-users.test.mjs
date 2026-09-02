import test from 'node:test'
import assert from 'node:assert/strict'
import { isPerformanceSellerRole } from './roles.ts'

test('performance seller filter includes supervisors who own freight routes', () => {
  for (const role of ['comercial', 'operator', 'admin', 'supervisor']) {
    assert.equal(isPerformanceSellerRole(role), true, role)
  }
})

test('performance seller filter excludes non-seller roles', () => {
  for (const role of ['financeiro', 'fiscal', 'driver', null, undefined]) {
    assert.equal(isPerformanceSellerRole(role), false, String(role))
  }
})
