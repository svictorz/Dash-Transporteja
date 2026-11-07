'use client'

import { Loader2, Target } from 'lucide-react'
import { useMonthlySalesGoals } from '@/lib/hooks/useMonthlySalesGoals'
import { dashboardMonthKey, monthlyGoalProgress } from '@/lib/utils/dashboard-metrics'
import { formatBRL } from '@/lib/utils/freight-financials'

export function MonthlyGoalView({ revenue, amount, monthLabel, loading, error, onRetry }: {
  revenue: number; amount: number | null; monthLabel: string; loading: boolean; error: string | null; onRetry?: () => void;
}) {
  const progress = monthlyGoalProgress(revenue, amount)
  return <section className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-700 dark:bg-slate-900 sm:p-6">
    <div className="flex items-start justify-between"><div><h2 className="text-sm font-semibold">Meta mensal</h2><p className="mt-1 text-xs capitalize text-slate-500 dark:text-slate-400">{monthLabel}</p></div><Target className="h-4 w-4 text-slate-400" aria-hidden="true" /></div>
    {loading ? <div className="flex h-[182px] items-center justify-center gap-2 text-xs text-slate-500" role="status"><Loader2 className="h-4 w-4 animate-spin" />Carregando meta...</div> : error ? <div className="py-8 text-center"><p role="alert" className="text-xs text-rose-600 dark:text-rose-300">{error}</p><button type="button" onClick={onRetry} className="mt-3 text-xs font-medium text-blue-600 hover:underline">Tentar novamente</button></div> : <>
      <div className="relative mx-auto mt-6 max-w-[250px]" role="img" aria-label={progress.percentage === null ? 'Meta ainda não definida' : `${progress.percentage.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% da meta mensal atingida`}>
        <svg viewBox="0 0 240 142" className="w-full" aria-hidden="true"><path d="M 24 120 A 96 96 0 0 1 216 120" fill="none" stroke="currentColor" className="text-slate-100 dark:text-slate-800" strokeWidth="15" strokeLinecap="round" /><path d="M 24 120 A 96 96 0 0 1 216 120" fill="none" stroke="#3b82f6" strokeWidth="15" strokeLinecap="round" pathLength="100" strokeDasharray={`${progress.gauge} 100`} opacity={progress.gauge > 0 ? 1 : 0} /></svg>
        <div className="absolute inset-x-0 bottom-4 text-center"><strong className="text-3xl font-semibold tracking-tight">{progress.percentage === null ? '—' : `${progress.percentage.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`}</strong><p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{progress.percentage === null ? 'Meta não definida' : progress.percentage >= 100 ? 'Meta atingida!' : 'da meta atingida'}</p></div>
      </div>
      <div className="mt-3 flex justify-between gap-3 border-b border-slate-100 pb-3 text-xs dark:border-slate-800"><span className="text-slate-500 dark:text-slate-400">Faturamento do mês</span><strong className="tabular-nums">{formatBRL(revenue)}</strong></div>
      <dl className="mt-3 space-y-2 text-xs"><div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Sua meta</dt><dd className="font-medium tabular-nums">{amount != null && amount > 0 ? formatBRL(amount) : 'A definir'}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Falta para atingir</dt><dd className="font-medium tabular-nums">{progress.remaining === null ? '—' : formatBRL(progress.remaining)}</dd></div></dl>
      {progress.percentage === null && <p className="mt-4 text-[11px] leading-relaxed text-slate-400">O administrador define sua meta individual para cada mês.</p>}
    </>}
  </section>
}

export function MonthlyGoalCard({ userId, now, revenue }: { userId: string | null; now: Date; revenue: number }) {
  const month = dashboardMonthKey(now)
  const { goals, loading, error, refresh } = useMonthlySalesGoals(userId, month, false, now.getTime())
  return <MonthlyGoalView revenue={revenue} amount={goals.find(goal => goal.user_id === userId)?.amount ?? null} monthLabel={now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })} loading={loading} error={error} onRetry={() => void refresh()} />
}
