'use client'

import type { PropostaFormState } from '@/lib/types/proposta'

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const

const TIPOS_CARGA = ['Carga Dedicada', 'Carga Fracionada', 'Lotação', 'Expressa'] as const

const EQUIPAMENTOS = [
  'Caminhão 3/4 (Baú)',
  'Toco (Baú)',
  'Truck (Baú)',
  'Carreta (Baú)',
  'Carreta LS / Sider',
  'Bitrem / Rodotrem',
] as const

const inputClass =
  'w-full px-3 py-2.5 rounded-lg border border-gray-300 bg-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0f2847]/30 focus:border-[#0f2847]'

const selectClass = inputClass

const sectionTitle = 'text-sm font-bold text-[#0f2847] tracking-wide mb-3'

interface Props {
  value: PropostaFormState
  onChange: (next: PropostaFormState) => void
}

export default function PropostaFormulario({ value, onChange }: Props) {
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              className={inputClass}
              placeholder="CNPJ Remetente"
              value={value.cnpjRemetente}
              onChange={(e) => set('cnpjRemetente', e.target.value)}
            />
            <input
              className={inputClass}
              placeholder="CNPJ Destinatário"
              value={value.cnpjDestinatario}
              onChange={(e) => set('cnpjDestinatario', e.target.value)}
            />
          </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              className={inputClass}
              inputMode="decimal"
              placeholder="Distância KM"
              value={value.distanciaKm}
              onChange={(e) => set('distanciaKm', e.target.value)}
            />
            <input
              className={`${inputClass} font-semibold text-[#0f2847]`}
              readOnly
              title="Código único da proposta"
              value={value.codigoUnico}
              aria-label="Código único"
            />
          </div>
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
          <select
            className={selectClass}
            value={value.equipamento}
            onChange={(e) => set('equipamento', e.target.value)}
          >
            {EQUIPAMENTOS.map((eq) => (
              <option key={eq} value={eq}>
                {eq}
              </option>
            ))}
          </select>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-[#0f2847]">Frete base</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                className={inputClass}
                inputMode="decimal"
                placeholder="R$"
                value={value.freteManual}
                onChange={(e) => set('freteManual', e.target.value)}
                aria-label="Frete base em reais"
              />
              <input
                className={inputClass}
                inputMode="decimal"
                placeholder="R$/km (opcional)"
                value={value.valorKm}
                onChange={(e) => set('valorKm', e.target.value)}
                aria-label="Valor por quilômetro"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              className={inputClass}
              inputMode="decimal"
              placeholder="Valor NF R$"
              value={value.valorNf}
              onChange={(e) => set('valorNf', e.target.value)}
            />
            <input
              className={inputClass}
              inputMode="decimal"
              placeholder="Peso KG"
              value={value.pesoKg}
              onChange={(e) => set('pesoKg', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <input
              className={inputClass}
              inputMode="decimal"
              placeholder="Alt (m)"
              value={value.altM}
              onChange={(e) => set('altM', e.target.value)}
            />
            <input
              className={inputClass}
              inputMode="decimal"
              placeholder="Larg (m)"
              value={value.largM}
              onChange={(e) => set('largM', e.target.value)}
            />
            <input
              className={inputClass}
              inputMode="decimal"
              placeholder="Prof (m)"
              value={value.profM}
              onChange={(e) => set('profM', e.target.value)}
            />
          </div>

          <input
            className={inputClass}
            inputMode="decimal"
            placeholder="Seguro sobre NF (%) — ex: 0,50"
            value={value.seguroPct}
            onChange={(e) => set('seguroPct', e.target.value)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <input
                className={inputClass}
                inputMode="decimal"
                placeholder={
                  value.freteManual.trim()
                    ? 'Taxas embutidas no frete base (R$)'
                    : 'Taxas fixas (R$) — somadas ao frete por km'
                }
                value={value.taxasFixas}
                onChange={(e) => set('taxasFixas', e.target.value)}
              />
            </div>
            <input
              className={inputClass}
              inputMode="decimal"
              placeholder={value.freteManual.trim() ? 'ICMS (%) — embutido no frete base' : 'ICMS (%)'}
              value={value.icmsPct}
              onChange={(e) => set('icmsPct', e.target.value)}
            />
          </div>

          <input
            className={inputClass}
            inputMode="decimal"
            placeholder="Desconto (%)"
            value={value.descontoPct}
            onChange={(e) => set('descontoPct', e.target.value)}
          />

          <div>
            <label htmlFor="proposta-obs" className="block text-sm font-medium text-gray-700 mb-1.5">
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
