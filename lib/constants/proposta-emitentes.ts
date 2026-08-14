/**
 * Configuração por emitente da proposta (Ágape Transportes × JCN).
 */

export type PropostaEmitente = 'agape' | 'jcn'

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
  /** Prefixo do código único (ex.: AGT, JCN). */
  codigoPrefix: string
  logoSrc: string
  logoFallbackText: string
  /** Classes Tailwind extras no `<img>` do logo (proporção vertical, etc.). */
  logoClassName?: string
}

/** Emitentes com aba visível na tela de propostas (Ágape removida). */
export const PROPOSTA_EMITENTES: PropostaEmitente[] = ['jcn']

/** Endereço compartilhado (matriz Campinas) — Ágape e JCN. */
const PROPOSTA_ENDERECO = {
  matriz: 'MATRIZ — CAMPINAS / SP',
  logradouro: 'R. Alcides Modesto de Camargo, nº 390, Sala C',
  bairroCepCidade: 'Parque Santa Bárbara — CEP 13.064-030 — Campinas / SP',
} as const

export const PROPOSTA_DOC_BY_EMITENTE: Record<PropostaEmitente, PropostaDocConfig> = {
  agape: {
    id: 'agape',
    tabLabel: 'Ágape Transportes',
    nomeFantasia: 'Ágape Transportes',
    razaoSocial: 'AGAPE TRANSPORTES LTDA',
    nomeMaiusculo: 'ÁGAPE TRANSPORTES',
    cnpj: 'CNPJ: 40.189.703/0001-24',
    matriz: PROPOSTA_ENDERECO.matriz,
    enderecoLogradouro: PROPOSTA_ENDERECO.logradouro,
    enderecoBairroCepCidade: PROPOSTA_ENDERECO.bairroCepCidade,
    inscricaoEstadual: '',
    telefone: '',
    slogan: 'QUALIDADE E SEGURANÇA LOGÍSTICA.',
    rodape: 'DOCUMENTO DIGITAL ORIGINAL — AGAPE TRANSPORTES LTDA',
    validadeDias: 7,
    codigoPrefix: 'AGT',
    logoSrc: '/logo-proposta-agape.png',
    logoFallbackText: 'ÁGAPE',
    logoClassName: 'max-h-[16mm] max-w-[42mm]',
  },
  jcn: {
    id: 'jcn',
    tabLabel: 'JCN',
    nomeFantasia: 'JCN Logística',
    razaoSocial: 'JCN LOGÍSTICA',
    nomeMaiusculo: 'JCN LOG',
    cnpj: 'CNPJ: 61.800.528/0001-30',
    matriz: PROPOSTA_ENDERECO.matriz,
    enderecoLogradouro: PROPOSTA_ENDERECO.logradouro,
    enderecoBairroCepCidade: PROPOSTA_ENDERECO.bairroCepCidade,
    inscricaoEstadual: '',
    telefone: '',
    slogan: 'QUALIDADE E SEGURANÇA LOGÍSTICA.',
    rodape: 'DOCUMENTO DIGITAL ORIGINAL — JCN LOGÍSTICA',
    validadeDias: 7,
    codigoPrefix: 'JCN',
    logoSrc: '/logo-proposta-jcn.png',
    logoFallbackText: 'JCN',
    logoClassName: 'max-h-[14mm] max-w-[52mm]',
  },
}

export function getPropostaDoc(emitente: PropostaEmitente): PropostaDocConfig {
  return PROPOSTA_DOC_BY_EMITENTE[emitente]
}

export function propostaDocEnderecoUmaLinha(emitente: PropostaEmitente): string {
  const e = getPropostaDoc(emitente)
  return `${e.enderecoLogradouro} — ${e.enderecoBairroCepCidade}`
}
