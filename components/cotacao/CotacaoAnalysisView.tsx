'use client'

import { useState } from 'react'
import type { CotacaoDraft } from '@/lib/types/cotacao-erp'
import type { CotacaoCnpjParty } from '@/lib/utils/cotacao-cnpj'
import { cotacaoAd, cotacaoMessage, cotacaoWhatsAppLink, type CotacaoMessageStyle, type CotacaoMessageTemplates, type CotacaoMessageTitles } from '@/lib/utils/cotacao-messages'
import { ANTT_TABLE_A_SOURCE, ANTT_TABLE_A_VALID_FROM, anttMinimumForVehicle, anttReferenceRows, type AnttVehicle } from '@/lib/utils/cotacao-antt'
import RouteMap from './RouteMap'

type Vehicle = AnttVehicle & { payloadKg: number; pricePerKm?: number }
type Scenario = { floor: number; taxes: number; insurance: number; pgr: number; tolls: number; collection: number; total: number }
type Analysis = { created_at: string; snapshot?: { draft?: CotacaoDraft; distance_km?: number; rules?: Record<string, unknown> }; result: { fracionado: Scenario; dedicado: Scenario } }
type SimilarQuote = { id: string; draft: CotacaoDraft; created_at: string }

type Props = {
  raw: string
  draft: CotacaoDraft
  distance: string
  source: 'route-api' | 'manual'
  routeCoordinates: [number, number][] | null
  routeDuration: number | null
  busy: boolean
  viewingAnotherUser: boolean
  cnpjLoading: boolean
  cnpjErrors: Partial<Record<CotacaoCnpjParty, string>>
  analysis: Analysis | null
  analysisError: string
  quoteSettingsReady: boolean
  fleetSettingsReady: boolean
  isAdmin: boolean
  vehicles: Vehicle[]
  anttSourceUrl?: string
  anttEffectiveFrom?: string
  templates: CotacaoMessageTemplates
  titles: CotacaoMessageTitles
  similar: SimilarQuote[]
  onRawChange: (value: string) => void
  onExtract: () => void
  onFieldChange: (key: keyof CotacaoDraft, value: string | number | null) => void
  onLookupCnpjs: () => void
  onDistanceChange: (value: string) => void
  onRoute: () => void
  onAnalyze: () => void
  onVehicleChange: (name: string) => void
  onOpenSettings: () => void
  onPrint: (kind: 'fracionado' | 'dedicado') => void
  onDownloadJson: () => void
  onOpenQuote: (id: string) => void
}

const brl = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
const unitBrl = (value: number) => Number.isFinite(value) && value > 0 ? brl(value) : '—'
const input = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100'
const label = 'grid gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300'
const subheading = 'mb-3 border-b border-gray-100 pb-3 text-sm font-semibold text-slate-900 dark:border-slate-700 dark:text-slate-100'

