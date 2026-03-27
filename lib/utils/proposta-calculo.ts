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
  freteBase: number
  taxas: number
  seguro: number
  subtotalAntesDesc: number
  descontoValor: number
  baseIcms: number
  icmsValor: number
  totalLiquido: number
  rotaTexto: string
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
  const manual = s.freteManual.trim() ? parseDecimalBR(s.freteManual) : null
  const freteBase = manual != null && manual > 0 ? manual : Math.max(0, dist * vk)

  const taxas = parseDecimalBR(s.taxasFixas)
  const valorNf = parseDecimalBR(s.valorNf)
  const seguroPct = parseDecimalBR(s.seguroPct)
  const seguro = valorNf > 0 && seguroPct > 0 ? (valorNf * seguroPct) / 100 : 0

  const subtotalAntesDesc = freteBase + taxas + seguro
  const descPct = parseDecimalBR(s.descontoPct)
  const descontoValor = (subtotalAntesDesc * descPct) / 100
  const baseIcms = Math.max(0, subtotalAntesDesc - descontoValor)
  const icmsPct = parseDecimalBR(s.icmsPct)
  const icmsValor = (baseIcms * icmsPct) / 100
  const totalLiquido = baseIcms + icmsValor

  const o = [s.cidadeOrigem, s.ufOrigem].filter(Boolean).join(' / ')
  const de = [s.cidadeDestino, s.ufDestino].filter(Boolean).join(' / ')
  const rotaTexto = o && de ? `${o} → ${de}` : o || de || '—'

  return {
    volumeM3,
    pesoCubadoKg,
    pesoRealKg,
    pesoExibicaoKg,
    freteBase,
    taxas,
    seguro,
    subtotalAntesDesc,
    descontoValor,
    baseIcms,
    icmsValor,
    totalLiquido,
    rotaTexto,
  }
}

export function formatBRLProposta(n: number): string {
  try {
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  } catch {
    return `R$ ${n.toFixed(2).replace('.', ',')}`
  }
}
