/**
 * Serviço de busca de CEP via API
 * Usa a API ViaCEP (gratuita e sem necessidade de autenticação)
 */

export interface CEPData {
  cep: string
  logradouro: string
  complemento?: string
  bairro: string
  localidade: string
  uf: string
  erro?: boolean
}

/**
 * Busca dados de endereço pelo CEP
 */
export async function searchCEP(cep: string): Promise<{ success: boolean; data?: CEPData; error?: string }> {
  // Remove caracteres não numéricos
  const cleanCEP = cep.replace(/\D/g, '')

  if (cleanCEP.length !== 8) {
    return { success: false, error: 'CEP deve ter 8 dígitos' }
  }

  try {
    // Usa API ViaCEP (gratuita)
    const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`)

    if (!response.ok) {
      return { success: false, error: 'Erro ao buscar CEP. Tente novamente.' }
    }

    const data: CEPData = await response.json()

    // Verifica se CEP foi encontrado
    if (data.erro) {
      return { success: false, error: 'CEP não encontrado' }
    }

    // Formata CEP
    const formattedCEP = `${cleanCEP.slice(0, 5)}-${cleanCEP.slice(5)}`

    return {
      success: true,
      data: {
        ...data,
        cep: formattedCEP
      }
    }
  } catch (error: any) {
    console.error('Erro ao buscar CEP:', error)
    return { success: false, error: 'Erro ao conectar com o serviço de CEP. Verifique sua conexão.' }
  }
}

/**
 * Formata endereço completo a partir dos dados do CEP
 */
export function formatAddress(cepData: CEPData, number?: string, complement?: string): string {
  const parts: string[] = []

  if (cepData.logradouro) {
    parts.push(cepData.logradouro)
    if (number) {
      parts.push(`nº ${number}`)
    }
  }

  if (complement) {
    parts.push(complement)
  }

  if (cepData.bairro) {
    parts.push(cepData.bairro)
  }

  if (cepData.localidade) {
    parts.push(cepData.localidade)
  }

  if (cepData.uf) {
    parts.push(cepData.uf)
  }

  if (cepData.cep) {
    parts.push(`CEP: ${cepData.cep}`)
  }

  return parts.join(', ')
}

