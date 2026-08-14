/**
 * Configuracao por emitente da proposta.
 */

export type PropostaEmitente = 'empresa'

export interface PropostaDocConfig {
  id: PropostaEmitente
  tabLabel: string
  nomeFantasia: string
  razaoSocial: string
  nomeMaiusculo: string
  cnpj: string
  matriz: string
  enderecoLogradouro: string
  enderecoBairroCepCidade: string
  inscricaoEstadual: string
  telefone: string
  slogan: string
  rodape: string
  validadeDias: number
  /** Prefixo do codigo unico da proposta. */
  codigoPrefix: string
  logoSrc: string
  logoFallbackText: string
  /** Classes extras no wordmark da proposta. */
  logoClassName?: string
  /** Tamanho visual do logo no PDF/preview. */
  logoWidth?: string
  logoHeight?: string
}

export const PROPOSTA_EMITENTES: PropostaEmitente[] = ['empresa']

const PROPOSTA_ENDERECO = {
  matriz: 'MATRIZ - CAMPINAS / SP',
  logradouro: 'R. Alcides Modesto de Camargo, no 390, Sala C',
  bairroCepCidade: 'Parque Santa Barbara - CEP 13.064-030 - Campinas / SP',
} as const

export const PROPOSTA_DOC_BY_EMITENTE: Record<PropostaEmitente, PropostaDocConfig> = {
  empresa: {
    id: 'empresa',
    tabLabel: 'JCN Logistica',
    nomeFantasia: 'JCN Logistica',
    razaoSocial: 'JCN LOGISTICA',
    nomeMaiusculo: 'JCN LOGISTICA',
    cnpj: 'CNPJ: 61.800.528/0001-30',
    matriz: PROPOSTA_ENDERECO.matriz,
    enderecoLogradouro: PROPOSTA_ENDERECO.logradouro,
    enderecoBairroCepCidade: PROPOSTA_ENDERECO.bairroCepCidade,
    inscricaoEstadual: '',
    telefone: '',
    slogan: 'QUALIDADE E SEGURANCA LOGISTICA.',
    rodape: 'DOCUMENTO DIGITAL ORIGINAL - JCN LOGISTICA',
    validadeDias: 7,
    codigoPrefix: 'JCN',
    logoSrc: '/logo-jcn-preto.png',
    logoFallbackText: 'JCN LOGISTICA',
    logoClassName: '',
    logoWidth: '29mm',
    logoHeight: '9mm',
  },
}

export function getPropostaDoc(emitente: PropostaEmitente): PropostaDocConfig {
  return PROPOSTA_DOC_BY_EMITENTE[emitente]
}

export function propostaDocEnderecoUmaLinha(emitente: PropostaEmitente): string {
  const e = getPropostaDoc(emitente)
  return `${e.enderecoLogradouro} - ${e.enderecoBairroCepCidade}`
}
