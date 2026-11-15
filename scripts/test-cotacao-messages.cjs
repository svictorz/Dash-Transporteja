const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const filename = path.resolve(__dirname, '../lib/utils/cotacao-messages.ts')
const context = { exports: {}, require: () => ({}) }
vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context)
const { cotacaoMessage, cotacaoAd, cotacaoWhatsAppLink, defaultCotacaoTemplates, validateCotacaoTemplates, defaultCotacaoTitles, validateCotacaoTitles } = context.exports

const draft = { origem: 'São Paulo/SP', destino: 'Alvorada/TO', pesoKg: 3585, valorNota: 14916.47, cliente: 'Nicole', telefone: '(11) 9 6451-3724' }
assert.equal(cotacaoMessage(draft, 'Abordagem inicial'), 'Olá, Nicole! A carga de São Paulo/SP para Alvorada/TO ainda está disponível? Posso enviar uma cotação?')
assert.match(cotacaoMessage(draft, 'Confirmação de dados'), /3\.585 kg/)
assert.match(cotacaoAd(draft), /NF: R\$\s?14\.916,47/)
assert.equal(cotacaoWhatsAppLink(draft.telefone, 'Teste'), 'https://wa.me/5511964513724?text=Teste')
assert.equal(cotacaoWhatsAppLink('(11) 2768-5200', 'Teste'), 'https://wa.me/551127685200?text=Teste')
assert.equal(cotacaoWhatsAppLink('123', 'Teste'), null)
assert.equal(cotacaoMessage(draft, 'Apresentação de valores'), '')
assert.equal(cotacaoMessage(draft, 'Proposta fracionado'), '')
assert.match(cotacaoMessage(draft, 'Proposta fracionado', { fracionado: 7480.24, dedicado: 12389.51 }), /R\$\s?7\.480,24/)
assert.doesNotMatch(cotacaoMessage(draft, 'Proposta fracionado', { fracionado: 7480.24, dedicado: 12389.51 }), /12\.389,51/)
const templates = { ...defaultCotacaoTemplates, 'Abordagem inicial': 'Pedido de {origem} até {destino} para {cliente}.' }
assert.equal(validateCotacaoTemplates(templates), null)
assert.equal(cotacaoMessage(draft, 'Abordagem inicial', undefined, templates), 'Pedido de São Paulo/SP até Alvorada/TO para Nicole.')
assert.match(validateCotacaoTemplates({ ...templates, 'Abordagem inicial': 'Preço {precoFracionado}' }), /inválida/)
assert.match(validateCotacaoTemplates({ ...templates, 'Abordagem inicial': 'Olá {cliente' }), /incompletas/)
assert.equal(validateCotacaoTitles(defaultCotacaoTitles), null)
assert.equal(validateCotacaoTitles({ ...defaultCotacaoTitles, 'Abordagem inicial': 'Primeiro contato' }), null)
assert.match(validateCotacaoTitles({ ...defaultCotacaoTitles, 'Abordagem inicial': '  ' }), /Revise/)
assert.match(validateCotacaoTitles({ ...defaultCotacaoTitles, 'Abordagem inicial': 'Acompanhamento' }), /diferentes/)
console.log('PASS: mensagens e WhatsApp da cotação')
