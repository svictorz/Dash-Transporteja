import type { CotacaoDraft } from '@/lib/types/cotacao-erp'

const capture = (text: string, labels: string) => text.match(new RegExp(`(?:^|\\n)\\s*(?:${labels})\\s*:\\s*([^\\n]+)`, 'i'))?.[1]?.trim() ?? ''

function moneyOrWeight(value: string): number | null {
  const clean = value.replace(/^[^\d]*/, '').match(/^[\d.,]+/)?.[0] ?? ''
  if (!clean) return null
  const comma = clean.lastIndexOf(',')
  const dot = clean.lastIndexOf('.')
  const normalized = comma > dot ? clean.replace(/\./g, '').replace(',', '.') : dot > comma && comma >= 0 ? clean.replace(/,/g, '') : clean.replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function place(value: string): string {
  const match = value.match(/^(.+?)[,\s/\-]+([A-Z]{2})$/i)
  return match ? `${match[1].trim()}/${match[2].toUpperCase()}` : value
}

export function extractCotacao(textoOriginal: string): CotacaoDraft {
  return {
    origem: place(capture(textoOriginal, 'origem')),
    destino: place(capture(textoOriginal, 'destino')),
    pesoKg: moneyOrWeight(capture(textoOriginal, 'peso')),
    valorNota: moneyOrWeight(capture(textoOriginal, 'valor\\s+(?:de\\s+)?nota|valor\\s+nf')),
    cubagemM3: moneyOrWeight(capture(textoOriginal, 'cubagem')),
    linearMeters: moneyOrWeight(capture(textoOriginal, 'metros\\s+lineares|comprimento\\s+linear')),
    pesoCubicoKg: moneyOrWeight(capture(textoOriginal, 'peso\\s+c(?:u|ú)bico')),
    googleKm: null,
    quantidade: moneyOrWeight(capture(textoOriginal, 'quantidade')),
    telefone: capture(textoOriginal, 'whatsapp') || capture(textoOriginal, 'telefone|celular'),
    cliente: capture(textoOriginal, 'nome|cliente'),
    email: capture(textoOriginal, 'e-mail|email'),
    observacoes: capture(textoOriginal, 'observa(?:ç|c)(?:ões|oes)'),
    textoOriginal,
  }
}
