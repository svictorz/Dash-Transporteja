'use client'

import { useMemo, useState } from 'react'
import { Briefcase } from 'lucide-react'
import { BRAND_NAME_SHORT } from '@/lib/constants/brand'
import PropostaFormulario from '@/components/propostas/PropostaFormulario'
import PropostaPdfPreview from '@/components/propostas/PropostaPdfPreview'
import { defaultPropostaFormState } from '@/lib/types/proposta'
import { calcularProposta, gerarCodigoPropostaAGT } from '@/lib/utils/proposta-calculo'
import './proposta-print.css'

export default function PropostasPage() {
  const [form, setForm] = useState(() => defaultPropostaFormState(gerarCodigoPropostaAGT()))

  const dataEmissao = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  const calc = useMemo(() => calcularProposta(form), [form])

  const imprimir = () => {
    window.print()
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 pb-10">
      <div className="print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Propostas</h1>
          <p className="text-sm text-gray-600 mt-1">
            Preencha à esquerda e acompanhe o layout da proposta em A4 à direita — {BRAND_NAME_SHORT}
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-8 items-start">
          <div className="glass-card rounded-2xl border border-white/40 p-5 md:p-6 shadow-lg backdrop-blur-xl">
            <PropostaFormulario value={form} onChange={setForm} />
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setForm(defaultPropostaFormState(gerarCodigoPropostaAGT()))}
                className="px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
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
              Imprimir proposta (A4)
            </button>

            <div className="rounded-2xl border border-gray-200 bg-slate-100/90 p-4 md:p-5 shadow-inner overflow-auto max-h-[calc(100vh-8rem)]">
              <p className="text-xs text-gray-500 mb-3 text-center xl:text-left">
                Pré-visualização (escala reduzida no ecrã; impressão em A4 completo)
              </p>
              <div className="flex justify-center overflow-x-auto pb-4 pt-1">
                <div className="inline-block shadow-2xl ring-1 ring-black/10 rounded-sm scale-[0.56] md:scale-[0.74] xl:scale-[0.80] origin-top">
                  <PropostaPdfPreview form={form} calc={calc} dataEmissao={dataEmissao} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="hidden print:block">
        <PropostaPdfPreview form={form} calc={calc} dataEmissao={dataEmissao} className="proposta-a4-print mx-auto" />
      </div>
    </div>
  )
}
