import test from 'node:test'
import assert from 'node:assert/strict'
import * as financials from './freight-financials.ts'
const {
  calculateNetFreightValue,
  isValePedagioIncluso,
  calculateDriverTotalValue,
  getRouteDriverTotalValue,
  getRouteNetFreightValue,
} = financials

test('vale pedagio defaults to incluso unless explicitly false', () => {
  assert.equal(isValePedagioIncluso(true), true)
  assert.equal(isValePedagioIncluso(null), true)
  assert.equal(isValePedagioIncluso(undefined), true)
  assert.equal(isValePedagioIncluso(false), false)
})

test('non-included toll increases driver cost and reduces net exactly once', () => {
  assert.equal(calculateNetFreightValue(1000, 300, 0, 0, 50, false), 650)
  assert.equal(calculateDriverTotalValue(300, 50, false), 350)
  assert.equal(calculateNetFreightValue(1000, 300, 18, 2, 50, false), 468)
})

test('included toll does not change driver cost or net', () => {
  for (const flag of [true, null, undefined]) {
    assert.equal(calculateNetFreightValue(1000, 300, 0, 0, 50, flag), 700)
    assert.equal(calculateDriverTotalValue(300, 50, flag), 300)
  }
})

test('manual tax overrides, including zero, are preserved', () => {
  assert.equal(calculateNetFreightValue(1000, 300, 18, 2, 50, false, 100), 548)
  assert.equal(calculateNetFreightValue(1000, 300, 18, 2, 50, false, 0), 648)
})

test('driver summaries preserve legacy history and do not mutate base amounts', () => {
  const legacy = { driver_value: 300, vale_pedagio: 50, vale_pedagio_incluso: false }
  const current = { ...legacy, financial_calculation_version: 2 }
  assert.equal(getRouteDriverTotalValue(legacy), 300)
  assert.equal(getRouteDriverTotalValue(current), 350)
  assert.equal(getRouteDriverTotalValue(current), 350)
  assert.equal(current.driver_value, 300)
  assert.equal([legacy, current].reduce((sum, route) => sum + getRouteDriverTotalValue(route), 0), 650)
  const oldFreight = { ...legacy, freight_value: 1000, taxes_percent: 0, seguro_percent: 0 }
  assert.equal(getRouteNetFreightValue(oldFreight), 700)
  assert.equal(getRouteNetFreightValue({ ...oldFreight, net_freight_value: 711 }), 711)
  assert.equal(getRouteNetFreightValue({ ...oldFreight, financial_calculation_version: 2 }), 650)
})
