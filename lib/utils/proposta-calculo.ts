import type { PropostaEmitente } from '@/lib/constants/proposta-emitentes'
import { getPropostaDoc } from '@/lib/constants/proposta-emitentes'
import type { PropostaFormState } from '@/lib/types/proposta'

export function parseDecimalBR(value: string): number {
  const n = parseFloat(String(value).replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

/** Prefixo do emitente + YYYYMMDD + 2 dígitos aleatórios */
export function gerarCodigoProposta(emitente: PropostaEmitente = 'agape'): string {
  const prefix = getPropostaDoc(emitente).codigoPrefix
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const r = String(Math.floor(Math.random() * 90) + 10)
  return `${prefix}${y}${m}${day}${r}`
}

/** @deprecated Use gerarCodigoProposta('agape') */
export function gerarCodigoPropostaAGT(): string {
  return gerarCodigoProposta('agape')
}

/** Alíquota informativa de impostos + seguro exibida na proposta. */
export const IMPOSTOS_SEGURO_PERCENT = 23

export interface PropostaCalculo {
  pesoRealKg: number
  freteBaseInformado: number
  /** Valores adicionais somados ao frete base (mesmo valor exibido como "Taxas"). */
  taxas: number
  /** Impostos + seguro: 23% do total líquido — apenas informativo, não desconta do total líquido. */
  impostosSeguroValor: number
  /** Valor final: frete base + valores adicionais (impostos/seguros não entram na conta). */
  totalLiquido: number
  rotaTexto: string
}

export function calcularProposta(s: PropostaFormState): PropostaCalculo {
  const pesoRealKg = parseDecimalBR(s.pesoKg)
  const freteBaseInformado = parseDecimalBR(s.freteManual)
  const taxas = parseDecimalBR(s.taxasFixas)

  const totalLiquido = Math.max(0, freteBaseInformado + taxas)
  const impostosSeguroValor = totalLiquido * (IMPOSTOS_SEGURO_PERCENT / 100)

  const o = [s.cidadeOrigem, s.ufOrigem].filter(Boolean).join(' / ')
  const de = [s.cidadeDestino, s.ufDestino].filter(Boolean).join(' / ')
  const rotaTexto = o && de ? `${o} → ${de}` : o || de || '—'

  return {
    pesoRealKg,
    freteBaseInformado,
    taxas,
    impostosSeguroValor,
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
