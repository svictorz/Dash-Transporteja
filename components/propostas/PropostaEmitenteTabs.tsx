'use client'

import type { PropostaEmitente } from '@/lib/constants/proposta-emitentes'
import { PROPOSTA_DOC_BY_EMITENTE, PROPOSTA_EMITENTES } from '@/lib/constants/proposta-emitentes'

interface Props {
  active: PropostaEmitente
  onChange: (emitente: PropostaEmitente) => void
}

export default function PropostaEmitenteTabs({ active, onChange }: Props) {
  return (
    <div
      className="inline-flex flex-wrap gap-1 rounded-xl border border-gray-200/80 bg-gray-100/90 p-1 shadow-inner dark:border-slate-600 dark:bg-slate-800/80"
      role="tablist"
      aria-label="Emitente da proposta"
    >
      {PROPOSTA_EMITENTES.map((id) => {
        const doc = PROPOSTA_DOC_BY_EMITENTE[id]
        const selected = active === id
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(id)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              selected
                ? 'bg-white text-[#0f2847] shadow-sm ring-1 ring-black/5 dark:bg-slate-900 dark:text-white dark:ring-white/10'
                : 'text-gray-600 hover:text-gray-900 hover:bg-white/60 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-700/50'
            }`}
          >
            {doc.tabLabel}
          </button>
        )
      })}
    </div>
  )
}
