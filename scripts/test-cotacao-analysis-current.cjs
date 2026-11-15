const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const filename = path.resolve(__dirname, '../lib/utils/cotacao-analysis-current.ts')
const context = { exports: {}, require: () => ({}) }
vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context)
const { isAnalysisCurrent } = context.exports

const draft = { origem: 'São Paulo/SP', destino: 'Alvorada/TO', pesoKg: 3585, cubagemM3: 2.81, valorNota: 14916.47, marginPercent: 20, cliente: 'Nicole' }
const analysis = { snapshot: { draft, distance_km: 1284.8 } }
assert.equal(isAnalysisCurrent(analysis, draft, 1284.8), true)
assert.equal(isAnalysisCurrent(analysis, { ...draft, pesoKg: 4000 }, 1284.8), false)
assert.equal(isAnalysisCurrent(analysis, { ...draft, destino: 'Palmas/TO' }, 1284.8), false)
assert.equal(isAnalysisCurrent(analysis, { ...draft, marginPercent: 25 }, 1284.8), false)
assert.equal(isAnalysisCurrent(analysis, { ...draft, linearMeters: 2.4 }, 1284.8), false)
assert.equal(isAnalysisCurrent(analysis, { ...draft, selectedVehicleName: 'Truck' }, 1284.8), false)
assert.equal(isAnalysisCurrent(analysis, draft, 1207), false)
assert.equal(isAnalysisCurrent(null, draft, 1284.8), false)
console.log('PASS: análise antiga não é exibida após editar dados de preço')
