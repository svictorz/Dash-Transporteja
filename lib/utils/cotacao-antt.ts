export type AnttVehicle = { name: string; axles: number; payloadKg?: number; volumeM3?: number; anttCcd?: number; anttFixed?: number }

export const ANTT_TABLE_A_SOURCE = 'https://anttlegis.antt.gov.br/action/ActionDatalegis.php?acao=abrirTextoAto&cod_menu=7804&cod_modulo=161&link=S&numeroAto=00000022&orgao=SUROC%2FANTT%2FMT&seqAto=000&tipo=POR&valorAno=2026'
export const ANTT_TABLE_A_VALID_FROM = '2026-09-29'

// Portaria SUROC 22/2026, Tabela A, carga geral. Capacidades e nomes são
// referências do ERP JCN, não dados normativos da ANTT.
const coefficients: Record<number, { ccd: number; fixed: number }> = {
  2: { ccd: 4.0738, fixed: 451.84 }, 3: { ccd: 5.2177, fixed: 541.86 },
  4: { ccd: 5.9180, fixed: 588.86 }, 5: { ccd: 6.8284, fixed: 657.56 },
  6: { ccd: 7.5347, fixed: 671.93 }, 7: { ccd: 8.2727, fixed: 831.66 },
  9: { ccd: 9.4114, fixed: 903.32 },
}

export const ANTT_REFERENCE_FLEET: AnttVehicle[] = [
  { name: 'Fiorino / Kangoo', axles: 2, payloadKg: 500, volumeM3: 3 },
  { name: 'Van / VUC', axles: 2, payloadKg: 1500, volumeM3: 10 },
  { name: '3/4', axles: 2, payloadKg: 4000, volumeM3: 20 },
  { name: 'Toco', axles: 2, payloadKg: 7000, volumeM3: 28 },
  { name: 'Truck', axles: 3, payloadKg: 14000, volumeM3: 48 },
  { name: 'Carreta 4º eixo', axles: 7, payloadKg: 33000, volumeM3: 100 },
  { name: 'Carreta Simples', axles: 5, payloadKg: 22000, volumeM3: 90 },
  { name: 'Carreta LS', axles: 6, payloadKg: 28000, volumeM3: 110 },
  { name: 'Bitrem', axles: 7, payloadKg: 40000, volumeM3: 135 },
  { name: 'Rodotrem', axles: 9, payloadKg: 45000, volumeM3: 150 },
]

// Referência informativa para carga lotação, quando coeficientes foram conferidos.
// Não participa do cálculo comercial de fracionado/dedicado.
export function anttReferenceRows(vehicles: AnttVehicle[], distanceKm: number, weightKg?: number | null, volumeM3?: number | null) {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return []
  return (vehicles.length ? vehicles : ANTT_REFERENCE_FLEET).flatMap(vehicle => {
    const official = coefficients[vehicle.axles]
    const ccd = Number(vehicle.anttCcd ?? official?.ccd)
    const fixed = Number(vehicle.anttFixed ?? official?.fixed)
    if (!vehicle.name || !Number.isInteger(vehicle.axles) || vehicle.axles <= 0 || !Number.isFinite(ccd) || ccd <= 0 || !Number.isFinite(fixed) || fixed < 0) return []
    const exceedsWeight = weightKg != null && weightKg > 0 && Number(vehicle.payloadKg) > 0 && weightKg > Number(vehicle.payloadKg)
    const exceedsVolume = volumeM3 != null && volumeM3 > 0 && Number(vehicle.volumeM3) > 0 && volumeM3 > Number(vehicle.volumeM3)
    const capacityKnown = weightKg != null && weightKg > 0 && Number(vehicle.payloadKg) > 0
    const fit = exceedsWeight || exceedsVolume ? 'incompatível' : capacityKnown ? 'compatível' : 'a confirmar'
    return [{ name: vehicle.name, axles: vehicle.axles, ccd, fixed, reference: Math.round((distanceKm * ccd + fixed) * 100) / 100, payloadKg: vehicle.payloadKg, volumeM3: vehicle.volumeM3, fit }]
  })
}

export function anttMinimumForVehicle(vehicles: AnttVehicle[], selectedName: string, distanceKm: number): number | null {
  if (!vehicles.length || !selectedName) return null
  return anttReferenceRows(vehicles, distanceKm).find(row => row.name === selectedName)?.reference ?? null
}
