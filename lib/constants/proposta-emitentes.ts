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
  /** Classes Tailwind extras no wordmark da proposta. */
  logoClassName?: string
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
    tabLabel: 'Sua Empresa Aqui',
    nomeFantasia: 'Sua Empresa Aqui',
    razaoSocial: 'SUA EMPRESA AQUI LTDA',
    nomeMaiusculo: 'SUA EMPRESA AQUI',
    cnpj: 'CNPJ: 00.000.000/0000-00',
    matriz: PROPOSTA_ENDERECO.matriz,
    enderecoLogradouro: PROPOSTA_ENDERECO.logradouro,
    enderecoBairroCepCidade: PROPOSTA_ENDERECO.bairroCepCidade,
    inscricaoEstadual: '',
    telefone: '',
    slogan: 'QUALIDADE E SEGURANCA LOGISTICA.',
    rodape: 'DOCUMENTO DIGITAL ORIGINAL - SUA EMPRESA AQUI LTDA',
    validadeDias: 7,
    codigoPrefix: 'SEA',
    logoSrc: '',
    logoFallbackText: 'SUA EMPRESA AQUI',
    logoClassName: 'max-h-[16mm] max-w-[48mm]',
  },
}

export function getPropostaDoc(emitente: PropostaEmitente): PropostaDocConfig {
  return PROPOSTA_DOC_BY_EMITENTE[emitente]
}

export function propostaDocEnderecoUmaLinha(emitente: PropostaEmitente): string {
  const e = getPropostaDoc(emitente)
  return `${e.enderecoLogradouro} - ${e.enderecoBairroCepCidade}`
}
