'use client'

import { CheckCircle2, Circle, Loader2 } from 'lucide-react'

type CommissionPaidStatusProps = {
  paid: boolean
  loading?: boolean
  /** Somente admin pode alternar o status. Demais perfis veem badge estático. */
  editable?: boolean
  onToggle?: () => void
  compact?: boolean
}

const badgeClass = (paid: boolean) =>
  paid
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
    : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200'

export default function CommissionPaidStatus({
  paid,
  loading = false,
  editable = false,
  onToggle,
  compact = true,
}: CommissionPaidStatusProps) {
  const sizeClass = compact ? 'px-1.5 py-0.5 text-[10px] gap-0.5' : 'px-2.5 py-1 text-xs gap-1'
  const iconClass = compact ? 'w-3 h-3' : 'w-3.5 h-3.5'
  const className = `inline-flex items-center rounded-md border font-semibold ${sizeClass} ${badgeClass(paid)}`

  const content = (
    <>
      {loading ? (
        <Loader2 className={`${iconClass} animate-spin shrink-0`} aria-hidden />
      ) : paid ? (
        <CheckCircle2 className={`${iconClass} shrink-0`} aria-hidden />
      ) : (
        <Circle className={`${iconClass} shrink-0`} aria-hidden />
      )}
      {paid ? 'Pago' : 'Pendente'}
    </>
  )

  if (editable) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onToggle?.()
        }}
        disabled={loading}
        title={
          paid
            ? 'Comissão paga — clique para marcar como pendente'
            : 'Comissão pendente — clique para marcar como paga'
        }
        aria-pressed={paid}
        aria-label={paid ? 'Comissão paga' : 'Comissão pendente'}
        className={`${className} transition-colors disabled:opacity-60 ${
          paid ? 'hover:bg-emerald-100 dark:hover:bg-emerald-950' : 'hover:bg-amber-100 dark:hover:bg-amber-950/60'
        }`}
      >
        {content}
      </button>
    )
  }

  return (
    <span className={className} aria-label={paid ? 'Comissão paga' : 'Comissão pendente'}>
      {content}
    </span>
  )
}
