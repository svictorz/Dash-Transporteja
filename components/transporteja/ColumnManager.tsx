'use client'

import { useEffect, useRef, useState } from 'react'
import { Columns, ChevronUp, ChevronDown, Eye, EyeOff, RotateCcw } from 'lucide-react'
import type { ColumnDef } from '@/lib/hooks/useColumnPrefs'

interface ColumnManagerProps {
  /** Colunas na ordem atual (todas, visíveis e ocultas). */
  orderedColumns: ColumnDef[]
  isVisible: (key: string) => boolean
  onToggle: (key: string) => void
  onMove: (key: string, dir: -1 | 1) => void
  onReset: () => void
}

/**
 * Botão "Colunas" que abre um painel para mostrar/ocultar e reordenar as
 * colunas de uma tabela. Stateless quanto à preferência — recebe tudo do
 * `useColumnPrefs`.
 */
export default function ColumnManager({
  orderedColumns,
  isVisible,
  onToggle,
  onMove,
  onReset,
}: ColumnManagerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const visibleCount = orderedColumns.filter((c) => isVisible(c.key)).length

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-gray-700 dark:text-slate-100 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
        aria-haspopup="true"
        aria-expanded={open}
        title="Organizar colunas"
      >
        <Columns className="w-4 h-4" aria-hidden />
        Colunas
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-72 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-2">
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-xs font-semibold text-gray-500 dark:text-slate-300 uppercase tracking-wide">
              Colunas ({visibleCount}/{orderedColumns.length})
            </span>
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100"
              title="Restaurar padrão"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden />
              Padrão
            </button>
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {orderedColumns.map((col, index) => {
              const visible = isVisible(col.key)
              return (
                <li
                  key={col.key}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800"
                >
                  <button
                    type="button"
                    onClick={() => onToggle(col.key)}
                    disabled={col.locked}
                    className="shrink-0 text-gray-500 dark:text-slate-300 disabled:opacity-40"
                    title={col.locked ? 'Coluna fixa' : visible ? 'Ocultar coluna' : 'Mostrar coluna'}
                    aria-pressed={visible}
                  >
                    {visible ? <Eye className="w-4 h-4" aria-hidden /> : <EyeOff className="w-4 h-4" aria-hidden />}
                  </button>
                  <span
                    className={`flex-1 text-sm truncate ${
                      visible ? 'text-gray-800 dark:text-slate-100' : 'text-gray-400 dark:text-slate-500'
                    }`}
                  >
                    {col.label}
                    {col.locked && <span className="ml-1 text-[10px] text-gray-400">(fixa)</span>}
                  </span>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onMove(col.key, -1)}
                      disabled={index === 0}
                      className="p-1 rounded text-gray-500 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-30"
                      title="Mover para cima"
                    >
                      <ChevronUp className="w-4 h-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => onMove(col.key, 1)}
                      disabled={index === orderedColumns.length - 1}
                      className="p-1 rounded text-gray-500 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-30"
                      title="Mover para baixo"
                    >
                      <ChevronDown className="w-4 h-4" aria-hidden />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
