'use client'

import type { PropostaFormState } from '@/lib/types/proposta'

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const

const TIPOS_CARGA = ['Carga Dedicada', 'Carga Fracionada', 'Lotação', 'Expressa'] as const


const inputClass =
  'w-full px-3 py-2.5 rounded-lg border border-gray-300 bg-white text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0f2847]/30 focus:border-[#0f2847] dark:bg-slate-950 dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-slate-500/30 dark:focus:border-slate-400'

const selectClass = inputClass

const sectionTitle =
  'text-sm font-bold text-[#0f2847] dark:text-white tracking-wide mb-3'

interface Props {
  value: PropostaFormState
  onChange: (next: PropostaFormState) => void
  statusDistancia?: 'idle' | 'loading' | 'ok' | 'erro'
}

export default function PropostaFormulario({ value, onChange, statusDistancia = 'idle' }: Props) {
  const set = <K extends keyof PropostaFormState>(key: K, v: PropostaFormState[K]) =>
    onChange({ ...value, [key]: v })

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className={sectionTitle}>1. DADOS DO CLIENTE</h2>
        <div className="space-y-3">
          <input
            className={inputClass}
            placeholder="Remetente"
            value={value.remetente}
            onChange={(e) => set('remetente', e.target.value)}
          />
          <input
            className={inputClass}
            placeholder="Destinatário"
            value={value.destinatario}
            onChange={(e) => set('destinatario', e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className={sectionTitle}>2. TRAJETO E COTAÇÃO</h2>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_5.5rem] gap-3">
            <input
              className={inputClass}
              placeholder="Cidade Origem"
              value={value.cidadeOrigem}
              onChange={(e) => set('cidadeOrigem', e.target.value)}
            />
            <select
              className={selectClass}
              value={value.ufOrigem}
              onChange={(e) => set('ufOrigem', e.target.value)}
              aria-label="UF origem"
            >
              {UFS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_5.5rem] gap-3">
            <input
              className={inputClass}
              placeholder="Cidade Destino"
              value={value.cidadeDestino}
              onChange={(e) => set('cidadeDestino', e.target.value)}
            />
            <select
              className={selectClass}
              value={value.ufDestino}
              onChange={(e) => set('ufDestino', e.target.value)}
              aria-label="UF destino"
            >
              <option value="">UF</option>
              {UFS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          <input
            className={`${inputClass} font-semibold text-[#0f2847] dark:text-sky-300`}
            readOnly
            title="Código único da proposta"
            value={value.codigoUnico}
            aria-label="Código único"
          />

          {/* Indicador de distância calculada automaticamente */}
          {statusDistancia !== 'idle' && (
            <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border ${
              statusDistancia === 'loading'
                ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300'
                : statusDistancia === 'ok'
                ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-950/40 dark:border-green-800 dark:text-green-300'
                : 'bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-950/40 dark:border-orange-800 dark:text-orange-300'
            }`}>
              {statusDistancia === 'loading' && (
                <>
                  <svg className="animate-spin h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
                  </svg>
                  <span>Calculando distância rodoviária…</span>
                </>
              )}
              {statusDistancia === 'ok' && (
                <>
                  <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Distância calculada: <strong>{value.distanciaKm} km</strong></span>
                </>
              )}
              {statusDistancia === 'erro' && (
                <>
                  <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                  <span>Não foi possível calcular a distância automaticamente</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className={sectionTitle}>3. VALORES E AJUSTES</h2>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              className={selectClass}
              value={value.tipoCarga}
              onChange={(e) => set('tipoCarga', e.target.value)}
            >
              {TIPOS_CARGA.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              className={inputClass}
              inputMode="numeric"
              placeholder="Prazo / dias (referência)"
              value={value.cargaParam}
              onChange={(e) => set('cargaParam', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-[#0f2847] dark:text-white">Frete base</p>
            <input
              className={inputClass}
              inputMode="decimal"
              placeholder="R$"
              value={value.freteManual}
              onChange={(e) => set('freteManual', e.target.value)}
              aria-label="Frete base em reais"
            />
          </div>

          <input
            className={inputClass}
            inputMode="decimal"
            placeholder="Valores adicionais (R$)"
            value={value.taxasFixas}
            onChange={(e) => set('taxasFixas', e.target.value)}
            aria-label="Valores adicionais, exibidos como taxas na proposta"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              className={inputClass}
              inputMode="decimal"
              placeholder="Peso KG"
              value={value.pesoKg}
              onChange={(e) => set('pesoKg', e.target.value)}
            />
            <input
              className={inputClass}
              inputMode="numeric"
              placeholder="Volumes"
              value={value.volumes}
              onChange={(e) => set('volumes', e.target.value)}
              aria-label="Quantidade de volumes"
            />
          </div>

          <input
            className={inputClass}
            inputMode="decimal"
            placeholder="Valor da Nota Fiscal (R$)"
            value={value.valorNf}
            onChange={(e) => set('valorNf', e.target.value)}
            aria-label="Valor da nota fiscal"
          />

          <div>
            <label htmlFor="proposta-obs" className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5">
              Observações
            </label>
            <textarea
              id="proposta-obs"
              rows={4}
              value={value.observacao}
              onChange={(e) => set('observacao', e.target.value)}
              placeholder="Condições comerciais, referências de carga, horários, etc."
              className={`${inputClass} resize-y min-h-[88px]`}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
