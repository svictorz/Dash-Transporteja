import type { Route } from '@/lib/services/routes'

/**
 * Cálculos financeiros de frete compartilhados entre a Performance e o
 * Controle Financeiro. Fonte única de verdade para tributos, frete líquido
 * e comissão, evitando divergência entre telas.
 */

export const TAXES_PERCENT_OPTIONS = [0, 10, 12, 18] as const
export type TaxesPercent = (typeof TAXES_PERCENT_OPTIONS)[number]

/**
 * Alíquotas selecionáveis pelo admin/financeiro ao lançar/editar um frete.
 * São apenas duas: isento (0%) ou 18%. Valores históricos diferentes (10%,
 * 12%) continuam sendo reconhecidos para exibição, mas não são oferecidos
 * como nova opção.
 */
export const TAXES_PERCENT_CHOICES = [18, 0] as const

/**
 * Alíquotas de seguro selecionáveis pelo admin (apenas admin edita): 0,2% ou
 * isento (0%). Incide sobre o valor da NF.
 */
export const SEGURO_PERCENT_CHOICES = [0.2, 0] as const

/** Comissão padrão (%) quando o vendedor não tem `commission_rate` definido. */
export const DEFAULT_COMMISSION_RATE = 30

/** Normaliza a alíquota de seguro para um dos valores aceitos (0,2 ou 0). */
export function normalizeSeguroPercent(value: unknown): number {
  const n = typeof value === 'number' && !Number.isNaN(value) ? value : Number(value)
  return n === 0.2 ? 0.2 : 0
}

/** Seguro = valor da NF × alíquota. */
export function calculateSeguroValue(
  nfValue?: number | null,
  seguroPercent?: number | null,
): number | null {
  if (nfValue == null) return null
  const p = normalizeSeguroPercent(seguroPercent) / 100
  return Math.round(nfValue * p * 100) / 100
}

export function getRouteSeguroPercent(route: Route): number {
  return normalizeSeguroPercent(route.seguro_percent)
}

/** Seguro efetivo: usa o valor gravado ou recalcula a partir da NF. */
export function getRouteSeguroValue(route: Route): number {
  return route.seguro_value ?? calculateSeguroValue(route.nf_value, getRouteSeguroPercent(route)) ?? 0
}

export function normalizeTaxesPercent(value: unknown): TaxesPercent {
  const n = typeof value === 'number' && !Number.isNaN(value) ? value : Number(value)
  if (n === 0 || n === 10 || n === 12 || n === 18) return n
  return 18
}

/**
 * Deduz a alíquota a partir dos valores quando `taxes_percent` não está
 * gravado (fretes antigos). Testa as alíquotas conhecidas e devolve a que
 * bate com o valor de tributos registrado.
 */
export function inferTaxesPercentFromValues(
  freight: number | null | undefined,
  taxes: number | null | undefined,
): TaxesPercent {
  if (freight == null || freight <= 0 || taxes == null) return 18
  for (const pct of [18, 12, 10, 0] as const) {
    const expected = Math.round(freight * (pct / 100) * 100) / 100
    if (Math.abs(expected - taxes) < 0.02) return pct
  }
  return 18
}

export function getRouteTaxesPercent(route: Route): TaxesPercent {
  const raw = route.taxes_percent
  if (raw === 0 || raw === 10 || raw === 12 || raw === 18) return raw
  return inferTaxesPercentFromValues(
    route.freight_value ?? route.nf_value ?? undefined,
    route.taxes_value ?? undefined,
  )
}

export function calculateTaxesValue(
  freightValue?: number | null,
  taxesPercent?: number | null,
): number | null {
  if (freightValue == null) return null
  const p = normalizeTaxesPercent(taxesPercent) / 100
  return Math.round(freightValue * p * 100) / 100
}

export function calculateNetFreightValue(
  freightValue?: number | null,
  driverValue?: number | null,
  taxesPercent?: number | null,
  seguroValue?: number | null,
): number | null {
  if (freightValue == null) return null
  const taxesValue = calculateTaxesValue(freightValue, taxesPercent) ?? 0
  return Math.round((freightValue - taxesValue - (driverValue ?? 0) - (seguroValue ?? 0)) * 100) / 100
}

export function calculateCommissionValue(
  netFreightValue?: number | null,
  ratePercent?: number | null,
): number | null {
  if (netFreightValue == null) return null
  const rate = (ratePercent ?? DEFAULT_COMMISSION_RATE) / 100
  return Math.round(netFreightValue * rate * 100) / 100
}

/** Frete líquido efetivo: usa o valor gravado ou recalcula se ausente. */
export function getRouteNetFreightValue(route: Route): number {
  const baseFreight = route.freight_value ?? route.nf_value
  const pct = getRouteTaxesPercent(route)
  return (
    route.net_freight_value ??
    calculateNetFreightValue(baseFreight, route.driver_value, pct, getRouteSeguroValue(route)) ??
    0
  )
}

/** Tributos efetivos: usa o valor gravado ou recalcula a partir da alíquota. */
export function getRouteTaxesValue(route: Route): number {
  const baseFreight = route.freight_value ?? route.nf_value
  const pct = getRouteTaxesPercent(route)
  return route.taxes_value ?? calculateTaxesValue(baseFreight, pct) ?? 0
}

/** Comissão efetiva: usa o valor gravado ou recalcula a partir do líquido. */
export function getRouteCommissionValue(route: Route, ratePercent?: number | null): number {
  return route.commission_value ?? calculateCommissionValue(getRouteNetFreightValue(route), ratePercent) ?? 0
}

export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
