/**
 * Legado: dados da Ágape Transportes (emitente padrão).
 * Preferir `getPropostaDoc('agape')` em código novo.
 */
import { getPropostaDoc, propostaDocEnderecoUmaLinha as enderecoLinha } from '@/lib/constants/proposta-emitentes'

const agape = getPropostaDoc('agape')

export const PROPOSTA_DOC_EMPRESA = {
  nomeFantasia: agape.nomeFantasia,
  razaoSocial: agape.razaoSocial,
  nomeExibicao: agape.nomeFantasia,
  nomeMaiusculo: agape.nomeMaiusculo,
  cnpjNumeros: '40189703000124',
  cnpj: agape.cnpj,
  matriz: agape.matriz,
  enderecoLogradouro: agape.enderecoLogradouro,
  enderecoBairroCepCidade: agape.enderecoBairroCepCidade,
  inscricaoEstadual: agape.inscricaoEstadual,
  telefone: agape.telefone,
  dataAbertura: '23/12/2020',
  porte: 'ME',
  naturezaJuridica: '206-2 — Sociedade Empresária Limitada',
  cnaePrincipal:
    '49.30-2/02 — Transporte rodoviário de carga, exceto produtos perigosos e mudanças, intermunicipal, interestadual e internacional',
  slogan: agape.slogan,
  rodape: agape.rodape,
  validadeDias: agape.validadeDias,
}

/** Linha única de endereço (impressão / textos compactos) — emitente Ágape. */
export function propostaDocEnderecoUmaLinha(): string {
  return enderecoLinha('agape')
}
