export type SimilarFreight = {
  freight_id: number
  origin: string
  origin_state: string
  destination: string
  destination_state: string
  weight_kg: number | null
  distance_km: number | null
  cubage_m3: number | null
  nf_value: number | null
  freight_value: number
  created_at: string
  same_cities: boolean
  weight_close: boolean
  distance_close: boolean
}

export function parseCotacaoLocation(value: string): { city: string; state: string } {
  const match = value.trim().match(/^(.+?)(?:\s*\/\s*|,\s*)([A-Za-z]{2})$/)
  return match ? { city: match[1].trim(), state: match[2].toUpperCase() } : { city: value.trim(), state: '' }
}

export function similarFreightsQuery(
  draft: { origem: string; destino: string; pesoKg: number | null },
  distanceKm: number,
) {
  const origin = parseCotacaoLocation(draft.origem)
  const destination = parseCotacaoLocation(draft.destino)
  if (!origin.city || !origin.state || !destination.city || !destination.state) return null
  return {
    p_origin_city: origin.city,
    p_origin_state: origin.state,
    p_destination_city: destination.city,
    p_destination_state: destination.state,
    p_weight_kg: draft.pesoKg != null && Number.isFinite(draft.pesoKg) && draft.pesoKg > 0 ? draft.pesoKg : null,
    p_distance_km: Number.isFinite(distanceKm) && distanceKm > 0 ? distanceKm : null,
  }
}
