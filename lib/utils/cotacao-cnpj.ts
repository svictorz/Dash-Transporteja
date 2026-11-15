import type { CNPJFormData } from '@/lib/services/cnpj'
import type { CotacaoDraft } from '@/lib/types/cotacao-erp'

export type CotacaoCnpjParty = 'remetente' | 'destinatario'

export function applyCnpjLocation(draft: CotacaoDraft, party: CotacaoCnpjParty, company: CNPJFormData): CotacaoDraft {
  const city = company.city?.trim()
  const state = company.state?.trim().toUpperCase()
  if (!city || !/^[A-Z]{2}$/.test(state ?? '')) throw new Error('O CNPJ não possui município e UF válidos para calcular a rota.')
  const location = `${city}/${state}`
  const address = [company.address, company.neighborhood, location, company.cep].filter(Boolean).join(' · ')
  return party === 'remetente'
    ? { ...draft, origem: location, remetenteCnpj: company.cnpj, remetenteNome: company.companyName, remetenteEndereco: address }
    : { ...draft, destino: location, destinatarioCnpj: company.cnpj, destinatarioNome: company.companyName, destinatarioEndereco: address }
}
