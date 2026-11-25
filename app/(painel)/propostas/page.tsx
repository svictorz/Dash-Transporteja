'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import { extractCotacao } from '@/lib/utils/cotacao-extraction'
import { defaultCotacaoTemplates, defaultCotacaoTitles, hydrateCotacaoTemplates, validateCotacaoTemplates, validateCotacaoTitles, type CotacaoMessageTemplates, type CotacaoMessageTitles } from '@/lib/utils/cotacao-messages'
import { parseCotacaoTaxPercent } from '@/lib/utils/cotacao-tax'
import type { CotacaoDraft } from '@/lib/types/cotacao-erp'
import CotacaoAnalysisView from '@/components/cotacao/CotacaoAnalysisView'
import CotacaoProposalDocument from '@/components/cotacao/CotacaoProposalDocument'
import { buildCotacaoProposal, type ProposalKind } from '@/lib/utils/cotacao-proposal'
import { searchCNPJ, type CNPJFormData } from '@/lib/services/cnpj'
import { validateCNPJ } from '@/lib/utils/validation'
import { applyCnpjLocation, type CotacaoCnpjParty } from '@/lib/utils/cotacao-cnpj'
import { ANTT_REFERENCE_FLEET } from '@/lib/utils/cotacao-antt'
import { similarFreightsQuery, type SimilarFreight } from '@/lib/utils/cotacao-similar-freights'
import './cotacao-print.css'
import './cotacao-map.css'

type Vehicle = { name: string; payloadKg: number; volumeM3: number; axles: number; pricePerKm?: number; anttCcd?: number; anttFixed?: number }
type RuleSet = { vehicles?: Vehicle[]; anttSourceUrl?: string; anttEffectiveFrom?: string; selected_vehicle?: string; fractional_rule_id?: string; fractional_vehicle?: string } & { [key: string]: number | string | Vehicle[] | undefined }
type Analysis = { id: string; result: { fracionado: Scenario; dedicado: Scenario }; snapshot: { draft: CotacaoDraft; distance_km: number; distance_source?: string; rules: RuleSet }; created_at: string }
type Scenario = { floor: number | null; taxes: number | null; insurance: number | null; pgr: number; tolls: number; collection: number; total: number | null; minimum?: number | null; occupancy_pct?: number | null; status?: string }
const empty = () => extractCotacao('')
const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white'
const card = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900'
// Valores iniciais reproduzidos da tabela enviada pelo usuário; não são preços comerciais aprovados.
const fleetRatePerKm = [4.0738, 4.0738, 4.0738, 4.0738, 8.5, 8.2727, 6.8284, 7.5347, 8.2727, 9.4114]
const initialFleet = (): Vehicle[] => ANTT_REFERENCE_FLEET.map((vehicle, index) => ({ ...vehicle, payloadKg: vehicle.payloadKg ?? 0, volumeM3: vehicle.volumeM3 ?? 0, pricePerKm: fleetRatePerKm[index] }))

