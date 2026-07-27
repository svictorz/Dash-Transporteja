/** Estado do formulário de proposta de cotação (espelha o PDF). */
export interface PropostaFormState {
  remetente: string
  cnpjRemetente: string
  cnpjDestinatario: string
  destinatario: string
  cidadeOrigem: string
  ufOrigem: string
  cidadeDestino: string
  ufDestino: string
  distanciaKm: string
  codigoUnico: string
  tipoCarga: string
  cargaParam: string
  equipamento: string
  freteManual: string
  valorNf: string
  pesoKg: string
  volumes: string
  taxasFixas: string
  /** Texto livre exibido na proposta (PDF) */
  observacao: string
}

export function defaultPropostaFormState(codigoUnico: string): PropostaFormState {
  return {
    remetente: '',
    cnpjRemetente: '',
    cnpjDestinatario: '',
    destinatario: '',
    cidadeOrigem: '',
    ufOrigem: 'SP',
    cidadeDestino: '',
    ufDestino: '',
    distanciaKm: '',
    codigoUnico,
    tipoCarga: 'Carga Dedicada',
    cargaParam: '7',
    equipamento: 'Caminhão 3/4 (Baú)',
    freteManual: '',
    valorNf: '',
    pesoKg: '',
    volumes: '',
    taxasFixas: '0',
    observacao: '',
  }
}
