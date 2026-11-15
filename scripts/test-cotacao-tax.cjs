const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const filename = path.resolve(__dirname, '../lib/utils/cotacao-tax.ts')
const context = { exports: {} }
vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context)
const { parseCotacaoTaxPercent } = context.exports

assert.equal(parseCotacaoTaxPercent('17,93'), 17.93)
assert.equal(parseCotacaoTaxPercent('0'), 0)
assert.equal(parseCotacaoTaxPercent(''), null)
assert.equal(parseCotacaoTaxPercent('-1'), null)
assert.equal(parseCotacaoTaxPercent('101'), null)
console.log('PASS: validação do total de tributos da cotação')
