import { NextRequest, NextResponse } from 'next/server'
import {
  nominatimSearchBrasil,
  osrmDrivingRouteThrough,
  sleep,
  type GeocodeHit,
} from '@/lib/services/cotacao-route'

const NOMINATIM_GAP_MS = 1100

export const maxDuration = 60

/**
 * Distância e tempo entre dois pontos (texto livre, Brasil).
 * GET /api/rotas/distancia?origem=Campinas+SP&destino=Rio+de+Janeiro+RJ
 */
export async function GET(request: NextRequest) {
  const origem = request.nextUrl.searchParams.get('origem')?.trim() ?? ''
  const destino = request.nextUrl.searchParams.get('destino')?.trim() ?? ''
  const origensExtras = request.nextUrl.searchParams.getAll('origemExtra').map(value => value.trim())
  const destinosExtras = request.nextUrl.searchParams.getAll('destinoExtra').map(value => value.trim())
  const includeGeometry = request.nextUrl.searchParams.get('map') === '1'

  const stops = [origem, ...origensExtras, destino, ...destinosExtras]
  if (stops.some(stop => !stop || stop.length > 400) || origensExtras.length > 4 || destinosExtras.length > 4) {
    return NextResponse.json(
      { error: 'Informe todas as paradas (máximo de quatro origens e quatro destinos adicionais).' },
      { status: 400 }
    )
  }

  try {
    const resolved: GeocodeHit[] = []
    for (let index = 0; index < stops.length; index++) {
      const stop = stops[index]
      if (index > 0) await sleep(NOMINATIM_GAP_MS)
      const hit = await nominatimSearchBrasil(stop)
      if (!hit) {
        return NextResponse.json(
          { error: `Parada não encontrada: ${stop}. Informe cidade e UF.` },
          { status: 422 }
        )
      }
      resolved.push(hit)
    }

    const route = await osrmDrivingRouteThrough(resolved, includeGeometry)
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
      origemResolvida: resolved[0].displayName,
      destinoResolvida: resolved[resolved.length - 1].displayName,
      paradas: stops.map((label, index) => ({
        label,
        lat: resolved[index].lat,
        lon: resolved[index].lon,
        kind: index < 1 + origensExtras.length ? 'origin' : 'destination',
      })),
      ...(includeGeometry ? { coordinates: route.coordinates ?? [] } : {}),
    })
  } catch (e) {
    console.error('[api/rotas/distancia]', e)
    return NextResponse.json({ error: 'Serviço temporariamente indisponível.' }, { status: 502 })
  }
}
