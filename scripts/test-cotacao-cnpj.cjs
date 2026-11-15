const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const filename = path.resolve(__dirname, '../lib/utils/cotacao-cnpj.ts')
const context = { exports: {}, require: () => ({}) }
vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context)
const { applyCnpjLocation } = context.exports

const original = { origem: 'Campinas/SP', destino: 'Palmas/TO', pesoKg: 3585, valorNota: 14916.47 }
const company = { companyName: 'RMX Proteção', cnpj: '57.938.158/0001-24', address: 'R. Volter Volthers, 10', neighborhood: 'Vila Maria Alta', city: 'São Paulo', state: 'SP', cep: '02129-010' }
const sender = applyCnpjLocation(original, 'remetente', company)
assert.equal(sender.origem, 'São Paulo/SP')
assert.equal(sender.destino, 'Palmas/TO')
assert.equal(sender.remetenteCnpj, company.cnpj)
assert.equal(sender.remetenteNome, company.companyName)
assert.match(sender.remetenteEndereco, /R\. Volter Volthers, 10/)
assert.equal(sender.pesoKg, 3585)
assert.equal(original.origem, 'Campinas/SP')

const recipient = applyCnpjLocation(sender, 'destinatario', { ...company, companyName: 'Município de Alvorada', cnpj: '01.800.242/0001-22', city: 'Alvorada', state: 'TO' })
assert.equal(recipient.destino, 'Alvorada/TO')
assert.equal(recipient.origem, 'São Paulo/SP')
assert.equal(recipient.remetenteCnpj, company.cnpj)
assert.equal(recipient.destinatarioCnpj, '01.800.242/0001-22')
assert.throws(() => applyCnpjLocation(original, 'remetente', { ...company, city: '' }), /município/i)
console.log('PASS: CNPJ atualiza apenas a ponta correspondente e preserva os demais dados')
