/**
 * Dados cadastrais fixos da AGAPE TRANSPORTES LTDA (comprovante CNPJ — matriz).
 * Usados na proposta de cotação (PDF) e demais telas que referenciem a empresa emitente.
 */
export const PROPOSTA_DOC_EMPRESA = {
  /** Nome fantasia */
  nomeFantasia: 'AGAPE TRANSPORTES',
  /** Razão social */
  razaoSocial: 'AGAPE TRANSPORTES LTDA',
  /** Exibição curta (legado / textos) */
  nomeExibicao: 'AGAPE TRANSPORTES',
  nomeMaiusculo: 'ÁGAPE TRANSPORTES',

  cnpjNumeros: '40189703000124',
  cnpj: 'CNPJ: 40.189.703/0001-24',

  matriz: 'MATRIZ — CAMPINAS / SP',
  enderecoLogradouro: 'R. Alcides Modesto de Camargo, nº 390, Sala C',
  enderecoBairroCepCidade: 'Parque Santa Bárbara — CEP 13.064-030 — Campinas / SP',

  /** Inscrição estadual: preencha quando for usar em NF / CT-e; omitida no PDF se vazia */
  inscricaoEstadual: '',

  /** Telefone comercial: preencha para aparecer no cabeçalho da proposta */
  telefone: '',

  dataAbertura: '23/12/2020',
  porte: 'ME',
  naturezaJuridica: '206-2 — Sociedade Empresária Limitada',
  cnaePrincipal:
    '49.30-2/02 — Transporte rodoviário de carga, exceto produtos perigosos e mudanças, intermunicipal, interestadual e internacional',

  slogan: 'QUALIDADE E SEGURANÇA LOGÍSTICA.',
  rodape: 'DOCUMENTO DIGITAL ORIGINAL — AGAPE TRANSPORTES LTDA',

  validadeDias: 7,
}

/** Linha única de endereço (impressão / textos compactos) */
export function propostaDocEnderecoUmaLinha(): string {
  const e = PROPOSTA_DOC_EMPRESA
  return `${e.enderecoLogradouro} — ${e.enderecoBairroCepCidade}`
}
