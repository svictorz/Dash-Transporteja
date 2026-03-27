'use client'

import { useState } from 'react'
import { MapPin, Plus, Trash2, Route, Loader2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'

function formatBRL(value: number): string {
  try {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  } catch {
    return `R$ ${value.toFixed(2).replace('.', ',')}`
  }
}

interface RotaLinha {
  destinoSolicitado: string
  destinoResolvido: string | null
  distanciaKm: number | null
  duracaoMin: number | null
  pedagioEstimado: number | null
  dieselLitros: number | null
  dieselCusto: number | null
  erro?: string
}

interface ApiOk {
  origemResolvida: string
  dieselPrecoLitro: number
  kmPorLitro: number
  pedagioReaisPorKm: number
  dieselFonte: string
  pedagioFonte: string
  rotas: RotaLinha[]
}

export default function CotacaoPorKmRota() {
  const [origem, setOrigem] = useState('')
  const [destinos, setDestinos] = useState<string[]>(['', ''])
  const [valorKm, setValorKm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ApiOk | null>(null)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualKm, setManualKm] = useState('')
  const [manualRate, setManualRate] = useState('')

  const addDestino = () => {
    if (destinos.length >= 8) return
    setDestinos((d) => [...d, ''])
  }

  const removeDestino = (index: number) => {
    if (destinos.length <= 1) return
    setDestinos((d) => d.filter((_, i) => i !== index))
  }

  const setDestino = (index: number, value: string) => {
    setDestinos((d) => d.map((x, i) => (i === index ? value : x)))
  }

  const calcularRotas = async () => {
    setError(null)
    setResult(null)
    const list = destinos.map((x) => x.trim()).filter(Boolean)
    if (!origem.trim()) {
      setError('Informe a origem.')
      return
    }
    if (list.length === 0) {
      setError('Informe ao menos um destino.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/cotacao/rota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origem: origem.trim(), destinos: list }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Não foi possível calcular as rotas.')
        return
      }
      setResult(data as ApiOk)
    } catch {
      setError('Erro de rede. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const vk = parseFloat(valorKm.replace(',', '.')) || 0
  const manualTotal =
    (parseFloat(manualKm.replace(',', '.')) || 0) * (parseFloat(manualRate.replace(',', '.')) || 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-slate-800">
        <div className="p-2 rounded-xl bg-slate-800/10">
          <Route className="w-6 h-6" aria-hidden />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Cotação por km (rota)</h2>
          <p className="text-sm text-gray-600">
            Origem, vários destinos, distância rodoviária, pedágio estimado e diesel (referência configurável).
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="cot-origem" className="block text-sm font-medium text-gray-700 mb-1.5">
            Origem
          </label>
          <input
            id="cot-origem"
            value={origem}
            onChange={(e) => setOrigem(e.target.value)}
            placeholder="Ex: Campinas SP, ou endereço completo"
            className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-800/35 focus:border-slate-600"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Destinos</span>
            <button
              type="button"
              onClick={addDestino}
              disabled={destinos.length >= 8}
              className="inline-flex items-center gap-1 text-sm text-slate-800 font-medium hover:underline disabled:opacity-40"
            >
              <Plus className="w-4 h-4" />
              Adicionar destino
            </button>
          </div>
          {destinos.map((d, i) => (
            <div key={i} className="flex gap-2 items-start">
              <div className="flex-1">
                <label htmlFor={`cot-dest-${i}`} className="sr-only">
                  Destino {i + 1}
                </label>
                <input
                  id={`cot-dest-${i}`}
                  value={d}
                  onChange={(e) => setDestino(i, e.target.value)}
                  placeholder={`Destino ${i + 1} (cidade, UF ou endereço)`}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-800/35 focus:border-slate-600"
                />
              </div>
              <button
                type="button"
                onClick={() => removeDestino(i)}
                disabled={destinos.length <= 1}
                className="p-3 rounded-xl border border-gray-200 text-gray-500 hover:bg-red-50 hover:text-red-600 hover:border-red-100 disabled:opacity-30"
                aria-label={`Remover destino ${i + 1}`}
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>

        <div>
          <label htmlFor="cot-valor-km" className="block text-sm font-medium text-gray-700 mb-1.5">
            Valor do frete por km (opcional)
          </label>
          <input
            id="cot-valor-km"
            inputMode="decimal"
            value={valorKm}
            onChange={(e) => setValorKm(e.target.value)}
            placeholder="Ex: 2,50 — para estimar o frete sobre a distância calculada"
            className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-800/35 focus:border-slate-600"
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-red-800 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="button"
          onClick={calcularRotas}
          disabled={loading}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Calculando rotas…
            </>
          ) : (
            <>
              <MapPin className="w-5 h-5" />
              Calcular rotas
            </>
          )}
        </button>
      </div>

      {result && (
        <div className="space-y-4 pt-2 border-t border-gray-200">
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white/80">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/80">
                  <th className="p-3 font-semibold text-gray-800">Destino</th>
                  <th className="p-3 font-semibold text-gray-800">Km</th>
                  <th className="p-3 font-semibold text-gray-800">Tempo</th>
                  <th className="p-3 font-semibold text-gray-800">Pedágio (est.)</th>
                  <th className="p-3 font-semibold text-gray-800">Diesel (est.)</th>
                  {vk > 0 && <th className="p-3 font-semibold text-gray-800">Frete (est.)</th>}
                </tr>
              </thead>
              <tbody>
                {result.rotas.map((r, idx) => (
                  <tr key={idx} className="border-b border-gray-100 last:border-0 align-top">
                    <td className="p-3">
                      <div className="font-medium text-gray-900">{r.destinoSolicitado}</div>
                      {r.erro && <div className="text-xs text-red-600 mt-1">{r.erro}</div>}
                    </td>
                    <td className="p-3 tabular-nums">
                      {r.distanciaKm != null ? `${r.distanciaKm} km` : '—'}
                    </td>
                    <td className="p-3 tabular-nums">
                      {r.duracaoMin != null ? `${r.duracaoMin} min` : '—'}
                    </td>
                    <td className="p-3 tabular-nums">
                      {r.pedagioEstimado != null ? formatBRL(r.pedagioEstimado) : '—'}
                    </td>
                    <td className="p-3">
                      {r.dieselCusto != null && r.dieselLitros != null ? (
                        <div>
                          <div className="tabular-nums">{formatBRL(r.dieselCusto)}</div>
                          <div className="text-xs text-gray-500">{r.dieselLitros} L</div>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    {vk > 0 && (
                      <td className="p-3 tabular-nums">
                        {r.distanciaKm != null ? formatBRL(r.distanciaKm * vk) : '—'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="border border-dashed border-gray-300 rounded-xl">
        <button
          type="button"
          onClick={() => setManualOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl"
        >
          Entrada manual (só km × valor por km)
          {manualOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {manualOpen && (
          <div className="px-4 pb-4 pt-0 grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Distância (km)</label>
              <input
                inputMode="decimal"
                value={manualKm}
                onChange={(e) => setManualKm(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-800/35 focus:border-slate-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Valor por km (R$)</label>
              <input
                inputMode="decimal"
                value={manualRate}
                onChange={(e) => setManualRate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-800/35 focus:border-slate-600"
              />
            </div>
            <div className="sm:col-span-2 rounded-xl bg-slate-900 text-white p-4 flex justify-between items-center">
              <span className="text-slate-300 text-sm">Total manual</span>
              <span className="text-xl font-bold tabular-nums">{formatBRL(manualTotal)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
