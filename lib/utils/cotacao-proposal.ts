import type { CotacaoDraft } from '@/lib/types/cotacao-erp'

export type ProposalKind = 'fracionado' | 'dedicado'
export type ProposalAnalysis = {
  id: string
  created_at: string
  snapshot: { draft: CotacaoDraft; distance_km: number; distance_source?: string; rules?: { selected_vehicle?: string; fractional_vehicle?: string } }
  result: Record<ProposalKind, { total: number | null }>
}

export function buildCotacaoProposal(analysis: ProposalAnalysis, kind: ProposalKind) {
  const draft = analysis.snapshot?.draft
  const distanceKm = Number(analysis.snapshot?.distance_km)
  const total = Number(analysis.result?.[kind]?.total)
  if (!draft?.origem?.trim() || !draft?.destino?.trim() || !Number.isFinite(distanceKm) || distanceKm <= 0 || !Number.isFinite(total) || total < 1500 || !Number.isFinite(Number(draft.cubagemM3)) || Number(draft.cubagemM3) <= 0) {
    throw new Error('Dados aprovados insuficientes para gerar a proposta.')
  }
  return {
    code: analysis.id.slice(0, 8).toUpperCase(),
    issuedAt: new Date().toISOString(),
    kind,
    vehicleName: (kind === 'fracionado' ? analysis.snapshot.rules?.fractional_vehicle || analysis.snapshot.rules?.selected_vehicle : analysis.snapshot.rules?.selected_vehicle)?.trim() || (kind === 'fracionado' ? draft.fractionalVehicleName?.trim() : draft.dedicatedVehicleName?.trim()) || null,
    contact: draft.cliente?.trim() || 'Não informado',
    contactPhone: draft.telefone?.trim() || null,
    contactEmail: draft.email?.trim() || null,
    sender: { name: draft.remetenteNome?.trim() || null, cnpj: draft.remetenteCnpj?.trim() || null, address: draft.remetenteEndereco?.trim() || null },
    recipient: { name: draft.destinatarioNome?.trim() || null, cnpj: draft.destinatarioCnpj?.trim() || null, address: draft.destinatarioEndereco?.trim() || null },
    origin: draft.origem,
    destination: draft.destino,
    weightKg: draft.pesoKg,
    volumeM3: draft.cubagemM3,
    quantity: draft.quantidade,
    invoiceValue: draft.valorNota,
    distanceKm,
    distanceSource: analysis.snapshot.distance_source,
    total,
  }
}

export type CotacaoProposal = ReturnType<typeof buildCotacaoProposal>