export default function CotacaoPage() {
  const { user } = useCurrentUser()
  const isAdmin = user?.role === 'admin'
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<'tributos' | 'precos' | 'mensagens'>('tributos')
  const settingsDialogRef = useRef<HTMLElement>(null)
  const settingsCloseRef = useRef<HTMLButtonElement>(null)
  const settingsTriggerRef = useRef<HTMLButtonElement>(null)
  const [raw, setRaw] = useState('')
  const [draft, setDraft] = useState<CotacaoDraft>(empty)
  const draftRef = useRef(draft)
  draftRef.current = draft
  const [quoteId, setQuoteId] = useState<string | null>(null)
  const [distance, setDistance] = useState('')
  const [source, setSource] = useState<'route-api' | 'manual'>('manual')
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][] | null>(null)
  const [routeDuration, setRouteDuration] = useState<number | null>(null)
  const [similarFreights, setSimilarFreights] = useState<SimilarFreight[]>([])
  const [similarFreightsLoading, setSimilarFreightsLoading] = useState(false)
  const [similarFreightsError, setSimilarFreightsError] = useState('')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [analysisError, setAnalysisError] = useState('')
  const [quoteSettingsReady, setQuoteSettingsReady] = useState(false)
  const [fleetSettingsReady, setFleetSettingsReady] = useState(false)
  const [printKind, setPrintKind] = useState<ProposalKind>('fracionado')
  const [pdfPriceEdits, setPdfPriceEdits] = useState<{ analysisId: string; fracionado: string; dedicado: string } | null>(null)
  const [printPrice, setPrintPrice] = useState<{ analysisId: string; kind: ProposalKind; amount: number } | null>(null)
  const [settingsDraft, setSettingsDraft] = useState<Record<string, string>>({})
  const [templates, setTemplates] = useState<CotacaoMessageTemplates>(defaultCotacaoTemplates)
  const [templateDraft, setTemplateDraft] = useState<CotacaoMessageTemplates>(defaultCotacaoTemplates)
  const [titles, setTitles] = useState<CotacaoMessageTitles>(defaultCotacaoTitles)
  const [userPhone, setUserPhone] = useState('')
  const [titleDraft, setTitleDraft] = useState<CotacaoMessageTitles>(defaultCotacaoTitles)
  const [vehiclesDraft, setVehiclesDraft] = useState<Vehicle[]>(initialFleet)
  const [fleetVehicles, setFleetVehicles] = useState<Vehicle[]>(initialFleet)
  const [fractionalRevisionId, setFractionalRevisionId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [cnpjLoading, setCnpjLoading] = useState(false)
  const [cnpjErrors, setCnpjErrors] = useState<Partial<Record<CotacaoCnpjParty, string>>>({})
  useEffect(() => {
    if (!user?.id || !analysis) {
      setSimilarFreights([])
      setSimilarFreightsError('')
      setSimilarFreightsLoading(false)
      return
    }
    const params = similarFreightsQuery(analysis.snapshot.draft, Number(analysis.snapshot.distance_km))
    if (!params) {
      setSimilarFreights([])
      setSimilarFreightsError('Informe cidade/UF na origem e no destino para comparar fretes.')
      setSimilarFreightsLoading(false)
      return
    }
    let active = true
    setSimilarFreights([])
    setSimilarFreightsError('')
    setSimilarFreightsLoading(true)
    void (async () => {
      try {
        const { data, error } = await supabase.rpc('erp_similar_freights', params)
        if (!active) return
        if (error) setSimilarFreightsError('Não foi possível consultar os fretes semelhantes. Tente novamente mais tarde.')
        else setSimilarFreights((data ?? []) as SimilarFreight[])
      } catch {
        if (active) setSimilarFreightsError('Não foi possível consultar os fretes semelhantes. Tente novamente mais tarde.')
      } finally {
        if (active) setSimilarFreightsLoading(false)
      }
    })()
    return () => { active = false }
  }, [analysis, user?.id])
  useEffect(() => {
    if (!user?.id) return
    let active = true
    void supabase.from('erp_quote_settings').select('tax_percent,insurance_percent,driver_max_percent').eq('id', 1).maybeSingle().then(({ data }) => {
      if (active && data) {
        setSettingsDraft({ tax_percent: String(data.tax_percent), insurance_percent: String(data.insurance_percent), driver_max_percent: String(data.driver_max_percent) })
        setQuoteSettingsReady(true)
      }
    })
    return () => { active = false }
  }, [user?.id])
  useEffect(() => {
    if (!user?.id) return
    let active = true
    void supabase.from('erp_fleet_settings').select('vehicles').eq('id', 1).maybeSingle().then(({ data }) => {
      if (!active || !Array.isArray(data?.vehicles)) return
      const saved = new Map((data.vehicles as Vehicle[]).map(vehicle => [vehicle.name, vehicle]))
      const merged = initialFleet().map(vehicle => ({ ...vehicle, ...saved.get(vehicle.name), name: vehicle.name, pricePerKm: saved.get(vehicle.name)?.pricePerKm ?? vehicle.pricePerKm }))
      setFleetVehicles(merged)
      setVehiclesDraft(merged)
      setFleetSettingsReady(true)
    })
    return () => { active = false }
  }, [user?.id])
  useEffect(() => {
    if (!isAdmin) return
    let active = true
    void (async () => {
      const { data: current } = await supabase.from('erp_fractional_truck_active').select('revision_id').eq('id',1).maybeSingle()
      if (!active || !current?.revision_id) return
      setFractionalRevisionId(current.revision_id)
    })()
    return () => { active = false }
  }, [isAdmin])
  useEffect(() => {
    if (!user?.id) return
    let active = true
    void supabase.from('users').select('phone').eq('id', user.id).maybeSingle().then(({ data }) => {
      if (active) setUserPhone(typeof data?.phone === 'string' ? data.phone : '')
    })
    return () => { active = false }
  }, [user?.id])
  useEffect(() => {
    if (!user?.id) return
    let active = true
    void supabase.from('erp_message_settings').select('templates,titles').eq('id', 1).maybeSingle().then(async ({ data, error }) => {
      const settings = error ? (await supabase.from('erp_message_settings').select('templates').eq('id', 1).maybeSingle()).data : data
      if (!active || !settings) return
      const loaded = hydrateCotacaoTemplates(settings.templates as Record<string, string>)
      const loadedTitles = { ...defaultCotacaoTitles, ...(('titles' in settings ? settings.titles : {}) as Record<string, string>) } as CotacaoMessageTitles
      if (!validateCotacaoTemplates(loaded)) { setTemplates(loaded); setTemplateDraft(loaded) }
      if (!validateCotacaoTitles(loadedTitles)) { setTitles(loadedTitles); setTitleDraft(loadedTitles) }
    })
    return () => { active = false }
  }, [user?.id])
  useEffect(() => {
    if (!settingsOpen) return
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    settingsCloseRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSettingsOpen(false)
      if (event.key !== 'Tab') return
      const controls = settingsDialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href]')
      if (!controls?.length) return
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = oldOverflow
      window.removeEventListener('keydown', onKeyDown)
      settingsTriggerRef.current?.focus()
    }
  }, [settingsOpen])

  const save = async (): Promise<string | null> => {
    if (!user?.id) { setMessage('Aguarde a identificação da sua conta.'); return null }
    if (!draft.origem.trim() || !draft.destino.trim()) { setMessage('Informe origem e destino.'); return null }
    const payload = { owner_id: user.id, draft, distance_km: distance ? Number(distance) : null, distance_source: distance ? source : null }
    const request = quoteId
      ? supabase.from('erp_quotes').update(payload).eq('id', quoteId).eq('owner_id', user.id).select('id').single()
      : supabase.from('erp_quotes').insert(payload).select('id').single()
    const { data, error } = await request
    if (error) { setMessage('Não foi possível salvar a cotação.'); return null }
    setQuoteId(data.id); setMessage('Cotação salva.'); return data.id
  }

  const route = async () => {
    if (!draft.origem || !draft.destino) { setMessage('Informe origem e destino.'); return }
    setBusy(true)
    try {
      const query = new URLSearchParams({ origem: draft.origem, destino: draft.destino, map: '1' })
      const response = await fetch(`/api/rotas/distancia?${query}`)
      if (!response.ok) throw new Error('Rota indisponível')
      const result = await response.json()
      if (!Number.isFinite(Number(result.distanciaKm)) || Number(result.distanciaKm) <= 0) throw new Error('Distância inválida')
      setDistance(String(result.distanciaKm)); setSource('route-api'); setAnalysis(null)
      setRouteCoordinates(Array.isArray(result.coordinates) ? result.coordinates : null)
      setRouteDuration(Number.isFinite(Number(result.duracaoMin)) ? Number(result.duracaoMin) : null)
      setMessage('')
    } catch { setMessage('Não foi possível calcular a rota. Confira as cidades ou informe a distância manualmente.') }
    finally { setBusy(false) }
  }

  const analyze = async () => {
    if (draft.cubagemM3 == null || !Number.isFinite(Number(draft.cubagemM3)) || Number(draft.cubagemM3) <= 0) {
      setAnalysisError('')
      document.getElementById('cotacao-cubagem')?.focus()
      return
    }
    if (!distance || !Number.isFinite(Number(distance)) || Number(distance) <= 0) { setAnalysisError('Calcule a rota ou informe uma distância válida.'); return }
    if (draft.marginPercent == null || !Number.isFinite(draft.marginPercent) || draft.marginPercent < 0) {
      setAnalysisError('Informe uma margem de lucro válida, igual ou maior que 0%, no campo destacado.')
      document.getElementById('cotacao-margem')?.focus()
      return
    }
    if (!quoteSettingsReady || !fleetSettingsReady) {
      setAnalysisError(`Antes de analisar, ${isAdmin ? 'salve' : 'peça ao administrador para salvar'} ${!quoteSettingsReady ? 'os percentuais em Tributos e seguro' : ''}${!quoteSettingsReady && !fleetSettingsReady ? ' e ' : ''}${!fleetSettingsReady ? 'a frota em Preço e frota' : ''}.`)
      return
    }
    setAnalysisError('')
    setBusy(true)
    try {
      const id = await save()
      if (!id) return
      const { data, error } = await supabase.rpc('erp_analyze_quote', { target_quote: id })
      if (error) { setAnalysisError(`Análise indisponível: ${error.message}`); return }
      setAnalysis(data as Analysis); setMessage('Análise registrada com a frota, percentuais e margem informados.')
    } finally { setBusy(false) }
  }

  const changeVehicle = async (name: string) => {
    if (!analysis || !quoteId || !user?.id || busy || name === analysis.snapshot?.rules?.selected_vehicle) return
    const previousDraft = draft
    const nextDraft = { ...draft, selectedVehicleName: name }
    const compatible = (analysis.snapshot?.rules?.vehicles ?? []).some(vehicle =>
      vehicle.name === name && vehicle.payloadKg >= Number(draft.pesoKg) && vehicle.volumeM3 >= Number(draft.cubagemM3) && Number(vehicle.pricePerKm) > 0)
    if (!compatible) { setAnalysisError('Escolha um veículo compatível com o peso e a cubagem.'); return }
    setBusy(true)
    setAnalysisError('')
    let saved = false
    try {
      const { error: saveError } = await supabase.from('erp_quotes').update({ draft: nextDraft }).eq('id', quoteId).eq('owner_id', user.id).select('id').single()
      if (saveError) throw saveError
      saved = true
      const { data, error } = await supabase.rpc('erp_analyze_quote', { target_quote: quoteId })
      if (error) throw error
      setDraft(nextDraft)
      setAnalysis(data as Analysis)
      setMessage(`Análise atualizada com ${name}.`)
    } catch (error) {
      if (saved) {
        const { error: restoreError } = await supabase.from('erp_quotes').update({ draft: previousDraft }).eq('id', quoteId).eq('owner_id', user.id)
        if (restoreError) setAnalysis(null)
      }
      setAnalysisError(`Não foi possível atualizar o veículo: ${error instanceof Error ? error.message : 'tente novamente'}.`)
    } finally { setBusy(false) }
  }

  const saveFleet = async () => {
    if (!isAdmin || !user?.id) return
    if (vehiclesDraft.some(vehicle => !Number.isFinite(vehicle.pricePerKm) || Number(vehicle.pricePerKm) <= 0 || !Number.isFinite(vehicle.payloadKg) || vehicle.payloadKg <= 0 || !Number.isFinite(vehicle.volumeM3) || vehicle.volumeM3 <= 0)) {
      setMessage('Informe valor por km, peso máximo e cubagem máxima maiores que zero para todos os veículos.')
      return
    }
    setBusy(true)
    try {
      const { error } = await supabase.from('erp_fleet_settings').upsert({ id: 1, vehicles: vehiclesDraft, updated_by: user.id, updated_at: new Date().toISOString() })
      if (error) { setMessage('Não foi possível salvar a frota. Confirme se a migração da frota foi aplicada.'); return }
      setFleetVehicles(vehiclesDraft.map(vehicle => ({ ...vehicle })))
      setFleetSettingsReady(true)
      if (fractionalRevisionId) {
        const { data: current } = await supabase.from('erp_fractional_truck_active').select('revision_id').eq('id',1).maybeSingle()
        if (current?.revision_id) setFractionalRevisionId(current.revision_id)
      }
      setMessage('Frota salva. Novas análises usarão os valores por km e capacidades atualizados.')
    } finally { setBusy(false) }
  }

  const saveQuoteSettings = async () => {
    if (!isAdmin || !user?.id) return
    const taxPercent = parseCotacaoTaxPercent(settingsDraft.tax_percent)
    if (taxPercent === null) { setMessage('Informe o total de tributos entre 0% e 100%.'); return }
    const insurance = parseCotacaoTaxPercent(settingsDraft.insurance_percent)
    const driverMax = parseCotacaoTaxPercent(settingsDraft.driver_max_percent)
    if (insurance === null || driverMax === null) { setMessage('Informe seguro e teto do motorista entre 0% e 100%.'); return }
    setBusy(true)
    try {
      const { error } = await supabase.from('erp_quote_settings').upsert({ id: 1, tax_percent: taxPercent, insurance_percent: insurance, driver_max_percent: driverMax, updated_by: user.id, updated_at: new Date().toISOString() })
      if (!error) setQuoteSettingsReady(true)
      setMessage(error ? 'Não foi possível salvar os percentuais. Confirme se a migração da cotação foi aplicada.' : 'Percentuais salvos para as próximas análises.')
    } finally { setBusy(false) }
  }

  const saveTemplates = async () => {
    if (!user?.id) return
    const errorText = validateCotacaoTemplates(templateDraft) || validateCotacaoTitles(titleDraft)
    if (errorText) { setMessage(errorText); return }
    const { error } = await supabase.from('erp_message_settings').upsert({ id: 1, templates: templateDraft, titles: titleDraft, updated_by: user.id, updated_at: new Date().toISOString() })
    if (error) { setMessage('Não foi possível salvar os textos. A configuração do banco pode ainda não estar instalada.'); return }
    setTemplates({ ...templateDraft })
    setTitles({ ...titleDraft })
    setMessage('Textos das mensagens salvos para todos os usuários.')
  }

  const download = (name: string, content: string, type: string) => {
    const url = URL.createObjectURL(new Blob([content], { type }))
    const link = document.createElement('a'); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url)
  }
  const printDraft = analysis?.snapshot?.draft ?? draft
  const defaultPdfPrice = (kind: ProposalKind) => analysis?.result[kind].total == null ? '' : Number(analysis.result[kind].total).toFixed(2).replace('.', ',')
  const pdfPriceInputs = analysis && pdfPriceEdits?.analysisId === analysis.id
    ? { fracionado: pdfPriceEdits.fracionado, dedicado: pdfPriceEdits.dedicado }
    : { fracionado: defaultPdfPrice('fracionado'), dedicado: defaultPdfPrice('dedicado') }
  const editPdfPrice = (kind: ProposalKind, value: string) => {
    if (!analysis) return
    setPdfPriceEdits(previous => ({
      analysisId: analysis.id,
      fracionado: previous?.analysisId === analysis.id ? previous.fracionado : defaultPdfPrice('fracionado'),
      dedicado: previous?.analysisId === analysis.id ? previous.dedicado : defaultPdfPrice('dedicado'),
      [kind]: value,
    }))
  }
  const printProposalData = (() => {
    if (!analysis) return null
    try { return buildCotacaoProposal(analysis, printKind, printPrice?.analysisId === analysis.id && printPrice.kind === printKind ? printPrice.amount : undefined) } catch { return null }
  })()
  const vehicles = analysis?.snapshot?.rules?.vehicles ?? fleetVehicles
  const printProposal = (kind: ProposalKind, amount: number) => {
    try {
      if (!analysis) throw new Error('Análise da cotação ausente.')
      buildCotacaoProposal(analysis, kind, amount)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível gerar o PDF.'); return
    }
    setPrintPrice({ analysisId: analysis.id, kind, amount })
    setPrintKind(kind)
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()))
  }

  const extract = () => {
    setAnalysisError('')
    setDraft(extractCotacao(raw))
    setQuoteId(null)
    setAnalysis(null)
    setDistance('')
    setRouteCoordinates(null)
    setRouteDuration(null)
    setSource('manual')
    setCnpjErrors({})
  }

  const editField = (key: keyof CotacaoDraft, value: string | number | null) => {
    setAnalysisError('')
    setDraft(previous => {
      const next = { ...previous, [key]: value }
      if (key === 'remetenteCnpj') {
        if (previous.remetenteEndereco) next.origem = ''
        next.remetenteNome = ''; next.remetenteEndereco = ''
      }
      if (key === 'destinatarioCnpj') {
        if (previous.destinatarioEndereco) next.destino = ''
        next.destinatarioNome = ''; next.destinatarioEndereco = ''
      }
      if (key === 'pesoKg' || key === 'cubagemM3') delete next.selectedVehicleName
      return next
    })
    setAnalysis(null)
    if (key === 'remetenteCnpj' || key === 'destinatarioCnpj') {
      setCnpjErrors(previous => ({ ...previous, [key === 'remetenteCnpj' ? 'remetente' : 'destinatario']: '' }))
      setDistance(''); setSource('manual'); setRouteCoordinates(null); setRouteDuration(null)
    }
    if (key === 'origem' || key === 'destino') {
      setRouteCoordinates(null)
      setRouteDuration(null)
      if (source === 'route-api') { setDistance(''); setSource('manual') }
    }
  }

  const lookupCnpjs = async () => {
    const targets = (['remetente', 'destinatario'] as const)
      .map(party => ({ party, field: party === 'remetente' ? 'remetenteCnpj' as const : 'destinatarioCnpj' as const, typed: draft[party === 'remetente' ? 'remetenteCnpj' : 'destinatarioCnpj']?.trim() ?? '' }))
      .filter(target => target.typed)
    if (!targets.length) return
    const errors: Partial<Record<CotacaoCnpjParty, string>> = {}
    const valid = targets.filter(target => {
      const check = validateCNPJ(target.typed)
      if (!check.valid) errors[target.party] = check.error ?? 'CNPJ inválido'
      return check.valid
    })
    setCnpjErrors(errors)
    if (!valid.length) return
    setCnpjLoading(true)
    try {
      const responses = await Promise.all(valid.map(async target => ({ target, result: await searchCNPJ(target.typed, { requireCep: false }) })))
      const updates: { party: CotacaoCnpjParty; field: 'remetenteCnpj' | 'destinatarioCnpj'; typed: string; data: CNPJFormData }[] = []
      for (const { target, result } of responses) {
        if ((draftRef.current[target.field] ?? '').replace(/\D/g, '') !== target.typed.replace(/\D/g, '')) continue
        if (!result.success) { errors[target.party] = result.error; continue }
        try {
          applyCnpjLocation(draftRef.current, target.party, result.data)
          updates.push({ party: target.party, field: target.field, typed: target.typed, data: result.data })
        } catch (error) { errors[target.party] = error instanceof Error ? error.message : 'Endereço cadastral incompleto.' }
      }
      setCnpjErrors(errors)
      if (updates.length) {
        setDraft(previous => updates.reduce((next, update) =>
          (next[update.field] ?? '').replace(/\D/g, '') === update.typed.replace(/\D/g, '')
            ? applyCnpjLocation(next, update.party, update.data) : next, previous))
        setDistance('')
        setSource('manual')
        setRouteCoordinates(null)
        setRouteDuration(null)
        setAnalysis(null)
        setMessage('Endereço cadastral carregado. Confira os locais de coleta e entrega e recalcule a rota.')
      }
    } catch {
      setCnpjErrors(previous => ({ ...previous, remetente: previous.remetente || 'Não foi possível consultar os CNPJs. Tente novamente.' }))
    } finally { setCnpjLoading(false) }
  }

  const editDistance = (value: string) => {
    setAnalysisError('')
    setDistance(value)
    setSource('manual')
    setRouteCoordinates(null)
    setRouteDuration(null)
    setAnalysis(null)
  }

  return <div className="cotacao-page mx-auto max-w-[1780px] space-y-5 pb-10 text-slate-900 dark:text-white">
    <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Cotação de frete</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Extraia, calcule e avalie uma carga em um só lugar.</p>
      </div>
      <nav className="flex flex-wrap items-center gap-2" aria-label="Seções da cotação">
        <button ref={settingsTriggerRef} type="button" aria-label="Configurações da cotação" title="Configurações da cotação" onClick={() => { setSettingsTab(isAdmin ? 'tributos' : 'mensagens'); setSettingsOpen(true) }} className="rounded-lg border border-[#dce4ef] px-3 py-2 text-[#173e91] hover:bg-blue-50 dark:border-slate-700 dark:text-white dark:hover:bg-slate-800">⚙</button>
      </nav>
    </div>
    {message && <p role="status" className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:bg-blue-900/30 dark:text-blue-100">{message}</p>}
    <CotacaoAnalysisView
      raw={raw}
      draft={draft}
      distance={distance}
      source={source}
      routeCoordinates={routeCoordinates}
      routeDuration={routeDuration}
      busy={busy}
      viewingAnotherUser={false}
      cnpjLoading={cnpjLoading}
      cnpjErrors={cnpjErrors}
      analysis={analysis}
      analysisError={analysisError}
      quoteSettingsReady={quoteSettingsReady}
      fleetSettingsReady={fleetSettingsReady}
      isAdmin={isAdmin}
      vehicles={vehicles}
      anttSourceUrl={analysis?.snapshot?.rules?.anttSourceUrl}
      anttEffectiveFrom={analysis?.snapshot?.rules?.anttEffectiveFrom}
      templates={templates}
      titles={titles}
      messageContext={{ distanceKm: analysis?.snapshot?.distance_km, userName: user?.name, userPhone, userEmail: user?.email }}
      similarFreights={similarFreights}
      similarFreightsLoading={similarFreightsLoading}
      similarFreightsError={similarFreightsError}
      onRawChange={setRaw}
      onExtract={extract}
      onFieldChange={editField}
      onLookupCnpjs={lookupCnpjs}
      onDistanceChange={editDistance}
      onRoute={route}
      onAnalyze={analyze}
      onVehicleChange={name => void changeVehicle(name)}
      onOpenSettings={() => setSettingsOpen(true)}
      pdfPriceInputs={pdfPriceInputs}
      onPdfPriceChange={editPdfPrice}
      onPrint={printProposal}
      onDownloadJson={() => download(`cotacao-${quoteId}.json`, JSON.stringify({ draft: printDraft, analysis }, null, 2), 'application/json')}
    />
    {settingsOpen && <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/70 p-3 print:hidden sm:p-6" onMouseDown={event => { if (event.target === event.currentTarget) setSettingsOpen(false) }}>
      <section ref={settingsDialogRef} role="dialog" aria-modal="true" aria-labelledby="cotacao-settings-title" className="max-h-[calc(100vh-1.5rem)] w-full max-w-5xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:max-h-[calc(100vh-3rem)]">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3"><h2 id="cotacao-settings-title" className="text-lg font-semibold">Configuração da cotação</h2><button ref={settingsCloseRef} type="button" onClick={() => setSettingsOpen(false)} aria-label="Fechar configurações" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800">Fechar ✕</button></div>
        <div role="tablist" aria-label="Configurações da cotação" className="mt-4 flex flex-wrap gap-2">{(isAdmin ? [['tributos', 'Tributos e seguro'], ['precos', 'Preço e frota'], ['mensagens', 'Mensagens']] as const : [['mensagens', 'Mensagens']] as const).map(([key, title]) => <button key={key} type="button" role="tab" aria-selected={settingsTab === key} onClick={() => setSettingsTab(key)} className={`rounded-lg px-3 py-2 text-sm font-semibold ${settingsTab === key ? 'bg-[#2878ef] text-white' : 'border border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-200'}`}>{title}</button>)}</div>
      </div>
      <div className="space-y-4 p-5">
      {message && <p role="status" className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:bg-blue-900/30 dark:text-blue-100">{message}</p>}
      {settingsTab === 'mensagens' && <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
        <h3 className="font-semibold">Layout das mensagens</h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Variáveis: {'{saudacao}'}, {'{cliente}'}, {'{origem}'}, {'{destino}'}, {'{distanciaKm}'}, {'{volumes}'}, {'{peso}'}, {'{valorNota}'}, {'{usuario}'}, {'{telefoneUsuario}'}, {'{emailUsuario}'}. Preços nos textos de apresentação e proposta: {'{precoFracionado}'} e {'{precoDedicado}'}.</p>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">{(Object.keys(defaultCotacaoTemplates) as (keyof CotacaoMessageTemplates)[]).map(style => <div key={style} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"><p className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">{style}</p><label className="text-sm">Título<input className={`${input} mt-1`} maxLength={80} value={titleDraft[style]} onChange={event => setTitleDraft(previous => ({ ...previous, [style]: event.target.value }))} /></label><label className="mt-3 block text-sm">Corpo da mensagem<textarea className={`${input} mt-1 min-h-28`} value={templateDraft[style]} onChange={event => setTemplateDraft(previous => ({ ...previous, [style]: event.target.value }))} /></label></div>)}</div>
        <button type="button" onClick={() => void saveTemplates()} className="mt-3 rounded-lg bg-[#2878ef] px-4 py-2 text-sm font-semibold text-white">Salvar títulos e mensagens</button>
      </div>}
      {isAdmin && settingsTab === 'tributos' && <div className="space-y-4">
        <div><h3 className="font-semibold">Tributos e seguro</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Informe o percentual total dos tributos, já somado pela empresa, e o percentual do seguro.</p></div>
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Tributos totais (%)<input type="text" inputMode="decimal" className={`${input} mt-1`} value={settingsDraft.tax_percent ?? ''} onChange={event => setSettingsDraft(previous => ({ ...previous, tax_percent: event.target.value }))} placeholder="Ex.: 17,93" /></label><label className="text-sm">Seguro sobre a nota fiscal (%)<input type="text" inputMode="decimal" className={`${input} mt-1`} value={settingsDraft.insurance_percent ?? ''} onChange={event => setSettingsDraft(previous => ({ ...previous, insurance_percent: event.target.value }))} placeholder="Ex.: 0,2" /></label></div>
        <label className="block max-w-sm text-sm">Teto do motorista (%)<input type="text" inputMode="decimal" className={`${input} mt-1`} value={settingsDraft.driver_max_percent ?? ''} onChange={event => setSettingsDraft(previous => ({ ...previous, driver_max_percent: event.target.value }))} placeholder="Ex.: 70" /><span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">Percentual máximo do valor da proposta destinado ao motorista.</span></label>
        <button type="button" disabled={busy} onClick={() => void saveQuoteSettings()} className="rounded-lg bg-[#2878ef] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Salvar percentuais</button>
      </div>}
      {isAdmin && settingsTab === 'precos' && <div className="space-y-4">
        <h3 className="font-semibold">Frota — valores e capacidades</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">Edite o valor por km, o peso e a cubagem máximos de cada veículo. Novas análises usam a frota salva.</p>
        <div className="grid gap-2">
          {vehiclesDraft.map((vehicle, index) => <div key={vehicle.name} className="grid gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 sm:grid-cols-[minmax(0,1fr)_repeat(3,minmax(110px,140px))] sm:items-end">
            <span className="truncate text-sm font-medium" title={vehicle.name}>{vehicle.name}</span>
            <label className="text-xs text-slate-500 dark:text-slate-400">R$/km
              <input aria-label={`Valor por km de ${vehicle.name}`} className={`${input} mt-1`} type="number" min="0.0001" step="0.0001" value={vehicle.pricePerKm ?? ''} onChange={event => setVehiclesDraft(previous => previous.map((item, i) => i === index ? { ...item, pricePerKm: event.target.value === '' ? undefined : Number(event.target.value) } : item))} />
            </label>
            <label className="text-xs text-slate-500 dark:text-slate-400">Peso máximo (kg)
              <input aria-label={`Peso máximo de ${vehicle.name}`} className={`${input} mt-1`} type="number" min="1" step="1" value={vehicle.payloadKg || ''} onChange={event => setVehiclesDraft(previous => previous.map((item, i) => i === index ? { ...item, payloadKg: Number(event.target.value) } : item))} />
            </label>
            <label className="text-xs text-slate-500 dark:text-slate-400">Cubagem máxima (m³)
              <input aria-label={`Cubagem máxima de ${vehicle.name}`} className={`${input} mt-1`} type="number" min="0.01" step="0.01" value={vehicle.volumeM3 || ''} onChange={event => setVehiclesDraft(previous => previous.map((item, i) => i === index ? { ...item, volumeM3: Number(event.target.value) } : item))} />
            </label>
          </div>)}
        </div>
        <button type="button" disabled={busy} onClick={() => void saveFleet()} className="rounded-lg bg-[#2878ef] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Salvar frota</button>
        <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
          <h4 className="font-semibold">Motor fracionado · Truck</h4>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">O Truck é o veículo padrão do fracionado. O cálculo usa o peso máximo, a cubagem máxima e o valor por km cadastrados na linha Truck acima. Ao salvar a frota, uma nova revisão valerá para as próximas análises.</p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{fractionalRevisionId ? `Revisão ativa: ${fractionalRevisionId.slice(0,8)}` : 'Motor ainda não ativado no banco.'}</p>
        </div>
      </div>
      }
      </div>
      </section>
    </div>}
    {printProposalData && <CotacaoProposalDocument proposal={printProposalData} />}
  </div>
}
