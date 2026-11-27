const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const compile = (file) => ts.transpileModule(
  fs.readFileSync(path.resolve(__dirname, file), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText

async function main() {
  const geocoded = []
  let routedStops
  const routeModule = { exports: {} }
  vm.runInNewContext(compile('../app/api/rotas/distancia/route.ts'), {
    module: routeModule,
    exports: routeModule.exports,
    require: (name) => name === 'next/server'
      ? { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } }
      : {
          nominatimSearchBrasil: async (label) => {
            geocoded.push(label)
            return { lat: geocoded.length, lon: geocoded.length * -1, displayName: label }
          },
          sleep: async () => {},
          osrmDrivingRouteThrough: async (stops) => {
            routedStops = stops
            return { distanceM: 250400, durationS: 14400, coordinates: [[1, -1], [4, -4]] }
          },
        },
    console,
  })

  const url = new URL('http://localhost/api/rotas/distancia?origem=Campinas%2FSP&origemExtra=Jundia%C3%AD%2FSP&destino=S%C3%A3o+Paulo%2FSP&destinoExtra=Santos%2FSP&map=1')
  const response = await routeModule.exports.GET({ nextUrl: url })
  assert.equal(response.status, 200)
  assert.deepEqual(geocoded, ['Campinas/SP', 'Jundiaí/SP', 'São Paulo/SP', 'Santos/SP'])
  assert.equal(routedStops.length, 4)
  const multiRoutedStops = routedStops
  assert.equal(response.body.distanciaKm, 250.4)
  assert.deepEqual(Array.from(response.body.paradas, stop => stop.kind), ['origin', 'origin', 'destination', 'destination'])

  const singleRoute = await routeModule.exports.GET({ nextUrl: new URL('http://localhost/api/rotas/distancia?origem=Campinas%2FSP&destino=Santos%2FSP') })
  assert.equal(singleRoute.status, 200)
  assert.equal(singleRoute.body.paradas.length, 2)
  const invalidRoute = await routeModule.exports.GET({ nextUrl: new URL('http://localhost/api/rotas/distancia?origem=Campinas%2FSP&destino=Santos%2FSP&origemExtra=') })
  assert.equal(invalidRoute.status, 400)

  const serviceModule = { exports: {} }
  let osrmUrl
  vm.runInNewContext(compile('../lib/services/cotacao-route.ts'), {
    module: serviceModule,
    exports: serviceModule.exports,
    process: { env: {} },
    URL,
    fetch: async (url) => {
      osrmUrl = url
      return { ok: true, json: async () => ({ code: 'Ok', routes: [{ distance: 250400, duration: 14400 }] }) }
    },
  })
  await serviceModule.exports.osrmDrivingRouteThrough(multiRoutedStops)
  assert.match(osrmUrl, /-1,1;-2,2;-3,3;-4,4/)
  console.log('PASS: rota passa por todas as origens e destinos na ordem informada')
}

main().catch(error => { console.error(error); process.exitCode = 1 })
