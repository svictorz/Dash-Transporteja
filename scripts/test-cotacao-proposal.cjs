const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const filename = path.resolve(__dirname, '../lib/utils/cotacao-proposal.ts')
const context = { exports: {}, require: () => ({}) }
vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context)
const { buildCotacaoProposal } = context.exports
const analysis = {
  id: '12345678-1234-1234-1234-123456789abc', created_at: '2026-11-14T12:00:00Z',
  snapshot: { distance_km: 1284.8, distance_source: 'route-api', rules: { selected_vehicle: '3/4' }, draft: { origem: 'São Paulo/SP', destino: 'Alvorada/TO', cliente: 'Nicole', telefone: '(11) 9 6451-3724', email: 'comercial3@frequenciax.com.br', remetenteCnpj: '57.938.158/0001-24', remetenteNome: 'RMX Proteção', remetenteEndereco: 'R. Volter Volthers, 10 · São Paulo/SP', destinatarioCnpj: '01.800.242/0001-22', destinatarioNome: 'Município de Alvorada', destinatarioEndereco: 'Alvorada/TO', pesoKg: 3585, cubagemM3: 2.81, quantidade: 172, valorNota: 14916.47 } },
  result: { fracionado: { total: 7480.24 }, dedicado: { total: 12389.51 } },
}
const fractional = buildCotacaoProposal(analysis, 'fracionado')
const dedicated = buildCotacaoProposal(analysis, 'dedicado')
assert.equal(fractional.total, 7480.24)
assert.equal(dedicated.total, 12389.51)
assert.equal(fractional.contact, 'Nicole')
assert.equal(fractional.contactPhone, '(11) 9 6451-3724')
assert.equal(fractional.contactEmail, 'comercial3@frequenciax.com.br')
assert.equal(fractional.sender.name, 'RMX Proteção')
assert.equal(fractional.sender.cnpj, '57.938.158/0001-24')
assert.equal(dedicated.recipient.name, 'Município de Alvorada')
assert.equal(fractional.vehicleName, '3/4')
assert.equal(dedicated.vehicleName, '3/4')
assert.equal(fractional.invoiceValue, 14916.47)
assert.equal(fractional.weightKg, 3585)
assert.equal(fractional.code, '12345678')
assert.throws(() => buildCotacaoProposal({ ...analysis, result: { ...analysis.result, fracionado: { total: 0 } } }, 'fracionado'), /insuficientes/)
assert.throws(() => buildCotacaoProposal({ ...analysis, result: { ...analysis.result, fracionado: { total: null } } }, 'fracionado'), /insuficientes/)
assert.equal(buildCotacaoProposal({ ...analysis, snapshot: { ...analysis.snapshot, rules: { ...analysis.snapshot.rules, fractional_vehicle: 'Truck' } } }, 'fracionado').vehicleName, 'Truck')
console.log('PASS: proposta usa snapshot aprovado e valor da modalidade selecionada')
