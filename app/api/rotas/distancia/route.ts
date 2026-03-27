import { NextRequest, NextResponse } from 'next/server'
import {
  nominatimSearchBrasil,
  osrmDrivingRoute,
  sleep,
} from '@/lib/services/cotacao-route'

const NOMINATIM_GAP_MS = 1100

export const maxDuration = 30

/**
 * Distância e tempo entre dois pontos (texto livre, Brasil).
 * GET /api/rotas/distancia?origem=Campinas+SP&destino=Rio+de+Janeiro+RJ
 */
export async function GET(request: NextRequest) {
  const origem = request.nextUrl.searchParams.get('origem')?.trim() ?? ''
  const destino = request.nextUrl.searchParams.get('destino')?.trim() ?? ''

  if (!origem || !destino || origem.length > 400 || destino.length > 400) {
    return NextResponse.json(
      { error: 'Parâmetros origem e destino são obrigatórios (máx. 400 caracteres cada).' },
      { status: 400 }
    )
  }

  try {
    const o = await nominatimSearchBrasil(origem)
    await sleep(NOMINATIM_GAP_MS)
    const d = await nominatimSearchBrasil(destino)

    if (!o) {
      return NextResponse.json(
        { error: 'Origem não encontrada. Informe cidade e UF (ex.: Campinas SP).' },
        { status: 422 }
      )
    }
    if (!d) {
      return NextResponse.json(
        { error: 'Destino não encontrado. Informe cidade e UF.' },
        { status: 422 }
      )
    }

    const route = await osrmDrivingRoute(o.lon, o.lat, d.lon, d.lat)
    if (!route) {
      return NextResponse.json(
        { error: 'Não foi possível calcular a rota rodoviária.' },
        { status: 502 }
      )
    }

    const distanciaKm = Math.round((route.distanceM / 1000) * 10) / 10
    const duracaoMin = Math.round(route.durationS / 60)

    return NextResponse.json({
      distanciaKm,
      duracaoMin,
      origemResolvida: o.displayName,
      destinoResolvida: d.displayName,
    })
  } catch (e) {
    console.error('[api/rotas/distancia]', e)
    return NextResponse.json({ error: 'Serviço temporariamente indisponível.' }, { status: 502 })
  }
}
