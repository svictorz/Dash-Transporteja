import type { CotacaoDraft } from '@/lib/types/cotacao-erp'

export type ProposalKind = 'fracionado' | 'dedicado'
export type ProposalAnalysis = {
  id: string
  created_at: string
  snapshot: { draft: CotacaoDraft; distance_km: number; distance_source?: string; rules?: { selected_vehicle?: string; fractional_vehicle?: string } }
  result: Record<ProposalKind, { total: number | null; minimum?: number | null }>
}

export function parseCotacaoPdfPrice(raw: string): number | null {
  const value = raw.trim().replace(/^R\$\s*/, '')
  const brazilian = /^\d+(?:,\d{1,2})?$/.test(value) || /^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(value)
  const decimalDot = /^\d+\.\d{1,2}$/.test(value)
  if (!brazilian && !decimalDot) return null
  const amount = Number(brazilian ? value.replace(/\./g, '').replace(',', '.') : value)
  return Number.isFinite(amount) ? amount : null
}

export function buildCotacaoProposal(analysis: ProposalAnalysis, kind: ProposalKind, pdfPrice?: number) {
  const draft = analysis.snapshot?.draft
  const distanceKm = Number(analysis.snapshot?.distance_km)
  const analyzedTotal = Number(analysis.result?.[kind]?.total)
  if (!draft?.origem?.trim() || !draft?.destino?.trim() || !Number.isFinite(distanceKm) || distanceKm <= 0 || !Number.isFinite(analyzedTotal) || analyzedTotal < 1500 || !Number.isFinite(Number(draft.cubagemM3)) || Number(draft.cubagemM3) <= 0) {
    throw new Error('Dados aprovados insuficientes para gerar a proposta.')
  }
  const total = pdfPrice ?? analyzedTotal
  const minimum = Math.max(1500, Number(analysis.result[kind].minimum) || 1500)
  if (!Number.isFinite(total) || total < minimum || Math.abs(total * 100 - Math.round(total * 100)) > 1e-6) {
    throw new Error('Informe um valor válido, com até dois decimais, igual ou acima do mínimo da modalidade.')
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
    priceAdjusted: Math.abs(total - analyzedTotal) >= 0.01,
  }
}

export type CotacaoProposal = ReturnType<typeof buildCotacaoProposal>
