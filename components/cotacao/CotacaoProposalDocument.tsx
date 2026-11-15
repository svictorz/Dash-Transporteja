'use client'

import { getPropostaDoc } from '@/lib/constants/proposta-emitentes'
import PropostaBrandLogo from '@/components/propostas/PropostaBrandLogo'
import type { CotacaoProposal } from '@/lib/utils/cotacao-proposal'

const brl = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
const number = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })

export default function CotacaoProposalDocument({ proposal }: { proposal: CotacaoProposal }) {
  const doc = getPropostaDoc('empresa')
  return <section className="cotacao-proposal-print hidden bg-white text-slate-900 print:block" aria-label={`Proposta ${proposal.kind}`}>
    <header className="cotacao-proposal-header">
      <PropostaBrandLogo doc={doc} />
      <div><span>{doc.nomeMaiusculo}</span><h1>Proposta de cotação</h1><p>Transporte {proposal.kind}</p></div>
    </header>
    <div className="cotacao-proposal-issuer"><strong>{doc.razaoSocial}</strong><span>{doc.cnpj}</span><span>{doc.enderecoLogradouro} · {doc.enderecoBairroCepCidade}</span></div>
    <div className="cotacao-proposal-meta"><span>Emissão: {new Date(proposal.issuedAt).toLocaleDateString('pt-BR')}</span><span>Código: {proposal.code}</span></div>
    <h2>Rota de atendimento</h2>
    <div className="cotacao-proposal-route"><strong>{proposal.origin} → {proposal.destination}</strong><span>{number(proposal.distanceKm)} km · {proposal.distanceSource === 'manual' ? 'distância informada' : 'distância calculada'}</span></div>
    {(proposal.sender.cnpj || proposal.recipient.cnpj) && <div className="cotacao-proposal-parties">
      <div><strong>Remetente</strong><span>{proposal.sender.name || 'Empresa não informada'}</span><span>{proposal.sender.cnpj}</span><span>{proposal.sender.address}</span></div>
      <div><strong>Destinatário</strong><span>{proposal.recipient.name || 'Empresa não informada'}</span><span>{proposal.recipient.cnpj}</span><span>{proposal.recipient.address}</span></div>
    </div>}
    <h2 className="cotacao-proposal-subtitle">Dados da carga</h2>
    <dl className="cotacao-proposal-fields">
      <div><dt>Contato do pedido</dt><dd>{proposal.contact}</dd></div>
      {proposal.contactPhone && <div><dt>WhatsApp</dt><dd>{proposal.contactPhone}</dd></div>}
      {proposal.contactEmail && <div><dt>E-mail</dt><dd>{proposal.contactEmail}</dd></div>}
      <div><dt>Modalidade</dt><dd>Transporte {proposal.kind}</dd></div>
      {proposal.vehicleName && <div><dt>Veículo de referência</dt><dd>{proposal.vehicleName}</dd></div>}
      <div><dt>Peso real</dt><dd>{proposal.weightKg == null ? 'A confirmar' : `${number(proposal.weightKg)} kg`}</dd></div>
      <div><dt>Volumes</dt><dd>{proposal.quantity == null ? 'A confirmar' : number(proposal.quantity)}</dd></div>
      <div><dt>Cubagem</dt><dd>{proposal.volumeM3 == null ? 'A confirmar' : `${number(proposal.volumeM3)} m³`}</dd></div>
      <div><dt>Valor da nota fiscal</dt><dd>{proposal.invoiceValue == null ? 'A confirmar' : brl(proposal.invoiceValue)}</dd></div>
    </dl>
    <div className="cotacao-proposal-total"><span>Valor total do frete</span><strong>{brl(proposal.total)}</strong></div>
    <p className="cotacao-proposal-note">Proposta válida por {doc.validadeDias} dias a partir da emissão. Prazo, disponibilidade de equipamento e janela de coleta sujeitos à confirmação antes da contratação. Valor calculado com a tarifa por km, tributos, seguro e margem registrados nesta cotação.</p>
    <footer><strong>{doc.slogan}</strong><span>{doc.rodape}</span></footer>
  </section>
}
