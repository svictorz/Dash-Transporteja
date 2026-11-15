const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const source = fs.readFileSync(path.resolve(__dirname, '../lib/services/cnpj.ts'), 'utf8')
const context = {
  exports: {},
  fetch: async () => ({ ok: true, json: async () => ({ cnpj: '57938158000124', razao_social: 'FREQUENCIA X', nome_fantasia: null, logradouro: 'RUA TESTE', numero: '10', complemento: null, bairro: 'CENTRO', municipio: 'SAO PAULO', uf: 'SP', cep: '' }) }),
}
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context)
const { searchCNPJ } = context.exports
;(async () => {
  const client = await searchCNPJ('57938158000124')
  assert.equal(client.success, false)
  const quote = await searchCNPJ('57938158000124', { requireCep: false })
  assert.equal(quote.success, true)
  assert.equal(quote.data.city, 'SAO PAULO')
  assert.equal(quote.data.cep, '')
  console.log('PASS: cotação aceita cidade/UF sem CEP; cadastro de clientes mantém validação atual')
})().catch(error => { console.error(error); process.exitCode = 1 })
