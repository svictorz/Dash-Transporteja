import { NextRequest, NextResponse } from 'next/server'
import {
  nominatimSearchBrasil,
  osrmDrivingRoute,
  sleep,
  getDieselPrecoLitro,
  getKmPorLitro,
  getPedagioReaisPorKm,
} from '@/lib/services/cotacao-route'

/** Muitos destinos + Nominatim (1 req/s) podem ultrapassar timeout em serverless (ex.: Vercel Hobby 10s). */
const MAX_DESTINOS = 8
const MAX_LEN = 220
const NOMINATIM_GAP_MS = 1100

export const maxDuration = 60

export interface RotaTrechoResponse {
  destinoSolicitado: string
  destinoResolvido: string | null
  distanciaKm: number | null
  duracaoMin: number | null
  pedagioEstimado: number | null
  dieselLitros: number | null
  dieselCusto: number | null
  erro?: string
}

export async function POST(request: NextRequest) {
  let body: { origem?: string; destinos?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const origem = typeof body.origem === 'string' ? body.origem.trim() : ''
  const destinosRaw = Array.isArray(body.destinos) ? body.destinos : []

  if (!origem || origem.length > MAX_LEN) {
    return NextResponse.json({ error: 'Informe a origem (endereço ou cidade).' }, { status: 400 })
  }

  const destinos = destinosRaw
    .map((d) => (typeof d === 'string' ? d.trim() : ''))
    .filter(Boolean)
    .slice(0, MAX_DESTINOS)

  if (destinos.length === 0) {
    return NextResponse.json(
      { error: 'Informe ao menos um destino.' },
      { status: 400 }
    )
  }

  const dieselPrecoLitro = getDieselPrecoLitro()
  const kmPorLitro = getKmPorLitro()
  const pedagioPorKm = getPedagioReaisPorKm()

  const rotas: RotaTrechoResponse[] = []

  try {
    const origemHit = await nominatimSearchBrasil(origem)

    if (!origemHit) {
      return NextResponse.json(
        {
          error:
            'Não foi possível localizar a origem. Tente cidade, UF ou endereço mais completo (Brasil).',
          origemResolvida: null,
          rotas: destinos.map((d) => ({
            destinoSolicitado: d,
            destinoResolvido: null,
            distanciaKm: null,
            duracaoMin: null,
            pedagioEstimado: null,
            dieselLitros: null,
            dieselCusto: null,
            erro: 'Origem não encontrada',
          })),
        },
        { status: 422 }
      )
    }

    await sleep(NOMINATIM_GAP_MS)

    for (let i = 0; i < destinos.length; i++) {
      const d = destinos[i]
      if (d.length > MAX_LEN) {
        rotas.push({
          destinoSolicitado: d,
          destinoResolvido: null,
          distanciaKm: null,
          duracaoMin: null,
          pedagioEstimado: null,
          dieselLitros: null,
          dieselCusto: null,
          erro: 'Texto do destino muito longo',
        })
        continue
      }

      if (i > 0) await sleep(NOMINATIM_GAP_MS)
      const destHit = await nominatimSearchBrasil(d)

      if (!destHit) {
        rotas.push({
          destinoSolicitado: d,
          destinoResolvido: null,
          distanciaKm: null,
          duracaoMin: null,
          pedagioEstimado: null,
          dieselLitros: null,
          dieselCusto: null,
          erro: 'Destino não encontrado',
        })
        continue
      }

      await sleep(NOMINATIM_GAP_MS)
      const route = await osrmDrivingRoute(
        origemHit.lon,
        origemHit.lat,
        destHit.lon,
        destHit.lat
      )

      if (!route) {
        rotas.push({
          destinoSolicitado: d,
          destinoResolvido: destHit.displayName,
          distanciaKm: null,
          duracaoMin: null,
          pedagioEstimado: null,
          dieselLitros: null,
          dieselCusto: null,
          erro: 'Rota não calculada (serviço indisponível ou sem trajeto rodoviário)',
        })
        continue
      }

      const distanciaKm = route.distanceM / 1000
      const duracaoMin = route.durationS / 60
      const pedagioEstimado = Math.round(distanciaKm * pedagioPorKm * 100) / 100
      const dieselLitros = Math.round((distanciaKm / kmPorLitro) * 100) / 100
      const dieselCusto = Math.round(dieselLitros * dieselPrecoLitro * 100) / 100

      rotas.push({
        destinoSolicitado: d,
        destinoResolvido: destHit.displayName,
        distanciaKm: Math.round(distanciaKm * 10) / 10,
        duracaoMin: Math.round(duracaoMin),
        pedagioEstimado,
        dieselLitros,
        dieselCusto,
      })
    }

    return NextResponse.json({
      origemResolvida: origemHit.displayName,
      origemCoordenadas: { lat: origemHit.lat, lon: origemHit.lon },
      dieselPrecoLitro,
      kmPorLitro,
      pedagioReaisPorKm: pedagioPorKm,
      dieselFonte:
        'Preço configurado em COTACAO_DIESEL_PRECO_LITRO (atualize com a média semanal da ANP).',
      pedagioFonte:
        'Estimativa com COTACAO_PEDAGIO_R_POR_KM (média aproximada; pedágios reais variam por concessão).',
      rotas,
    })
  } catch (e) {
    console.error('[api/cotacao/rota]', e)
    return NextResponse.json(
      { error: 'Falha ao calcular rotas. Tente novamente em instantes.' },
      { status: 502 }
    )
  }
}
