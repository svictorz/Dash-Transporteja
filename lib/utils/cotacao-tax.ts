export function parseCotacaoTaxPercent(value: string | undefined): number | null {
  const raw = value?.trim().replace(',', '.')
  if (!raw) return null
  const total = Number(raw)
  return Number.isFinite(total) && total >= 0 && total <= 100 ? total : null
}
