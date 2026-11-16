import type { SimilarFreight } from '@/lib/utils/cotacao-similar-freights'

type Props = { freights: SimilarFreight[]; loading: boolean; error: string }

const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
const number = (value: number, digits = 0) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: digits }).format(value)

export default function SimilarFreights({ freights, loading, error }: Props) {
  return <section aria-labelledby="similar-freights-title" className="rounded-xl border border-blue-200 bg-blue-50/60 p-3.5 dark:border-blue-900 dark:bg-blue-950/20">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 pb-2 dark:border-blue-900">
      <h3 id="similar-freights-title" className="text-sm font-bold uppercase tracking-wide text-blue-950 dark:text-blue-200">Top 5 fretes semelhantes</h3>
      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800 dark:bg-blue-900 dark:text-blue-200">Mesmo par de estados</span>
    </div>
    {loading ? <p role="status" className="mt-3 text-xs text-slate-500 dark:text-slate-300">Buscando fretes realizados…</p>
      : error ? <p role="alert" className="mt-3 text-xs text-amber-700 dark:text-amber-300">{error}</p>
      : freights.length === 0 ? <p className="mt-3 text-xs text-slate-500 dark:text-slate-300">Nenhum frete realizado nesta região foi encontrado.</p>
      : <ol className="mt-3 space-y-2">
        {freights.map(freight => <li key={freight.freight_id} className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 text-xs font-semibold text-slate-900 dark:text-slate-100">{freight.origin}/{freight.origin_state} <span className="text-blue-500">→</span> {freight.destination}/{freight.destination_state}</div>
            <div className="text-right"><strong className="block text-sm text-blue-700 dark:text-blue-300">{money(freight.freight_value)}</strong><span className="text-[10px] text-slate-500">#{freight.freight_id}</span></div>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 rounded-md bg-slate-50 px-2 py-1.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <span>Km: {freight.distance_km == null ? 'não informado' : number(freight.distance_km, 1)}</span>
            <span>Peso: {freight.weight_kg == null ? 'não informado' : `${number(freight.weight_kg, 2)} kg`}</span>
            {freight.cubage_m3 != null && <span>Volume: {number(freight.cubage_m3, 3)} m³</span>}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
            {freight.same_cities && <span className="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">Mesmas cidades</span>}
            {freight.weight_close && <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">Peso ±20%</span>}
            {freight.distance_close && <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">Km ±20%</span>}
            {freight.nf_value != null && <span className="ml-auto text-slate-500 dark:text-slate-400">NF: {money(freight.nf_value)}</span>}
          </div>
        </li>)}
      </ol>}
  </section>
}
