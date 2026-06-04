'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

export interface ColumnDef {
  /** Identificador estável da coluna (não muda entre versões). */
  key: string
  /** Rótulo exibido no organizador e, em geral, no cabeçalho. */
  label: string
  /** Quando true, a coluna não pode ser ocultada (ex.: ID do frete). */
  locked?: boolean
}

interface StoredPrefs {
  order: string[]
  hidden: string[]
}

/**
 * Gerencia ordem e visibilidade de colunas de uma tabela, persistindo a
 * preferência do usuário no localStorage. Reconcilia automaticamente quando
 * o conjunto de colunas do código muda (novas colunas entram no fim; colunas
 * removidas saem da preferência salva).
 */
export function useColumnPrefs(storageKey: string, columns: ColumnDef[]) {
  const defaultOrder = useMemo(() => columns.map((c) => c.key), [columns])
  const colByKey = useMemo(() => {
    const m = new Map<string, ColumnDef>()
    columns.forEach((c) => m.set(c.key, c))
    return m
  }, [columns])

  const [order, setOrder] = useState<string[]>(defaultOrder)
  const [hidden, setHidden] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)

  // Carrega e reconcilia com as colunas atuais.
  useEffect(() => {
    let stored: StoredPrefs | null = null
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) stored = JSON.parse(raw) as StoredPrefs
    } catch {
      /* ignore */
    }

    const validKeys = new Set(defaultOrder)
    const storedOrder = (stored?.order ?? []).filter((k) => validKeys.has(k))
    // Acrescenta colunas novas (que não estavam na preferência salva) no fim.
    const merged = [...storedOrder, ...defaultOrder.filter((k) => !storedOrder.includes(k))]
    // Colunas travadas nunca ficam ocultas.
    const storedHidden = (stored?.hidden ?? []).filter((k) => validKeys.has(k) && !colByKey.get(k)?.locked)

    setOrder(merged)
    setHidden(storedHidden)
    setLoaded(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  // Persiste sempre que mudar (após o carregamento inicial).
  useEffect(() => {
    if (!loaded) return
    try {
      localStorage.setItem(storageKey, JSON.stringify({ order, hidden } satisfies StoredPrefs))
    } catch {
      /* ignore */
    }
  }, [order, hidden, loaded, storageKey])

  const isVisible = useCallback((key: string) => !hidden.includes(key), [hidden])

  const toggle = useCallback(
    (key: string) => {
      if (colByKey.get(key)?.locked) return
      setHidden((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
    },
    [colByKey],
  )

  const move = useCallback((key: string, dir: -1 | 1) => {
    setOrder((prev) => {
      const idx = prev.indexOf(key)
      const target = idx + dir
      if (idx < 0 || target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })
  }, [])

  const reset = useCallback(() => {
    setOrder(defaultOrder)
    setHidden([])
  }, [defaultOrder])

  /** Colunas na ordem escolhida, apenas as visíveis. */
  const visibleKeys = useMemo(() => order.filter((k) => !hidden.includes(k)), [order, hidden])

  /** Colunas ordenadas (todas), com sua definição — para a UI do organizador. */
  const orderedColumns = useMemo(
    () => order.map((k) => colByKey.get(k)).filter((c): c is ColumnDef => Boolean(c)),
    [order, colByKey],
  )

  return { order, hidden, visibleKeys, orderedColumns, isVisible, toggle, move, reset }
}
