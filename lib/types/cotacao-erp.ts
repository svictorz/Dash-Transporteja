export type CotacaoDraft = {
  origem: string
  destino: string
  origensAdicionais?: string[]
  destinosAdicionais?: string[]
  pesoKg: number | null
  valorNota: number | null
  cubagemM3: number | null
  linearMeters?: number | null
  pesoCubicoKg: number | null
  googleKm: number | null
  marginPercent?: number | null
  selectedVehicleName?: string
  fractionalVehicleName?: string
  dedicatedVehicleName?: string
  quantidade: number | null
  telefone: string
  cliente: string
  email: string
  observacoes: string
  textoOriginal: string
  remetenteCnpj?: string
  remetenteNome?: string
  remetenteEndereco?: string
  destinatarioCnpj?: string
  destinatarioNome?: string
  destinatarioEndereco?: string
}

export type CotacaoDistance = {
  km: number
  source: 'route-api' | 'manual'
}
