/**
 * Consulta CNPJ na Brasil API (gratuita) para validar empresa e auto-preencher dados.
 * Uso: formulário de clientes — botão "Buscar por CNPJ".
 * @see https://brasilapi.com.br/docs#tag/CNPJ
 */

export interface CNPJData {
  cnpj: string
  razao_social: string
  nome_fantasia: string | null
  logradouro: string
  numero: string
  complemento: string | null
  bairro: string
  municipio: string
  uf: string
  cep: string
  ddd_telefone_1: string | null
  email: string | null
  situacao_cadastral?: string
}

/** Dados formatados para preencher o formulário de cliente */
export interface CNPJFormData {
  companyName: string
  cnpj: string
  address: string
  neighborhood: string
  city: string
  state: string
  cep: string
  /** Telefone da empresa (se disponível) — pode ser usado como WhatsApp */
  phone?: string
  /** E-mail da empresa (se disponível) */
  email?: string
}

const BRASIL_API_CNPJ = 'https://brasilapi.com.br/api/cnpj/v1'

/**
 * Remove caracteres não numéricos do CNPJ
 */
function cleanCNPJ(cnpj: string): string {
  return cnpj.replace(/\D/g, '')
}

/**
 * Monta o endereço completo a partir dos campos da API
 */
function buildAddress(data: CNPJData): string {
  const parts: string[] = []
  if (data.logradouro) {
    parts.push(data.logradouro)
    if (data.numero && data.numero !== 'S/N') parts.push(data.numero)
    if (data.complemento) parts.push(data.complemento)
  }
  return parts.join(', ').trim() || 'Endereço não informado'
}

/**
 * Formata CNPJ para exibição: XX.XXX.XXX/XXXX-XX
 */
export function formatCNPJDisplay(cnpj: string): string {
  const c = cleanCNPJ(cnpj)
  if (c.length !== 14) return cnpj
  return c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

/**
 * Busca dados do CNPJ na Brasil API.
 * Retorna dados formatados para o formulário de clientes.
 */
export async function searchCNPJ(
  cnpj: string
): Promise<{ success: true; data: CNPJFormData } | { success: false; error: string }> {
  const raw = cleanCNPJ(cnpj)
  if (raw.length !== 14) {
    return { success: false, error: 'CNPJ deve ter 14 dígitos' }
  }

  try {
    const res = await fetch(`${BRASIL_API_CNPJ}/${raw}`, {
      headers: { Accept: 'application/json' },
    })

    if (!res.ok) {
      if (res.status === 404) {
        return { success: false, error: 'CNPJ não encontrado na base da Receita Federal' }
      }
      return { success: false, error: 'Serviço de consulta CNPJ indisponível. Tente novamente.' }
    }

    const data: CNPJData = await res.json()

    const companyName = (data.nome_fantasia && data.nome_fantasia.trim() !== '')
      ? data.nome_fantasia.trim()
      : data.razao_social.trim()

    const cep = (data.cep || '').replace(/\D/g, '')
    if (cep.length !== 8) {
      return { success: false, error: 'CEP do CNPJ inválido ou não informado' }
    }

    const phone = data.ddd_telefone_1
      ? data.ddd_telefone_1.replace(/\D/g, '')
      : undefined
    const formattedPhone =
      phone && phone.length >= 10
        ? `(${phone.slice(0, 2)}) ${phone.length === 11 ? phone.slice(2, 7) + '-' + phone.slice(7) : phone.slice(2, 6) + '-' + phone.slice(6)}`
        : undefined

    const formData: CNPJFormData = {
      companyName,
      cnpj: formatCNPJDisplay(raw),
      address: buildAddress(data),
      neighborhood: data.bairro || '',
      city: data.municipio || '',
      state: (data.uf || '').toUpperCase(),
      cep: `${cep.slice(0, 5)}-${cep.slice(5)}`,
      phone: formattedPhone,
      email: data.email && data.email.trim() ? data.email.trim() : undefined,
    }

    return { success: true, data: formData }
  } catch {
    return { success: false, error: 'Erro ao consultar CNPJ. Verifique sua conexão.' }
  }
}
