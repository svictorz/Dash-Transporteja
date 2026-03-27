import { NextRequest, NextResponse } from 'next/server'

/**
 * Cache em memória para reduzir chamadas ao Nominatim (limite 1 req/s).
 * Chave: lat,lng arredondados a 2 decimais (~1 km). TTL: 1 hora.
 */
const cache = new Map<string, { city: string; state: string; expiresAt: number }>()
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hora
const CACHE_KEY_DECIMALS = 2

function getCacheKey(lat: number, lng: number): string {
  const r = 10 ** CACHE_KEY_DECIMALS
  return `${Math.round(lat * r) / r},${Math.round(lng * r) / r}`
}

function getCached(lat: number, lng: number): { city: string; state: string } | null {
  const key = getCacheKey(lat, lng)
  const entry = cache.get(key)
  if (!entry || Date.now() > entry.expiresAt) return null
  return { city: entry.city, state: entry.state }
}

function setCache(lat: number, lng: number, city: string, state: string): void {
  const key = getCacheKey(lat, lng)
  cache.set(key, { city, state, expiresAt: Date.now() + CACHE_TTL_MS })
}

export interface ReverseGeocodeResult {
  city: string
  state: string
}

/**
 * Reverse geocoding via Nominatim (OpenStreetMap) - gratuito.
 * Uso: GET /api/geocode/reverse?lat=-23.55&lng=-46.63
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')

  const latNum = lat ? parseFloat(lat) : NaN
  const lngNum = lng ? parseFloat(lng) : NaN

  if (Number.isNaN(latNum) || Number.isNaN(lngNum) || latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
    return NextResponse.json(
      { error: 'Parâmetros lat e lng obrigatórios e devem ser coordenadas válidas' },
      { status: 400 }
    )
  }

  const cached = getCached(latNum, lngNum)
  if (cached) {
    return NextResponse.json(cached)
  }

  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse')
    url.searchParams.set('lat', String(latNum))
    url.searchParams.set('lon', String(lngNum))
    url.searchParams.set('format', 'json')
    url.searchParams.set('addressdetails', '1')
    url.searchParams.set('accept-language', 'pt-BR')

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'Transporteja-Rastreio/1.0 (contato@transportadora.com.br)',
      },
    })

    if (!response.ok) {
      const text = await response.text()
      console.error('[geocode/reverse] Nominatim error:', response.status, text)
      return NextResponse.json(
        { error: 'Serviço de localização temporariamente indisponível' },
        { status: 502 }
      )
    }

    const data = (await response.json()) as {
      address?: {
        city?: string
        town?: string
        village?: string
        municipality?: string
        state?: string
        state_district?: string
        country?: string
      }
    }

    const addr = data?.address ?? {}
    const city =
      addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? ''
    const state = addr.state ?? addr.state_district ?? ''

    const result: ReverseGeocodeResult = {
      city: city || 'Localização desconhecida',
      state: state || '',
    }

    setCache(latNum, lngNum, result.city, result.state)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[geocode/reverse]', err)
    return NextResponse.json(
      { error: 'Erro ao obter cidade e estado' },
      { status: 500 }
    )
  }
}