export default function CotacaoAnalysisView({
  raw, draft, distance, source, routeCoordinates, routeDuration,
  busy, viewingAnotherUser, cnpjLoading, cnpjErrors, analysis, analysisError, quoteSettingsReady, fleetSettingsReady, isAdmin, vehicles, anttSourceUrl, anttEffectiveFrom, templates, titles, similar, onRawChange, onExtract, onFieldChange, onLookupCnpjs, onDistanceChange, onRoute,
  onAnalyze, onVehicleChange, onOpenSettings, onPrint, onDownloadJson, onOpenQuote,
}: Props) {
  const googleKm = Number(draft.googleKm)
  const routeKm = Number(distance)
  const googleDiffers = googleKm > 0 && routeKm > 0 && Math.abs(googleKm - routeKm) / routeKm > 0.15
  const [messageStyle, setMessageStyle] = useState<CotacaoMessageStyle>('Abordagem inicial')
  const prices = analysis ? { fracionado: analysis.result.fracionado.total, dedicado: analysis.result.dedicado.total } : undefined
  const priceStyle = messageStyle === 'Apresentação de valores' || messageStyle.startsWith('Proposta ')
  const selectedStyle = priceStyle && !analysis ? 'Abordagem inicial' : messageStyle
  const clientMessage = cotacaoMessage(draft, selectedStyle, prices, templates)
  const adText = cotacaoAd(draft, templates)
  const whatsappLink = cotacaoWhatsAppLink(draft.telefone, clientMessage)
  const hasRoute = Number.isFinite(routeKm) && routeKm > 0 && Boolean(draft.origem && draft.destino)
  const marginReady = draft.marginPercent != null && Number.isFinite(draft.marginPercent) && draft.marginPercent >= 0 && draft.marginPercent <= 100
  const settingsReady = quoteSettingsReady && fleetSettingsReady
  const pendingReason = !marginReady
    ? 'Preencha a margem de lucro e clique em Analisar Proposta.'
    : !settingsReady
      ? `${isAdmin ? 'Salve' : 'Peça ao administrador para salvar'} ${!quoteSettingsReady ? 'os percentuais' : ''}${!quoteSettingsReady && !fleetSettingsReady ? ' e ' : ''}${!fleetSettingsReady ? 'a frota' : ''} na engrenagem.`
      : 'Clique em Analisar Proposta para calcular os valores.'
  const anttRows = anttReferenceRows(vehicles, routeKm, draft.pesoKg, draft.cubagemM3)
  const analysisVehicles = Array.isArray(analysis?.snapshot?.rules?.vehicles) ? analysis.snapshot.rules.vehicles as Vehicle[] : []
  const analyzedWeight = Number(analysis?.snapshot?.draft?.pesoKg)
  const analyzedVolume = Number(analysis?.snapshot?.draft?.cubagemM3)
  const compatibleVehicles = analysisVehicles.filter(vehicle => Number(vehicle.payloadKg) >= analyzedWeight && Number(vehicle.volumeM3) >= analyzedVolume && Number(vehicle.pricePerKm) > 0)
  const analyzedVehicle = analysis?.snapshot?.rules?.selected_vehicle
  const prepareProposal = (kind: 'fracionado' | 'dedicado') => {
    setMessageStyle(kind === 'fracionado' ? 'Proposta fracionado' : 'Proposta dedicado')
    requestAnimationFrame(() => document.getElementById('cotacao-mensagem')?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }

  return <div className="grid items-start gap-[18px] xl:grid-cols-[minmax(0,42fr)_minmax(0,58fr)] print:hidden">
    <section className="rounded-2xl border border-gray-200 bg-white p-5 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
      <h2 className={subheading}>1. Extração de carga</h2>
      <textarea
        aria-label="Cole o pedido de frete"
        className={`${input} min-h-[180px] resize-y bg-[#fbfcfe] placeholder:text-slate-500 dark:bg-slate-950 dark:placeholder:text-slate-400`}
        placeholder={'Formatos aceitos:\nWhatsApp/E-mail: Origem/Destino · Peso · Cubagem · CNPJ · Endereço · Telefone\ncargas.com.br: Rota → para · Nota · Peso\nColeta: dimensões de pallets · Valor coleta'}
        value={raw}
        onChange={event => onRawChange(event.target.value)}
      />
      <button type="button" onClick={onExtract} className="mt-2.5 w-full rounded-lg bg-[#2878ef] px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700">
        ⌕ Extrair dados do frete
      </button>

      <h2 className={`${subheading} mt-7`}>2. Dados da cotação</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>Origem<input className={input} value={draft.origem} onChange={event => onFieldChange('origem', event.target.value)} placeholder="Cidade/UF" /></label>
        <label className={label}>Destino<input className={input} value={draft.destino} onChange={event => onFieldChange('destino', event.target.value)} placeholder="Cidade/UF" /></label>
        <label className={label}>Peso (kg)<input className={input} type="number" min="0" step="any" value={draft.pesoKg ?? ''} onChange={event => onFieldChange('pesoKg', event.target.value === '' ? null : Number(event.target.value))} placeholder="Ex.: 3585" /></label>
        <label className={label}>Valor NF (R$)<input className={input} type="number" min="0" step="any" value={draft.valorNota ?? ''} onChange={event => onFieldChange('valorNota', event.target.value === '' ? null : Number(event.target.value))} placeholder="Ex.: 14916,47" /></label>
        <label className={`${label} rounded-xl border border-blue-300 bg-blue-50 p-2.5 font-semibold text-blue-900 dark:border-blue-500/50 dark:bg-blue-950/40 dark:text-blue-200`}>Margem de lucro (%)<input id="cotacao-margem" className={`${input} border-blue-200 bg-white font-bold text-blue-900 dark:border-blue-500/50 dark:bg-slate-900 dark:text-blue-100`} type="number" min="0" max="100" step="any" value={draft.marginPercent ?? ''} onChange={event => onFieldChange('marginPercent', event.target.value === '' ? null : Number(event.target.value))} placeholder="Ex.: 20" /></label>
        <label className={label}>WhatsApp<input className={input} value={draft.telefone} onChange={event => onFieldChange('telefone', event.target.value)} placeholder="Ex.: (11) 9 6451-3724" /></label>
      </div>

      <details className="mt-5 border-t border-[#e5ebf2] pt-4 dark:border-slate-700">
        <summary className="cursor-pointer text-sm font-semibold">Consultar endereços por CNPJ</summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2" aria-label="Consulta dos CNPJs da rota">
        {(['remetente', 'destinatario'] as const).map(party => {
          const cnpj = party === 'remetente' ? draft.remetenteCnpj : draft.destinatarioCnpj
          const name = party === 'remetente' ? draft.remetenteNome : draft.destinatarioNome
          const address = party === 'remetente' ? draft.remetenteEndereco : draft.destinatarioEndereco
          const field = party === 'remetente' ? 'remetenteCnpj' : 'destinatarioCnpj'
          return <div key={party} className="rounded-xl border border-gray-200 bg-gray-50 p-3.5 dark:border-slate-700 dark:bg-slate-800">
            <label className={label}>CNPJ {party}<input className={`${input} mt-1`} inputMode="numeric" autoComplete="off" value={cnpj ?? ''} onChange={event => onFieldChange(field, event.target.value)} placeholder="00.000.000/0000-00" /></label>
            {cnpjErrors[party] && <p role="alert" className="mt-2 text-xs text-rose-700 dark:text-rose-300">{cnpjErrors[party]}</p>}
            {address && <div className="mt-2 text-xs text-slate-600 dark:text-slate-300"><strong className="block text-slate-800 dark:text-white">{name}</strong><span>{address}</span></div>}
          </div>
        })}
      </div>
      <button type="button" disabled={cnpjLoading || !(draft.remetenteCnpj?.trim() || draft.destinatarioCnpj?.trim())} onClick={onLookupCnpjs} className="mt-3 w-full rounded-lg border border-blue-500 px-3 py-2.5 text-sm font-semibold text-blue-700 disabled:opacity-50 dark:text-blue-300">{cnpjLoading ? 'Consultando endereços…' : 'Buscar endereços dos CNPJs'}</button>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">O CNPJ informa o endereço cadastral. Confirme a cidade real de coleta e entrega antes de calcular a rota.</p>
      </details>

      <div className="mt-[18px] rounded-xl border border-gray-200 bg-gray-50 p-3.5 dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-100">🗺 Mapa da rota / cálculo de distância</h3>
          <button type="button" disabled={busy || !draft.origem || !draft.destino} onClick={onRoute} className="rounded-lg bg-[#2878ef] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">⌕ Calcular rota</button>
        </div>
        <RouteMap coordinates={routeCoordinates} origin={draft.origem} destination={draft.destino} />
        {routeCoordinates && <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">✓ Origem e destino marcados · {routeKm.toLocaleString('pt-BR')} km{routeDuration ? ` · ${Math.round(routeDuration / 60)} h` : ''}</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>Distância km *<input className={input} type="number" min="0.1" step="0.1" value={distance} onChange={event => onDistanceChange(event.target.value)} placeholder="Ex.: 1284,8" /></label>
        <label className={label}>Km Google Maps (opcional)<input className={input} type="number" min="0" step="0.1" value={draft.googleKm ?? ''} onChange={event => onFieldChange('googleKm', event.target.value === '' ? null : Number(event.target.value))} placeholder="Ex.: 1280" /></label>
      </div>
      <p className="mt-1.5 text-xs text-[#59708f]">{source === 'route-api' ? 'Distância calculada pela rota' : 'Distância informada manualmente'}</p>
      {googleDiffers && <p role="alert" className="mt-2 text-xs font-medium text-rose-700">A distância do Google Maps difere mais de 15% da distância usada nesta cotação.</p>}

      <details className="mt-5 border-t border-[#e5ebf2] pt-4 dark:border-slate-700">
        <summary className="cursor-pointer text-sm font-semibold">Dados adicionais do pedido</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className={label}>Quantidade<input className={input} type="number" min="0" value={draft.quantidade ?? ''} onChange={event => onFieldChange('quantidade', event.target.value === '' ? null : Number(event.target.value))} placeholder="Ex.: 172" /></label>
          <label className={label}>Cubagem (m³)<input className={input} type="number" min="0" step="any" value={draft.cubagemM3 ?? ''} onChange={event => onFieldChange('cubagemM3', event.target.value === '' ? null : Number(event.target.value))} placeholder="Ex.: 2,81" /></label>
          <label className={label}>Peso cúbico (kg)<input className={input} type="number" min="0" step="any" value={draft.pesoCubicoKg ?? ''} onChange={event => onFieldChange('pesoCubicoKg', event.target.value === '' ? null : Number(event.target.value))} placeholder="Ex.: 938,25" /></label>
          <label className={label}>Cliente<input className={input} value={draft.cliente} onChange={event => onFieldChange('cliente', event.target.value)} placeholder="Ex.: Nicole" /></label>
          <label className={label}>E-mail<input className={input} type="email" value={draft.email} onChange={event => onFieldChange('email', event.target.value)} placeholder="Ex.: nome@empresa.com" /></label>
          <label className={`${label} sm:col-span-2`}>Observações<textarea className={`${input} min-h-20`} value={draft.observacoes} onChange={event => onFieldChange('observacoes', event.target.value)} placeholder="Ex.: tipo da carga, medidas e instruções de coleta" /></label>
        </div>
      </details>

      {vehicles.length > 0 && (draft.pesoKg || draft.cubagemM3) && <div className="mt-5 border-t border-[#e5ebf2] pt-4 dark:border-slate-700">
        <h3 className="text-sm font-bold uppercase text-[#294669] dark:text-blue-200">Ocupação de frota</h3>
        {vehicles.map(vehicle => {
          const weightPercent = draft.pesoKg && vehicle.payloadKg > 0 ? draft.pesoKg / vehicle.payloadKg * 100 : 0
          const volumePercent = draft.cubagemM3 && vehicle.volumeM3 && vehicle.volumeM3 > 0 ? draft.cubagemM3 / vehicle.volumeM3 * 100 : 0
          const percent = Math.round(Math.max(weightPercent, volumePercent))
          const exceedsCapacity = weightPercent > 100 || volumePercent > 100
          const capacityStatus = exceedsCapacity ? 'Excede capacidade' : draft.pesoKg && draft.cubagemM3 ? 'Viável' : 'A confirmar'
          return <div key={vehicle.name} className="mt-2 rounded-lg border border-[#e4ebf2] p-2 text-xs dark:border-slate-700">
            <div className="flex flex-wrap justify-between gap-2"><strong>{vehicle.name} · {vehicle.axles} eixos</strong><span className={exceedsCapacity ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'}>{capacityStatus}</span></div>
            <p className="mt-1 text-slate-600 dark:text-slate-300">{draft.pesoKg?.toLocaleString('pt-BR') ?? '—'} / {vehicle.payloadKg.toLocaleString('pt-BR')} kg · {draft.cubagemM3?.toLocaleString('pt-BR') ?? '—'} / {vehicle.volumeM3?.toLocaleString('pt-BR') ?? '—'} m³</p>
            <div className="mt-1 h-1.5 rounded-full bg-[#e8f1eb]"><div className={`h-1.5 rounded-full ${exceedsCapacity ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(percent, 100)}%` }} /></div>
          </div>
        })}
      </div>}

      <div className="mt-5 flex justify-center border-t border-[#e5ebf2] pt-4 dark:border-slate-700">
        <button type="button" onClick={onAnalyze} disabled={viewingAnotherUser || busy} className="w-full rounded-lg bg-emerald-600 px-8 py-3 text-base font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 sm:w-auto sm:min-w-[240px]">Analisar Proposta</button>
      </div>
      {analysisError && <p role="alert" className="mt-2 text-center text-sm text-amber-700 dark:text-amber-300">{analysisError}</p>}
    </section>

    <section className="min-h-[600px] overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <h2 className="border-b border-gray-100 px-5 py-4 text-sm font-semibold text-slate-900 dark:border-slate-700 dark:text-slate-100">Painel de diagnóstico</h2>
      <div className="space-y-3 p-3.5">
        {analysis ? <>
          <div className="rounded-xl border-l-4 border-emerald-500 bg-emerald-50 p-4 text-[#102548] dark:bg-emerald-950 dark:text-white">
            <strong className="text-sm uppercase text-emerald-800 dark:text-emerald-200">Viabilidade calculada</strong>
            <p className="mt-1 text-xs">Análise registrada em {new Date(analysis.created_at).toLocaleString('pt-BR')} com a frota, os percentuais e a margem informados.</p>
          </div>
          {compatibleVehicles.length > 0 && <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
            <label htmlFor="cotacao-veiculo" className="text-xs font-semibold text-slate-600 dark:text-slate-300">Veículo</label>
            <select id="cotacao-veiculo" aria-label="Veículo da cotação" value={typeof analyzedVehicle === 'string' ? analyzedVehicle : ''} onChange={event => onVehicleChange(event.target.value)} disabled={busy || viewingAnotherUser} className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white sm:max-w-[260px]">
              {typeof analyzedVehicle !== 'string' && <option value="" disabled>Selecione um veículo</option>}
              {compatibleVehicles.map(vehicle => <option key={vehicle.name} value={vehicle.name}>{vehicle.name}</option>)}
            </select>
            {busy && <span className="text-xs text-slate-500 dark:text-slate-400">Atualizando valores…</span>}
            {analysisError && <p role="alert" className="w-full text-xs text-amber-700 dark:text-amber-300">{analysisError}</p>}
          </div>}
          <div className="grid gap-3 md:grid-cols-2">
            {(['fracionado', 'dedicado'] as const).map(kind => {
              const item = analysis.result[kind]
              const quotedDraft = analysis.snapshot?.draft ?? draft
              const quotedDistance = Number(analysis.snapshot?.distance_km ?? distance)
              const taxPercent = Number(analysis.snapshot?.rules?.tax_percent)
              const driverMaxPercent = Number(analysis.snapshot?.rules?.driver_max_percent)
              const driverCeiling = Number.isFinite(driverMaxPercent) && driverMaxPercent >= 0 ? item.total * driverMaxPercent / 100 : null
              const snapshotVehicles = Array.isArray(analysis.snapshot?.rules?.vehicles) ? analysis.snapshot.rules.vehicles as Vehicle[] : []
              const selectedVehicle = analysis.snapshot?.rules?.selected_vehicle
              const minimumFreight = typeof selectedVehicle === 'string'
                ? anttMinimumForVehicle(snapshotVehicles, selectedVehicle, quotedDistance)
                : null
              const isFractional = kind === 'fracionado'
              return <article key={kind} className={`rounded-xl border border-slate-200 border-l-4 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-900 ${isFractional ? 'border-l-blue-500 dark:border-l-blue-400' : 'border-l-violet-500 dark:border-l-violet-400'}`}>
                <h3 className={`mb-3 border-b border-slate-200 pb-2 text-center text-sm font-bold uppercase dark:border-slate-700 ${isFractional ? 'text-blue-800 dark:text-blue-200' : 'text-violet-800 dark:text-violet-200'}`}>{isFractional ? '📦' : '🚚'} {kind}</h3>
                <dl className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex justify-between gap-2"><dt>Custo base (veículo)</dt><dd className="font-semibold">{brl(item.floor)}</dd></div>
                  <div className="flex justify-between gap-2"><dt>Tributos{Number.isFinite(taxPercent) ? ` (${taxPercent.toLocaleString('pt-BR')}%)` : ''}</dt><dd className="font-semibold">{brl(item.taxes)}</dd></div>
                  <div className="flex justify-between gap-2"><dt>Seguro sobre NF</dt><dd className="font-semibold">{brl(item.insurance)}</dd></div>
                </dl>
                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center dark:border-slate-700 dark:bg-slate-800">
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">Valor final · negociável</span>
                  <strong className={`mt-0.5 block text-2xl ${isFractional ? 'text-blue-800 dark:text-blue-200' : 'text-violet-800 dark:text-violet-200'}`}>{brl(item.total)}</strong>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1 border-t border-slate-200 pt-2 text-center text-[10px] font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300">
                  <span>{unitBrl(item.total / quotedDistance)}/km</span>
                  <span>{unitBrl(item.total / Number(quotedDraft.pesoKg))}/kg</span>
                  <span>{unitBrl(item.total / Number(quotedDraft.cubagemM3))}/m³</span>
                </div>
                <div className="mt-2 rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-center dark:border-slate-600 dark:bg-slate-900/60">
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">Valor mínimo do frete</span>
                  <strong className="block text-sm text-slate-800 dark:text-slate-100">{minimumFreight === null ? '—' : brl(minimumFreight)}</strong>
                </div>
                <div className="mt-2 rounded-lg border border-amber-200 bg-white/70 px-3 py-2 text-center dark:border-amber-700 dark:bg-slate-900/60">
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">Teto motorista</span>
                  <strong className="block text-sm text-amber-800 dark:text-amber-200">{driverCeiling === null ? '—' : brl(driverCeiling)}</strong>
                </div>
              </article>
            })}
          </div>
          {similar.length > 0 && <div className="rounded-xl border border-[#dbe4ef] p-4 dark:border-slate-700"><h3 className="text-sm font-bold">Rotas semelhantes</h3>{similar.map(quote => <button key={quote.id} type="button" onClick={() => onOpenQuote(quote.id)} className="mt-2 block text-left text-xs text-blue-600">{quote.draft.origem} → {quote.draft.destino} · {new Date(quote.created_at).toLocaleDateString('pt-BR')}</button>)}</div>}
        </> : hasRoute ? <>
          <div className="rounded-xl border-l-4 border-amber-500 bg-amber-50 p-4 text-[#102548] dark:bg-amber-950 dark:text-white">
            <strong className="text-sm uppercase text-amber-800 dark:text-amber-200">◉ Análise financeira pendente</strong>
            <p className="mt-2 font-semibold">Rota e dados da carga prontos</p>
            <p className="mt-1 text-xs">{routeKm.toLocaleString('pt-BR')} km · {draft.pesoKg?.toLocaleString('pt-BR') ?? 'Peso não informado'} kg · NF {draft.valorNota == null ? 'não informada' : brl(draft.valorNota)}</p>
            <p className="mt-2 text-xs">{pendingReason}</p>
            {isAdmin && !settingsReady && <button type="button" onClick={onOpenSettings} className="mt-2 text-xs font-semibold underline">Abrir configurações da cotação</button>}
            {analysisError && <p role="alert" className="mt-2 text-xs font-semibold">{analysisError}</p>}
          </div>
          <div className="grid gap-3 md:grid-cols-2">{(['Fracionado', 'Dedicado'] as const).map(kind => <article key={kind} className="rounded-xl border border-[#dbe4ef] p-4 dark:border-slate-700"><h3 className="mb-3 border-b border-[#e5ecf3] pb-2 text-sm font-bold uppercase text-[#294669] dark:text-blue-200">{kind}</h3><p className="text-sm text-[#59708f] dark:text-slate-300">{pendingReason}</p></article>)}</div>
        </> : <div className="rounded-xl border border-[#e1e8f1] p-[18px] dark:border-slate-700">
          <h3 className="text-lg font-bold text-[#526c88] dark:text-slate-200">Pronto para analisar</h3>
          <p className="mt-3 text-sm text-[#59708f] dark:text-slate-300">Extraia os dados e calcule a rota.</p>
        </div>}
        {hasRoute && <div className="grid gap-2 sm:grid-cols-2" aria-label="Ações da proposta">
          <button type="button" disabled={!analysis || busy} onClick={() => onPrint('fracionado')} className="rounded-xl bg-emerald-600 px-3 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">▣ Gerar PDF Fracionado</button>
          <button type="button" disabled={!analysis || busy} onClick={() => onPrint('dedicado')} className="rounded-xl bg-blue-600 px-3 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">▣ Gerar PDF Dedicado</button>
          <button type="button" disabled={!analysis || busy} onClick={() => prepareProposal('fracionado')} className="rounded-xl bg-emerald-700 px-3 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">→ Proposta Fracionado</button>
          <button type="button" disabled={!analysis || busy} onClick={() => prepareProposal('dedicado')} className="rounded-xl bg-indigo-700 px-3 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">→ Proposta Dedicado</button>
          {!analysis && <p className="text-xs text-amber-700 dark:text-amber-300 sm:col-span-2">PDFs com preço e propostas ficam disponíveis após a análise.</p>}
        </div>}
        {hasRoute && <div className="rounded-xl border border-[#dbe4ef] p-4 dark:border-slate-700">
          <h3 className="text-sm font-bold text-[#294669] dark:text-blue-200">Tabela ANTT · carga geral</h3>
          <p className="mt-1 text-xs text-[#59708f] dark:text-slate-300">Tabela A, carga lotação com composição veicular contratada · {routeKm.toLocaleString('pt-BR')} km. Piso de referência = km × CCD + CC.</p>
          <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[510px] text-left text-xs">
            <thead><tr className="border-b dark:border-slate-700"><th className="py-2">Veículo / capacidade</th><th>Eixos</th><th>CCD R$/km</th><th>CC</th><th>Referência</th></tr></thead>
            <tbody>{anttRows.map(row => <tr key={row.name} className={`border-b dark:border-slate-700 ${row.fit === 'incompatível' ? 'bg-rose-100 text-rose-900 dark:bg-rose-500/20 dark:text-rose-200' : ''}`}>
              <td className="py-2 font-medium"><span className="block">{row.name}</span><span className="text-[10px] opacity-80">{row.payloadKg ? `${row.payloadKg.toLocaleString('pt-BR')} kg` : 'Capacidade a confirmar'} · {row.fit === 'incompatível' ? 'Não atende' : row.fit === 'compatível' ? 'Peso atende' : 'A confirmar'}</span></td><td>{row.axles}</td><td>{row.ccd.toLocaleString('pt-BR', { minimumFractionDigits: 4 })}</td><td>{brl(row.fixed)}</td><td className="font-semibold">{brl(row.reference)}</td>
            </tr>)}</tbody>
          </table></div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Capacidades cadastradas pela empresa; confirme peso, volume e tipo de carga antes da contratação. Esta tabela não define o preço comercial.</p>
          <a href={anttSourceUrl || ANTT_TABLE_A_SOURCE} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-blue-600 underline dark:text-blue-300">Fonte ANTT · vigência {anttEffectiveFrom || new Date(`${ANTT_TABLE_A_VALID_FROM}T12:00:00`).toLocaleDateString('pt-BR')}</a>
        </div>}
        {(hasRoute || analysis) && <div className="rounded-xl border border-[#dbe4ef] p-4 dark:border-slate-700">
          <h3 className="mb-2 text-sm font-bold uppercase text-[#294669] dark:text-blue-200">Mensagem ao cliente</h3>
          <label className="mb-2 block text-xs text-[#59708f] dark:text-slate-300">Estilo de mensagem<select className={`${input} mt-1`} value={selectedStyle} onChange={event => setMessageStyle(event.target.value as CotacaoMessageStyle)}>{(['Abordagem inicial', 'Confirmação de dados', ...(analysis ? ['Apresentação de valores', 'Proposta fracionado', 'Proposta dedicado'] : []), 'Acompanhamento'] as CotacaoMessageStyle[]).map(style => <option key={style} value={style}>{titles[style]}</option>)}</select></label>
          <textarea id="cotacao-mensagem" readOnly aria-label="Mensagem ao cliente" value={clientMessage} className={`${input} min-h-24`} />
          <div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={() => navigator.clipboard.writeText(clientMessage)} className="rounded-lg border px-3 py-2 text-xs">Copiar mensagem</button>{whatsappLink && <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-emerald-700 px-3 py-2 text-xs text-white">Enviar no WhatsApp</a>}{analysis && <button type="button" onClick={onDownloadJson} className="rounded-lg border px-3 py-2 text-xs">Baixar memória JSON</button>}</div>
          {!whatsappLink && <p className="mt-2 text-xs text-amber-700">Preencha um WhatsApp válido com DDD para enviar.</p>}
          <h3 className="mb-2 mt-5 text-sm font-bold uppercase text-[#294669] dark:text-blue-200">{titles['Anúncio Fretebrás']}</h3>
          <textarea readOnly aria-label="Anúncio Fretebrás" value={adText} className={`${input} min-h-28`} />
          <button type="button" onClick={() => navigator.clipboard.writeText(adText)} className="mt-2 rounded-lg bg-[#2878ef] px-3 py-2 text-xs font-bold text-white">Copiar anúncio</button>
        </div>}
      </div>
    </section>
  </div>
}
