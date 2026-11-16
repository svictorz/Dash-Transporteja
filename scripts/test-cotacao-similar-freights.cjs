const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const filename = path.resolve(__dirname, '../lib/utils/cotacao-similar-freights.ts')
const context = { exports: {} }
vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context)
const { parseCotacaoLocation, similarFreightsQuery } = context.exports

assert.equal(parseCotacaoLocation('São Paulo/SP').city, 'São Paulo')
assert.equal(parseCotacaoLocation('São Paulo, SP').state, 'SP')
assert.equal(parseCotacaoLocation('São Paulo').state, '')
const params = similarFreightsQuery({ origem: 'São Paulo/SP', destino: 'Alvorada/TO', pesoKg: 3585 }, 1284.8)
assert.equal(params.p_origin_state, 'SP')
assert.equal(params.p_destination_state, 'TO')
assert.equal(params.p_weight_kg, 3585)
assert.equal(params.p_distance_km, 1284.8)
assert.equal(similarFreightsQuery({ origem: 'São Paulo', destino: 'Alvorada/TO', pesoKg: null }, 100), null)
console.log('PASS: filtro de origem/destino para fretes semelhantes')
