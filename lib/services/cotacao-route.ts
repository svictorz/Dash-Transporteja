/**
 * Geocodificação (Nominatim) + rota rodoviária (OSRM demo).
 * Uso apenas no servidor; respeitar política Nominatim (≈1 req/s).
 */

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search'
const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving'
const STATE_NAMES: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará',
  DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso',
  MS: 'Mato Grosso do Sul', MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná',
  PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina',
  SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
}

const USER_AGENT =
  process.env.COTACAO_NOMINATIM_USER_AGENT ||
  'JCNTransportes-Cotacao/1.0 (https://www.jcntransportes.com)'

export interface GeocodeHit {
  lat: number
  lon: number
  displayName: string
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function nominatimSearchBrasil(query: string): Promise<GeocodeHit | null> {
  const q = query.trim()
  if (!q) return null

  const cityAndState = q.match(/^(.+?)\s*[,/]\s*([A-Z]{2})$/i)
  const stateName = cityAndState && STATE_NAMES[cityAndState[2].toUpperCase()]
  const url = new URL(NOMINATIM_BASE)
  if (cityAndState && stateName) {
    url.searchParams.set('city', cityAndState[1].trim())
    url.searchParams.set('state', stateName)
    url.searchParams.set('country', 'Brasil')
  } else {
    url.searchParams.set('q', q.includes('Brasil') || q.includes('BR') ? q : `${q}, Brasil`)
  }
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '1')
  url.searchParams.set('countrycodes', 'br')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('accept-language', 'pt-BR')

  const search = async (target: URL) => {
    const res = await fetch(target.toString(), { headers: { 'User-Agent': USER_AGENT }, next: { revalidate: 0 } })
    return res.ok ? (await res.json()) as Array<{ lat?: string; lon?: string; display_name?: string }> : []
  }
  let data = await search(url)
  if (!data.length && cityAndState && stateName) {
    // Alguns municípios não aparecem na busca estruturada do Nominatim.
    await sleep(1000)
    const fallback = new URL(NOMINATIM_BASE)
    fallback.searchParams.set('q', `${cityAndState[1].trim()}, ${stateName}, Brasil`)
    for (const key of ['format', 'limit', 'countrycodes', 'addressdetails', 'accept-language']) {
      fallback.searchParams.set(key, url.searchParams.get(key) || '')
    }
    data = await search(fallback)
  }
  const first = data[0]
  if (!first?.lat || !first?.lon) return null

  const lat = parseFloat(first.lat)
  const lon = parseFloat(first.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null

  return {
    lat,
    lon,
    displayName: first.display_name || q,
  }
}

export interface OsrmRouteResult {
  distanceM: number
  durationS: number
  coordinates?: [number, number][]
}

export async function osrmDrivingRoute(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
  includeGeometry = false
): Promise<OsrmRouteResult | null> {
  return osrmDrivingRouteThrough([{ lon: lon1, lat: lat1 }, { lon: lon2, lat: lat2 }], includeGeometry)
}

export async function osrmDrivingRouteThrough(
  stops: Array<{ lon: number; lat: number }>,
  includeGeometry = false
): Promise<OsrmRouteResult | null> {
  if (stops.length < 2 || stops.some(stop => !Number.isFinite(stop.lon) || !Number.isFinite(stop.lat))) return null
  const path = stops.map(stop => `${stop.lon},${stop.lat}`).join(';')
  const url = `${OSRM_BASE}/${path}?overview=${includeGeometry ? 'full' : 'false'}&alternatives=false&steps=false${includeGeometry ? '&geometries=geojson' : ''}`

  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    next: { revalidate: 0 },
  })

  if (!res.ok) return null

  const json = (await res.json()) as {
    code?: string
    routes?: Array<{ distance?: number; duration?: number; geometry?: { coordinates?: [number, number][] } }>
  }

  if (json.code !== 'Ok' || !json.routes?.[0]) return null

  const r = json.routes[0]
  const distanceM = r.distance
  const durationS = r.duration
  if (typeof distanceM !== 'number' || typeof durationS !== 'number') return null

  const points = includeGeometry ? r.geometry?.coordinates : undefined
  const stride = points ? Math.max(1, Math.ceil(points.length / 900)) : 1
  const sampled = points?.filter((_, index) => index % stride === 0 || index === points.length - 1)
  return {
    distanceM,
    durationS,
    coordinates: sampled?.map(([lon, lat]) => [lat, lon]),
  }
}
