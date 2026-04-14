import type { PropostaFormState } from '@/lib/types/proposta'

const FATOR_CUBAGEM_KG_M3 = 300

export function parseDecimalBR(value: string): number {
  const n = parseFloat(String(value).replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

/** AGT + YYYYMMDD + 2 dígitos aleatórios */
export function gerarCodigoPropostaAGT(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const r = String(Math.floor(Math.random() * 90) + 10)
  return `AGT${y}${m}${day}${r}`
}

export interface PropostaCalculo {
  volumeM3: number
  pesoCubadoKg: number
  pesoRealKg: number
  pesoExibicaoKg: number
  /** Quando o frete base é informado “cheio” (taxas + ICMS já dentro), é o valor digitado; senão null. */
  freteBaseInformado: number | null
  /** Frete líquido (transporte), após separar taxas e ICMS embutidos, ou frete por km quando não há valor informado. */
  freteBase: number
  /** Taxas: embutidas no frete informado, ou somadas por fora no modo legado. */
  taxas: number
  /** ICMS: valor embutido extraído do frete informado, ou calculado por fora no modo legado. */
  icmsValor: number
  seguro: number
  subtotalAntesDesc: number
  descontoValor: number
  baseIcms: number
  totalLiquido: number
  rotaTexto: string
  /** true = frete base único já inclui taxas e ICMS (não somar de novo). */
  modoFreteInclusivo: boolean
}

/**
 * Frete base informado já inclui ICMS e taxas.
 * Extrai ICMS “por dentro”: base_sem_icms = T / (1 + p/100); depois separa taxas fixas embutidas.
 */
function decomporFreteBaseInclusivo(T: number, taxasEmbutidas: number, icmsPct: number) {
  const p = Math.max(0, icmsPct)
  const baseSemIcms = p > 0 ? T / (1 + p / 100) : T
  const icmsIncluso = Math.max(0, T - baseSemIcms)
  const taxas = Math.min(Math.max(0, taxasEmbutidas), baseSemIcms)
  const freteLiquido = Math.max(0, baseSemIcms - taxas)
  return { freteLiquido, taxas, icmsIncluso, baseSemIcms }
}

export function calcularProposta(s: PropostaFormState): PropostaCalculo {
  const alt = parseDecimalBR(s.altM)
  const larg = parseDecimalBR(s.largM)
  const prof = parseDecimalBR(s.profM)
  const volumeM3 = alt > 0 && larg > 0 && prof > 0 ? alt * larg * prof : 0
  const pesoCubadoKg = volumeM3 * FATOR_CUBAGEM_KG_M3
  const pesoRealKg = parseDecimalBR(s.pesoKg)
  const pesoExibicaoKg = Math.max(pesoRealKg, pesoCubadoKg)

  const dist = parseDecimalBR(s.distanciaKm)
  const vk = parseDecimalBR(s.valorKm)
  const manualRaw = s.freteManual.trim() ? parseDecimalBR(s.freteManual) : null
  const manual = manualRaw != null && manualRaw > 0 ? manualRaw : null

  const taxasInput = parseDecimalBR(s.taxasFixas)
  const valorNf = parseDecimalBR(s.valorNf)
  const seguroPct = parseDecimalBR(s.seguroPct)
  const seguro = valorNf > 0 && seguroPct > 0 ? (valorNf * seguroPct) / 100 : 0

  const descPct = parseDecimalBR(s.descontoPct)
  const icmsPct = parseDecimalBR(s.icmsPct)

  let freteBaseInformado: number | null = null
  let freteBase: number
  let taxas: number
  let icmsValor: number
  let subtotalAntesDesc: number
  let descontoValor: number
  let baseIcms: number
  let totalLiquido: number
  let modoFreteInclusivo: boolean

  if (manual != null) {
    modoFreteInclusivo = true
    freteBaseInformado = manual
    const dec = decomporFreteBaseInclusivo(manual, taxasInput, icmsPct)
    freteBase = dec.freteLiquido
    taxas = dec.taxas
    icmsValor = dec.icmsIncluso
    // Seguro: apenas referência sobre a NF; não entra no total líquido (CT-e)
    subtotalAntesDesc = manual
    descontoValor = (subtotalAntesDesc * descPct) / 100
    baseIcms = Math.max(0, subtotalAntesDesc - descontoValor)
    totalLiquido = baseIcms
  } else {
    modoFreteInclusivo = false
    freteBaseInformado = null
    freteBase = Math.max(0, dist * vk)
    taxas = taxasInput
    // Frete + taxas + ICMS por fora; seguro calculado mas fora do CT-e
    subtotalAntesDesc = freteBase + taxas
    descontoValor = (subtotalAntesDesc * descPct) / 100
    baseIcms = Math.max(0, subtotalAntesDesc - descontoValor)
    icmsValor = (baseIcms * icmsPct) / 100
    totalLiquido = baseIcms + icmsValor
  }

  const o = [s.cidadeOrigem, s.ufOrigem].filter(Boolean).join(' / ')
  const de = [s.cidadeDestino, s.ufDestino].filter(Boolean).join(' / ')
  const rotaTexto = o && de ? `${o} → ${de}` : o || de || '—'

  return {
    volumeM3,
    pesoCubadoKg,
    pesoRealKg,
    pesoExibicaoKg,
    freteBaseInformado,
    freteBase,
    taxas,
    icmsValor,
    seguro,
    subtotalAntesDesc,
    descontoValor,
    baseIcms,
    totalLiquido,
    rotaTexto,
    modoFreteInclusivo,
  }
}

export function formatBRLProposta(n: number): string {
  try {
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  } catch {
    return `R$ ${n.toFixed(2).replace('.', ',')}`
  }
}
