'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Target, X } from 'lucide-react'
import { useMonthlySalesGoals } from '@/lib/hooks/useMonthlySalesGoals'
import { saveMonthlySalesGoal } from '@/lib/services/monthly-sales-goals'
import { dashboardMonthKey, monthlyGoalProgress } from '@/lib/utils/dashboard-metrics'
import { formatBRL } from '@/lib/utils/freight-financials'

export function MonthlyGoalView({ revenue, amount, monthLabel, loading, error, onEdit, onRetry }: {
  revenue: number; amount: number | null; monthLabel: string; loading: boolean; error: string | null; onEdit?: () => void; onRetry?: () => void;
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
    {onEdit && <button type="button" onClick={onEdit} className="mt-5 w-full rounded-lg border border-slate-200 py-2 text-xs font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">Definir metas</button>}
  </section>
}

function GoalEditor({ userId, initialMonth, onClose, onSaved }: { userId: string; initialMonth: string; onClose: () => void; onSaved: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [month, setMonth] = useState(initialMonth.slice(0, 7))
  const [sellerId, setSellerId] = useState(userId)
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null)
  const { goals, sellers, loading, error, refresh } = useMonthlySalesGoals(userId, `${month}-01`, true)
  useEffect(() => { dialog.current?.showModal(); return () => dialog.current?.close() }, [])
  useEffect(() => { setAmount(goals.find(goal => goal.user_id === sellerId)?.amount.toString() ?? '') }, [goals, sellerId, month])
  useEffect(() => { setFeedback(null) }, [sellerId, month])
  async function save(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setFeedback(null)
    try { await saveMonthlySalesGoal(sellerId, `${month}-01`, Number(amount)); await refresh(); onSaved(); setFeedback({ error: false, text: 'Meta salva com sucesso.' }) }
    catch (err) { setFeedback({ error: true, text: err instanceof Error ? err.message : 'Erro ao salvar meta.' }) }
    finally { setSaving(false) }
  }
  return <dialog ref={dialog} onCancel={event => { if (saving) event.preventDefault(); else onClose() }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-950/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
    <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800"><div><h2 className="font-semibold">Metas mensais dos vendedores</h2><p className="mt-1 text-xs text-slate-500">Cada mês possui sua própria meta.</p></div><button type="button" onClick={onClose} disabled={saving} aria-label="Fechar metas" className="rounded-lg p-2 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button></div>
    <form onSubmit={event => void save(event)} className="space-y-4 p-5">
      <label className="block text-xs font-medium">Mês<input type="month" value={month} required min="2020-01" max="2100-12" disabled={saving} onChange={event => { if (event.target.value) setMonth(event.target.value) }} className="mt-2 w-full rounded-lg border border-slate-200 bg-transparent p-2.5 dark:border-slate-700" /></label>
      <label className="block text-xs font-medium">Vendedor<select autoFocus value={sellerId} disabled={loading || saving} onChange={event => setSellerId(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900">{sellers.map(seller => <option key={seller.id} value={seller.id}>{seller.name || seller.email}</option>)}</select></label>
      <label className="block text-xs font-medium">Meta de faturamento (R$)<input type="number" inputMode="decimal" min="0.01" max="999999999999.99" step="0.01" required value={amount} disabled={loading || saving} onChange={event => setAmount(event.target.value)} placeholder="Informe o valor mensal" className="mt-2 w-full rounded-lg border border-slate-200 bg-transparent p-2.5 dark:border-slate-700" /></label>
      {loading && <p role="status" className="text-xs text-slate-500">Carregando metas...</p>}
      {error && <div role="alert" className="text-xs text-rose-600 dark:text-rose-300">{error}<button type="button" onClick={() => void refresh()} className="ml-2 underline">Tentar novamente</button></div>}
      {feedback && <p role={feedback.error ? 'alert' : 'status'} className={`text-xs ${feedback.error ? 'text-rose-600 dark:text-rose-300' : 'text-emerald-600 dark:text-emerald-300'}`}>{feedback.text}</p>}
      <button type="submit" disabled={saving || loading || !!error || !sellerId} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{saving ? 'Salvando...' : 'Salvar meta'}</button>
    </form>
  </dialog>
}

export function MonthlyGoalCard({ userId, isAdmin, now, revenue }: { userId: string | null; isAdmin: boolean; now: Date; revenue: number }) {
  const month = dashboardMonthKey(now)
  const { goals, loading, error, refresh } = useMonthlySalesGoals(userId, month, false, now.getTime())
  const [editing, setEditing] = useState(false)
  return <>
    <MonthlyGoalView revenue={revenue} amount={goals.find(goal => goal.user_id === userId)?.amount ?? null} monthLabel={now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })} loading={loading} error={error} onRetry={() => void refresh()} onEdit={isAdmin ? () => setEditing(true) : undefined} />
    {editing && isAdmin && userId && <GoalEditor userId={userId} initialMonth={month} onClose={() => setEditing(false)} onSaved={() => void refresh()} />}
  </>
}
