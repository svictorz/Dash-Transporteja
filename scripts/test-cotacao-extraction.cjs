const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const filename = path.resolve(__dirname, '../lib/utils/cotacao-extraction.ts')
const context = { exports: {}, require: () => ({}) }
vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context)
const { extractCotacao } = context.exports

const quote = extractCotacao('Origem: Erechim, RS\nDestino: São João del Rei, MG\nPeso: 487,00 Kg\nValor de Nota: R$ 17.900,00\nWhatsApp: (54) 99999-0000')
assert.equal(quote.origem, 'Erechim/RS')
assert.equal(quote.destino, 'São João del Rei/MG')
assert.equal(quote.pesoKg, 487)
assert.equal(quote.valorNota, 17900)
assert.equal(quote.telefone, '(54) 99999-0000')
assert.equal(extractCotacao('Olá, preciso de um frete').valorNota, null)
assert.equal(extractCotacao('Metros lineares: 2,40').linearMeters, 2.4)
assert.equal(extractCotacao('VOLUMES: 172').quantidade, 172)
const complete = extractCotacao(`Nova Cotação de Frete completo
Origem: São Paulo, SP
Destino: Alvorada, TO
Quantidade: 172 Un
Peso: 3.585,00 Kg
Cubagem: 2,81 m3
Peso Cubico: 938.25 Kg
Valor de Nota: R$ 14.916,47
Telefone: (11) 2768-5200
DESTINO:
MUNICIPIO DE ALVORADA
VALOR NOTA: 14.916,47
Nome: Nicole
Whatsapp: (11) 9 6451-3724
E-mail: comercial3@example.com`)
assert.equal(complete.origem, 'São Paulo/SP')
assert.equal(complete.destino, 'Alvorada/TO')
assert.equal(complete.quantidade, 172)
assert.equal(complete.pesoKg, 3585)
assert.equal(complete.valorNota, 14916.47)
assert.equal(complete.cubagemM3, 2.81)
assert.equal(complete.pesoCubicoKg, 938.25)
assert.equal(complete.telefone, '(11) 9 6451-3724')
assert.equal(complete.cliente, 'Nicole')
console.log('PASS: extração inicial de cotação e campos ausentes')
