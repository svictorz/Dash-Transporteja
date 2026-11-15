import type { CotacaoDraft } from '@/lib/types/cotacao-erp'

type PriceInputs = Pick<CotacaoDraft, 'origem' | 'destino' | 'pesoKg' | 'valorNota' | 'cubagemM3' | 'linearMeters' | 'marginPercent' | 'selectedVehicleName'>
type Snapshot = { snapshot?: { draft?: PriceInputs; distance_km?: number } } | null

export function isAnalysisCurrent(analysis: Snapshot, draft: PriceInputs, distanceKm: number): boolean {
  const saved = analysis?.snapshot
  if (!saved?.draft || !Number.isFinite(saved.distance_km) || !Number.isFinite(distanceKm)) return false
  return saved.draft.origem === draft.origem &&
    saved.draft.destino === draft.destino &&
    saved.draft.pesoKg === draft.pesoKg &&
    saved.draft.valorNota === draft.valorNota &&
    saved.draft.cubagemM3 === draft.cubagemM3 &&
    saved.draft.linearMeters === draft.linearMeters &&
    saved.draft.marginPercent === draft.marginPercent &&
    saved.draft.selectedVehicleName === draft.selectedVehicleName &&
    Math.abs(saved.distance_km! - distanceKm) < 0.01
}
