import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateNetFreightValue,
  isValePedagioIncluso,
} from './freight-financials.ts'

test('vale pedagio defaults to incluso unless explicitly false', () => {
  assert.equal(isValePedagioIncluso(true), true)
  assert.equal(isValePedagioIncluso(null), true)
  assert.equal(isValePedagioIncluso(undefined), true)
  assert.equal(isValePedagioIncluso(false), false)
})

test('net freight discounts vale pedagio for old records without explicit flag', () => {
  assert.equal(calculateNetFreightValue(1000, 300, 0, 0, 50, null), 650)
  assert.equal(calculateNetFreightValue(1000, 300, 0, 0, 50, undefined), 650)
  assert.equal(calculateNetFreightValue(1000, 300, 0, 0, 50, false), 700)
})
