import type { CotacaoDraft } from '@/lib/types/cotacao-erp'

export type CotacaoMessageStyle = 'Abordagem inicial' | 'Confirmação de dados' | 'Apresentação de valores' | 'Acompanhamento' | 'Proposta fracionado' | 'Proposta dedicado'
export type CotacaoMessageTemplates = Record<CotacaoMessageStyle | 'Anúncio Fretebrás', string>
export type CotacaoMessageTitles = Record<keyof CotacaoMessageTemplates, string>
type MessageDraft = Pick<CotacaoDraft, 'origem' | 'destino' | 'pesoKg' | 'valorNota' | 'cliente' | 'telefone'>
type Prices = { fracionado?: number; dedicado?: number }
const brl = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
export const defaultCotacaoTemplates: CotacaoMessageTemplates = {
  'Abordagem inicial': '{saudacao} A carga de {origem} para {destino} ainda está disponível? Posso enviar uma cotação?',
  'Confirmação de dados': '{saudacao} Pode confirmar os dados da carga de {origem} para {destino}? Peso: {peso}. Qual é a data prevista para coleta?',
  'Apresentação de valores': '{saudacao} Seguem as opções para o frete de {origem} para {destino}: fracionado por {precoFracionado} ou dedicado por {precoDedicado}. Qual atende melhor à sua operação?',
  'Acompanhamento': '{saudacao} Conseguiu avaliar a cotação do frete de {origem} para {destino}? Se precisar ajustar algum detalhe, estou à disposição.',
  'Proposta fracionado': '{saudacao} Segue a proposta de transporte fracionado de {origem} para {destino}, no valor de {precoFracionado}. Posso confirmar a operação?',
  'Proposta dedicado': '{saudacao} Segue a proposta de transporte dedicado de {origem} para {destino}, no valor de {precoDedicado}. Posso confirmar a operação?',
  'Anúncio Fretebrás': '🚛 OPORTUNIDADE DE CARGA\n📍 Coleta: {origem}\n📍 Entrega: {destino}\n⚖ Peso: {peso}\n💰 NF: {valorNota}',
}

export const defaultCotacaoTitles: CotacaoMessageTitles = {
  'Abordagem inicial': 'Abordagem inicial',
  'Confirmação de dados': 'Confirmação de dados',
  'Apresentação de valores': 'Apresentação de valores',
  'Acompanhamento': 'Acompanhamento',
  'Proposta fracionado': 'Proposta fracionado',
  'Proposta dedicado': 'Proposta dedicado',
  'Anúncio Fretebrás': 'Anúncio Fretebrás',
}

export function validateCotacaoTitles(titles: CotacaoMessageTitles): string | null {
  const normalized = new Set<string>()
  for (const style of Object.keys(defaultCotacaoTitles) as (keyof CotacaoMessageTitles)[]) {
    const title = titles[style]?.trim()
    if (!title || title.length > 80) return `Revise o título de ${style}.`
    const key = title.toLocaleLowerCase('pt-BR')
    if (normalized.has(key)) return 'Os títulos das mensagens devem ser diferentes.'
    normalized.add(key)
  }
  return null
}

const commonTokens = ['saudacao', 'cliente', 'origem', 'destino', 'peso', 'valorNota']
export function validateCotacaoTemplates(templates: CotacaoMessageTemplates): string | null {
  for (const [style, template] of Object.entries(templates)) {
    if (!template?.trim() || template.length > 4000) return `Revise o texto de ${style}.`
    const matches = template.match(/\{([^{}]+)\}/g) || []
    for (const token of matches) {
      const key = token.slice(1, -1)
      const allowed = style === 'Apresentação de valores' || style.startsWith('Proposta ') ? [...commonTokens, 'precoFracionado', 'precoDedicado'] : commonTokens
      if (!allowed.includes(key)) return `Variável {${key}} inválida em ${style}.`
    }
    if (/[{}]/.test(template.replace(/\{[^{}]+\}/g, ''))) return `Chaves incompletas em ${style}.`
  }
  return null
}

function render(template: string, draft: MessageDraft, prices?: Prices): string {
  const variables: Record<string, string> = {
    saudacao: draft.cliente.trim() ? `Olá, ${draft.cliente.trim()}!` : 'Olá!',
    cliente: draft.cliente.trim() || 'cliente',
    origem: draft.origem || 'origem a confirmar',
    destino: draft.destino || 'destino a confirmar',
    peso: draft.pesoKg ? `${draft.pesoKg.toLocaleString('pt-BR')} kg` : 'a confirmar',
    valorNota: draft.valorNota == null ? 'a confirmar' : brl(draft.valorNota),
    precoFracionado: prices?.fracionado == null ? '' : brl(prices.fracionado),
    precoDedicado: prices?.dedicado == null ? '' : brl(prices.dedicado),
  }
  return template.replace(/\{([^{}]+)\}/g, (_, key: string) => variables[key] ?? '')
}

export function cotacaoMessage(draft: MessageDraft, style: CotacaoMessageStyle, prices?: Prices, templates = defaultCotacaoTemplates): string {
  if ((style === 'Apresentação de valores' && (prices?.fracionado == null || prices?.dedicado == null))
    || (style === 'Proposta fracionado' && prices?.fracionado == null)
    || (style === 'Proposta dedicado' && prices?.dedicado == null)) return ''
  return render(templates[style] || defaultCotacaoTemplates[style], draft, prices)
}

export function cotacaoAd(draft: MessageDraft, templates = defaultCotacaoTemplates): string {
  return render(templates['Anúncio Fretebrás'] || defaultCotacaoTemplates['Anúncio Fretebrás'], draft)
}

export function cotacaoWhatsAppLink(phone: string, message: string): string | null {
  const value = phone.trim()
  if (!/^\+?[\d\s().-]+$/.test(value)) return null
  const digits = value.replace(/\D/g, '')
  const number = value.startsWith('+') ? digits : /^[1-9]\d{9,10}$/.test(digits) ? `55${digits}` : digits
  if (!/^55[1-9]\d{9,10}$/.test(number)) return null
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}
