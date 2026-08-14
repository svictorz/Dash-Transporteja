/**
 * Legado: dados do emitente padrao.
 * Preferir `getPropostaDoc('empresa')` em codigo novo.
 */
import { getPropostaDoc, propostaDocEnderecoUmaLinha as enderecoLinha } from '@/lib/constants/proposta-emitentes'

const empresa = getPropostaDoc('empresa')

export const PROPOSTA_DOC_EMPRESA = {
  nomeFantasia: empresa.nomeFantasia,
  razaoSocial: empresa.razaoSocial,
  nomeExibicao: empresa.nomeFantasia,
  nomeMaiusculo: empresa.nomeMaiusculo,
  cnpjNumeros: '00000000000000',
  cnpj: empresa.cnpj,
  matriz: empresa.matriz,
  enderecoLogradouro: empresa.enderecoLogradouro,
  enderecoBairroCepCidade: empresa.enderecoBairroCepCidade,
  inscricaoEstadual: empresa.inscricaoEstadual,
  telefone: empresa.telefone,
  dataAbertura: '01/01/2025',
  porte: 'ME',
  naturezaJuridica: '206-2 - Sociedade Empresaria Limitada',
  cnaePrincipal:
    '49.30-2/02 - Transporte rodoviario de carga, exceto produtos perigosos e mudancas, intermunicipal, interestadual e internacional',
  slogan: empresa.slogan,
  rodape: empresa.rodape,
  validadeDias: empresa.validadeDias,
}

/** Linha unica de endereco para impressao e textos compactos. */
export function propostaDocEnderecoUmaLinha(): string {
  return enderecoLinha('empresa')
}
