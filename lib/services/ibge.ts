/**
 * Serviço de consulta de cidades brasileiras via IBGE.
 *
 * Usado para normalizar nome da cidade (com acentos) e descobrir o estado (UF)
 * a partir do que o usuário digitou no formulário.
 *
 * - Endpoint público (sem chave): /api/v1/localidades/municipios?view=nivelado
 * - O resultado é cacheado em memória (módulo) e em sessionStorage para evitar
 *   re-fetch entre navegações dentro da mesma aba.
 */

export interface CityMatch {
  /** Nome oficial da cidade (com acentos) */
  name: string
  /** Sigla do estado (ex.: "SP") */
  state: string
}

interface CityIndex {
  byKey: Map<string, CityMatch[]>
  all: CityMatch[]
}

const CACHE_KEY = 'ibge:municipios:v1'

let memCache: CityIndex | null = null
let inflight: Promise<CityIndex> | null = null

/** Remove acentos, normaliza espaços e baixa caixa. */
function normalize(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildIndex(cities: CityMatch[]): CityIndex {
  const byKey = new Map<string, CityMatch[]>()
  for (const c of cities) {
    const key = normalize(c.name)
    const bucket = byKey.get(key)
    if (bucket) bucket.push(c)
    else byKey.set(key, [c])
  }
  return { byKey, all: cities }
}

function loadFromSession(): CityIndex | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CityMatch[]
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    return buildIndex(parsed)
  } catch {
    return null
  }
}

function saveToSession(cities: CityMatch[]) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(cities))
  } catch {
    // sessionStorage cheio: ignora
  }
}

async function loadIndex(): Promise<CityIndex> {
  if (memCache) return memCache
  const fromSession = loadFromSession()
  if (fromSession) {
    memCache = fromSession
    return memCache
  }
  if (inflight) return inflight

  inflight = (async () => {
    try {
      const res = await fetch(
        'https://servicodados.ibge.gov.br/api/v1/localidades/municipios?view=nivelado',
        { cache: 'force-cache' },
      )
      if (!res.ok) throw new Error(`IBGE ${res.status}`)
      const data = (await res.json()) as Array<Record<string, unknown>>
      const cities: CityMatch[] = data
        .map((m) => ({
          name: String(m['municipio-nome'] ?? ''),
          state: String(m['UF-sigla'] ?? ''),
        }))
        .filter((c) => c.name && c.state)
      const idx = buildIndex(cities)
      memCache = idx
      saveToSession(cities)
      return idx
    } finally {
      inflight = null
    }
  })()

  return inflight
}

/**
 * Procura a cidade no IBGE retornando nome oficial + UF.
 * - Se houver mais de uma cidade com o mesmo nome (ex.: "Cristalina"),
 *   prioriza o estado informado em `hintState`.
 * - Retorna `null` se não encontrar.
 */
export async function findCityMatch(
  input: string,
  hintState?: string | null,
): Promise<CityMatch | null> {
  const q = normalize(input)
  if (!q) return null
  try {
    const idx = await loadIndex()
    const exact = idx.byKey.get(q)
    if (!exact || exact.length === 0) return null

    const hint = (hintState ?? '').trim().toUpperCase()
    if (hint && exact.length > 1) {
      const withState = exact.find((c) => c.state === hint)
      if (withState) return withState
    }
    return exact[0]
  } catch {
    return null
  }
}

/**
 * Pré-carrega a lista do IBGE em segundo plano. Pode ser chamado quando
 * o usuário abre a página, para que o primeiro `findCityMatch` seja instantâneo.
 */
export function prefetchCityIndex(): void {
  void loadIndex().catch(() => {
    /* silencioso */
  })
}
