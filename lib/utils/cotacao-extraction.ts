import type { CotacaoDraft } from '@/lib/types/cotacao-erp'

const capture = (text: string, labels: string) => text.match(new RegExp(`(?:^|\\n)[ \\t]*(?:${labels})[ \\t]*:[ \\t]*([^\\r\\n]*)`, 'i'))?.[1]?.trim() ?? ''

export function parseCotacaoNumber(value: string): number | null {
  const clean = value.replace(/^[^\d]*/, '').match(/^[\d.,]+/)?.[0] ?? ''
  if (!clean) return null
  const comma = clean.lastIndexOf(',')
  const dot = clean.lastIndexOf('.')
  const separator = Math.max(comma, dot)
  const decimal = separator >= 0 && clean.length - separator - 1 !== 3
  const normalized = separator < 0 ? clean : clean.slice(0, separator).replace(/[.,]/g, '') + (decimal ? '.' + clean.slice(separator + 1) : clean.slice(separator + 1))
  const parsed = Number(normalized)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function place(value: string): string {
  const match = value.trim().match(/^(.+?)(?:\s*[,/\-]\s*|\s+)(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\.?$/i)
  return match ? `${match[1].trim()}/${match[2].toUpperCase()}` : value
}

export function extractCotacao(textoOriginal: string): CotacaoDraft {
  return {
    origem: place(capture(textoOriginal, 'origem')),
    destino: place(capture(textoOriginal, 'destino')),
    pesoKg: parseCotacaoNumber(capture(textoOriginal, 'peso')),
    marginPercent: 25,
    valorNota: parseCotacaoNumber(capture(textoOriginal, 'valor\\s+(?:de\\s+)?nota|valor\\s+nf')),
    cubagemM3: parseCotacaoNumber(capture(textoOriginal, 'cubagem')),
    linearMeters: parseCotacaoNumber(capture(textoOriginal, 'metros\\s+lineares|comprimento\\s+linear')),
    pesoCubicoKg: parseCotacaoNumber(capture(textoOriginal, 'peso\\s+c(?:u|ú)bico')),
    googleKm: null,
    quantidade: parseCotacaoNumber(capture(textoOriginal, 'quantidade|volumes?')),
    telefone: capture(textoOriginal, 'whatsapp') || capture(textoOriginal, 'telefone|celular'),
    cliente: capture(textoOriginal, 'nome|cliente'),
    email: capture(textoOriginal, 'e-mail|email'),
    observacoes: capture(textoOriginal, 'observa(?:ç|c)(?:ões|oes)'),
    textoOriginal,
  }
}
