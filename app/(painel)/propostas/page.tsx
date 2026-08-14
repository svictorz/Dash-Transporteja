'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Briefcase } from 'lucide-react'
import PropostaEmitenteTabs from '@/components/propostas/PropostaEmitenteTabs'
import PropostaFormulario from '@/components/propostas/PropostaFormulario'
import PropostaPdfPreview from '@/components/propostas/PropostaPdfPreview'
import type { PropostaEmitente } from '@/lib/constants/proposta-emitentes'
import { getPropostaDoc } from '@/lib/constants/proposta-emitentes'
import { defaultPropostaFormState } from '@/lib/types/proposta'
import { calcularProposta, gerarCodigoProposta } from '@/lib/utils/proposta-calculo'
import './proposta-print.css'

type DistanciaStatus = 'idle' | 'loading' | 'ok' | 'erro'

function createInitialForms(): Record<PropostaEmitente, ReturnType<typeof defaultPropostaFormState>> {
  return {
    agape: defaultPropostaFormState(gerarCodigoProposta('agape')),
    jcn: defaultPropostaFormState(gerarCodigoProposta('jcn')),
  }
}

export default function PropostasPage() {
  const [activeEmitente, setActiveEmitente] = useState<PropostaEmitente>('jcn')
  const [forms, setForms] = useState(createInitialForms)
  const [statusDistanciaByEmitente, setStatusDistanciaByEmitente] = useState<
    Record<PropostaEmitente, DistanciaStatus>
  >({ agape: 'idle', jcn: 'idle' })
  const abortRef = useRef<Partial<Record<PropostaEmitente, AbortController>>>({})

  const form = forms[activeEmitente]
  const statusDistancia = statusDistanciaByEmitente[activeEmitente]
  const docAtivo = getPropostaDoc(activeEmitente)

  const setForm = (next: typeof form) => {
    setForms((prev) => ({ ...prev, [activeEmitente]: next }))
  }

  useEffect(() => {
    const emitente = activeEmitente
    const co = form.cidadeOrigem.trim()
    const cd = form.cidadeDestino.trim()
    const uo = form.ufOrigem
    const ud = form.ufDestino

    setForms((prev) => ({
      ...prev,
      [emitente]: { ...prev[emitente], distanciaKm: '' },
    }))

    if (!co || !cd) {
      setStatusDistanciaByEmitente((prev) => ({ ...prev, [emitente]: 'idle' }))
      return
    }

    setStatusDistanciaByEmitente((prev) => ({ ...prev, [emitente]: 'loading' }))

    const timer = setTimeout(async () => {
      abortRef.current[emitente]?.abort()
      const controller = new AbortController()
      abortRef.current[emitente] = controller

      try {
        const params = new URLSearchParams({ co, uo, cd, ud })
        const res = await fetch(`/api/calcular-distancia?${params}`, { signal: controller.signal })
        if (!res.ok) throw new Error('erro')
        const data = await res.json()
        setForms((prev) => ({
          ...prev,
          [emitente]: { ...prev[emitente], distanciaKm: String(data.km) },
        }))
        setStatusDistanciaByEmitente((prev) => ({ ...prev, [emitente]: 'ok' }))
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setStatusDistanciaByEmitente((prev) => ({ ...prev, [emitente]: 'erro' }))
      }
    }, 900)

    return () => {
      clearTimeout(timer)
      abortRef.current[emitente]?.abort()
    }
  }, [
    activeEmitente,
    form.cidadeOrigem,
    form.ufOrigem,
    form.cidadeDestino,
    form.ufDestino,
  ])

  const dataEmissao = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  const calc = useMemo(() => calcularProposta(form), [form])

  const imprimir = () => {
    window.print()
  }

  const limparFormulario = () => {
    setForms((prev) => ({
      ...prev,
      [activeEmitente]: defaultPropostaFormState(gerarCodigoProposta(activeEmitente)),
    }))
    setStatusDistanciaByEmitente((prev) => ({ ...prev, [activeEmitente]: 'idle' }))
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 pb-10 print:max-w-none print:mx-0 print:space-y-0 print:pb-0">
      <div className="print:hidden">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Propostas</h1>
            <p className="text-sm text-gray-600 dark:text-slate-300 mt-1">
              Preencha à esquerda e acompanhe o layout da proposta em A4 à direita —{' '}
              <span className="font-medium text-gray-800 dark:text-slate-100">{docAtivo.nomeFantasia}</span>
            </p>
          </div>
          <PropostaEmitenteTabs active={activeEmitente} onChange={setActiveEmitente} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-8 items-start mt-6">
          <div className="glass-card rounded-2xl border border-white/40 p-5 md:p-6 shadow-lg backdrop-blur-xl">
            <PropostaFormulario value={form} onChange={setForm} statusDistancia={statusDistancia} />
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={limparFormulario}
                className="px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                Limpar e novo código
              </button>
            </div>
          </div>

          <div className="xl:sticky xl:top-4 space-y-4">
            <button
              type="button"
              onClick={imprimir}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl font-bold text-white uppercase tracking-wide text-sm shadow-lg hover:opacity-95 transition-opacity"
              style={{ backgroundColor: '#0f2847' }}
            >
              <Briefcase className="w-5 h-5 shrink-0" aria-hidden />
              Imprimir proposta (A4) — {docAtivo.tabLabel}
            </button>

            <div className="rounded-2xl border border-gray-200 bg-[#f1f5f9]/95 dark:border-slate-500 dark:bg-[#f1f5f9]/95 p-4 md:p-5 shadow-inner overflow-auto max-h-[calc(100vh-8rem)]">
              <p className="text-xs text-gray-500 mb-3 text-center xl:text-left">
                Pré-visualização — {docAtivo.tabLabel} (escala reduzida no ecrã; impressão em A4 completo)
              </p>
              <div className="flex justify-center overflow-x-auto pb-4 pt-1">
                <div className="inline-block shadow-2xl ring-1 ring-black/10 rounded-sm proposta-preview-zoom">
                  <PropostaPdfPreview
                    emitente={activeEmitente}
                    form={form}
                    calc={calc}
                    dataEmissao={dataEmissao}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="hidden print:block print:m-0 print:p-0">
        <PropostaPdfPreview
          emitente={activeEmitente}
          form={form}
          calc={calc}
          dataEmissao={dataEmissao}
          className="proposta-a4-print mx-auto"
        />
      </div>
    </div>
  )
}
