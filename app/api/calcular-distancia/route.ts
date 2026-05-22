import { NextRequest, NextResponse } from 'next/server'

const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
const OSRM = 'https://router.project-osrm.org/route/v1/driving'
const UA = 'Transporteja-Dashboard/1.0 (contato@transportadora.com.br)'

/** Cache em memória: cidade+UF → coordenadas. TTL 24 h. */
const coordCache = new Map<string, { lat: number; lon: number; expiresAt: number }>()
/** Cache em memória: par de cidades → distância km. TTL 24 h. */
const distCache = new Map<string, { km: number; expiresAt: number }>()
const TTL = 24 * 60 * 60 * 1000

function coordKey(cidade: string, uf: string) {
  return `${cidade.toLowerCase().trim()}|${uf.toLowerCase()}`
}

async function geocodeCidade(
  cidade: string,
  uf: string,
  signal: AbortSignal,
): Promise<{ lat: number; lon: number } | null> {
  const key = coordKey(cidade, uf)
  const cached = coordCache.get(key)
  if (cached && Date.now() < cached.expiresAt) {
    return { lat: cached.lat, lon: cached.lon }
  }

  const q = `${cidade}, ${uf}, Brasil`
  const url = new URL(NOMINATIM)
  url.searchParams.set('q', q)
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '1')
  url.searchParams.set('countrycodes', 'br')

  const res = await fetch(url.toString(), {
    signal,
    headers: { 'User-Agent': UA },
  })

  if (!res.ok) return null
  const data = await res.json()
  if (!Array.isArray(data) || !data.length) return null

  const { lat, lon } = data[0]
  const coords = { lat: parseFloat(lat), lon: parseFloat(lon) }
  coordCache.set(key, { ...coords, expiresAt: Date.now() + TTL })
  return coords
}

/**
 * Calcula distância rodoviária entre duas cidades brasileiras.
 * Usa Nominatim (geocoding) + OSRM (rota real) — gratuito, sem API key.
 *
 * GET /api/calcular-distancia?co=Campinas&uo=SP&cd=São Paulo&ud=SP
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const co = (searchParams.get('co') ?? '').trim()   // cidade origem
  const uo = (searchParams.get('uo') ?? '').trim()   // UF origem
  const cd = (searchParams.get('cd') ?? '').trim()   // cidade destino
  const ud = (searchParams.get('ud') ?? '').trim()   // UF destino

  if (!co || !cd) {
    return NextResponse.json({ erro: 'Parâmetros incompletos' }, { status: 400 })
  }

  const distKey = `${coordKey(co, uo)}→${coordKey(cd, ud)}`
  const cachedDist = distCache.get(distKey)
  if (cachedDist && Date.now() < cachedDist.expiresAt) {
    return NextResponse.json({ km: cachedDist.km })
  }

  const controller = new AbortController()

  let origem, destino
  try {
    ;[origem, destino] = await Promise.all([
      geocodeCidade(co, uo, controller.signal),
      geocodeCidade(cd, ud, controller.signal),
    ])
  } catch {
    return NextResponse.json({ erro: 'Erro ao geocodificar cidades' }, { status: 502 })
  }

  if (!origem || !destino) {
    return NextResponse.json({ erro: 'Uma ou ambas as cidades não foram encontradas' }, { status: 404 })
  }

  const osrmUrl = `${OSRM}/${origem.lon},${origem.lat};${destino.lon},${destino.lat}?overview=false`

  let osrmRes: Response
  try {
    osrmRes = await fetch(osrmUrl, { headers: { 'User-Agent': UA } })
  } catch {
    return NextResponse.json({ erro: 'Erro ao calcular rota' }, { status: 502 })
  }

  if (!osrmRes.ok) {
    return NextResponse.json({ erro: 'Serviço de rota indisponível' }, { status: 502 })
  }

  const osrm = await osrmRes.json()
  if (osrm.code !== 'Ok' || !osrm.routes?.length) {
    return NextResponse.json({ erro: 'Rota não encontrada entre as cidades' }, { status: 404 })
  }

  const km = Math.round(osrm.routes[0].distance / 1000)
  distCache.set(distKey, { km, expiresAt: Date.now() + TTL })

  return NextResponse.json({ km })
}
