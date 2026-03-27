/**
 * Geocodificação (Nominatim) + rota rodoviária (OSRM demo).
 * Uso apenas no servidor; respeitar política Nominatim (≈1 req/s).
 */

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search'
const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving'

const USER_AGENT =
  process.env.COTACAO_NOMINATIM_USER_AGENT ||
  'JCN-Agape-Gestao/1.0 (cotacao; contato@empresa.com.br)'

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

  const url = new URL(NOMINATIM_BASE)
  url.searchParams.set('q', q.includes('Brasil') || q.includes('BR') ? q : `${q}, Brasil`)
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '1')
  url.searchParams.set('countrycodes', 'br')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('accept-language', 'pt-BR')

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT },
    next: { revalidate: 0 },
  })

  if (!res.ok) return null

  const data = (await res.json()) as Array<{ lat?: string; lon?: string; display_name?: string }>
  const first = data?.[0]
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
}

export async function osrmDrivingRoute(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number
): Promise<OsrmRouteResult | null> {
  const path = `${lon1},${lat1};${lon2},${lat2}`
  const url = `${OSRM_BASE}/${path}?overview=false&alternatives=false&steps=false`

  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    next: { revalidate: 0 },
  })

  if (!res.ok) return null

  const json = (await res.json()) as {
    code?: string
    routes?: Array<{ distance?: number; duration?: number }>
  }

  if (json.code !== 'Ok' || !json.routes?.[0]) return null

  const r = json.routes[0]
  const distanceM = r.distance
  const durationS = r.duration
  if (typeof distanceM !== 'number' || typeof durationS !== 'number') return null

  return { distanceM, durationS }
}

export function parseEnvFloat(name: string, fallback: number): number {
  const v = process.env[name]
  if (v == null || v === '') return fallback
  const n = parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/** R$/L — atualizar semanalmente conforme média ANP (sem API oficial simples). */
export function getDieselPrecoLitro(): number {
  return parseEnvFloat('COTACAO_DIESEL_PRECO_LITRO', 6.35)
}

/** Quantos km o veículo roda com 1 litro (ex.: 3,2 km/L). */
export function getKmPorLitro(): number {
  return parseEnvFloat('COTACAO_KM_POR_LITRO', 3.2)
}

/** Estimativa nacional de pedágio: R$ por km de rodovia (ajuste regional no .env). */
export function getPedagioReaisPorKm(): number {
  return parseEnvFloat('COTACAO_PEDAGIO_R_POR_KM', 0.11)
}
