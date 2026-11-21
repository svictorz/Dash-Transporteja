const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const source = fs.readFileSync(path.resolve(__dirname, '../lib/services/cotacao-route.ts'), 'utf8')
const requests = []
const context = {
  exports: {},
  process: { env: {} },
  URL,
  setTimeout: (callback) => callback(),
  fetch: async (url) => {
    requests.push(new URL(url))
    return { ok: true, json: async () => requests.length === 1 ? [] : [{ lat: '-21.135', lon: '-44.261', display_name: 'São João del Rei, Minas Gerais, Brasil' }] }
  },
}
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context)

context.exports.nominatimSearchBrasil('São João del Rei/MG').then((result) => {
  assert.equal(requests.length, 2)
  assert.equal(requests[0].searchParams.get('city'), 'São João del Rei')
  assert.equal(requests[0].searchParams.get('state'), 'Minas Gerais')
  assert.equal(requests[1].searchParams.get('q'), 'São João del Rei, Minas Gerais, Brasil')
  assert.equal(result.lat, -21.135)
  assert.equal(result.lon, -44.261)
  console.log('PASS: busca de cidade/UF com fallback geográfico')
}).catch((error) => { console.error(error); process.exitCode = 1 })
