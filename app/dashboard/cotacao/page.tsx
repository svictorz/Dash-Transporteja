'use client'

import { useMemo, useState } from 'react'
import { MapPin, Weight, Calculator } from 'lucide-react'
import { BRAND_NAME_SHORT } from '@/lib/constants/brand'
import CotacaoPorKmRota from '@/components/cotacao/CotacaoPorKmRota'

type TabKey = 'km' | 'ton'

function parseDecimal(value: string): number {
  const n = parseFloat(value.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function formatBRL(value: number): string {
  try {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  } catch {
    return `R$ ${value.toFixed(2).replace('.', ',')}`
  }
}

export default function CotacaoPage() {
  const [tab, setTab] = useState<TabKey>('km')
  const [tonWeight, setTonWeight] = useState('')
  const [tonRate, setTonRate] = useState('')

  const totalTon = useMemo(() => {
    const w = parseDecimal(tonWeight)
    const r = parseDecimal(tonRate)
    return Math.max(0, w * r)
  }, [tonWeight, tonRate])

  const tabs: { id: TabKey; label: string; icon: typeof MapPin }[] = [
    { id: 'km', label: 'Por quilômetro', icon: MapPin },
    { id: 'ton', label: 'Por tonelada', icon: Weight },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Cotação</h1>
        <p className="text-sm text-gray-600 mt-1">
          Simule valores por distância ou por peso — {BRAND_NAME_SHORT}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 p-1 rounded-2xl glass-card border border-white/40 w-fit">
        {tabs.map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active
                  ? 'bg-slate-800 text-white shadow-md'
                  : 'text-gray-600 hover:bg-white/60'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" aria-hidden />
              {t.label}
            </button>
          )
        })}
      </div>

      <div className="glass-card rounded-2xl border border-white/40 p-6 md:p-8 shadow-lg backdrop-blur-xl">
        {tab === 'km' && <CotacaoPorKmRota />}

        {tab === 'ton' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 text-slate-800">
              <div className="p-2 rounded-xl bg-slate-800/10">
                <Weight className="w-6 h-6" aria-hidden />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Cotação por tonelada</h2>
                <p className="text-sm text-gray-600">Peso (t) × valor por tonelada</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="cot-ton-w" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Peso (toneladas)
                </label>
                <input
                  id="cot-ton-w"
                  inputMode="decimal"
                  value={tonWeight}
                  onChange={(e) => setTonWeight(e.target.value)}
                  placeholder="Ex: 12,5"
                  className="w-full px-4 py-3 rounded-xl border border-white/50 bg-white/70 focus:outline-none focus:ring-2 focus:ring-slate-800/30"
                />
              </div>
              <div>
                <label htmlFor="cot-ton-rate" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Valor por tonelada (R$)
                </label>
                <input
                  id="cot-ton-rate"
                  inputMode="decimal"
                  value={tonRate}
                  onChange={(e) => setTonRate(e.target.value)}
                  placeholder="Ex: 180"
                  className="w-full px-4 py-3 rounded-xl border border-white/50 bg-white/70 focus:outline-none focus:ring-2 focus:ring-slate-800/30"
                />
              </div>
            </div>
            <div className="rounded-xl bg-slate-900 text-white p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2 text-slate-300 text-sm">
                <Calculator className="w-5 h-5 shrink-0" aria-hidden />
                Total estimado
              </div>
              <p className="text-2xl font-bold tabular-nums">{formatBRL(totalTon)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
