'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getMonthlySalesGoals, type MonthlySalesGoal, type GoalSeller } from '@/lib/services/monthly-sales-goals'

export function useMonthlySalesGoals(userId: string | null, month: string, admin = false, refreshVersion = 0) {
  const [goals, setGoals] = useState<MonthlySalesGoal[]>([])
  const [sellers, setSellers] = useState<GoalSeller[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const generation = useRef(0)
  const load = useCallback(async () => {
    const request = ++generation.current
    if (!userId) { setGoals([]); setSellers([]); setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const result = await getMonthlySalesGoals(userId, month, admin)
      if (request === generation.current) { setGoals(result.goals); setSellers(result.sellers) }
    } catch (err) {
      if (request === generation.current) { setGoals([]); setError(err instanceof Error ? err.message : 'Erro ao carregar metas.') }
    } finally { if (request === generation.current) setLoading(false) }
  }, [userId, month, admin])
  useEffect(() => { void load(); return () => { generation.current++ } }, [load, refreshVersion])
  return { goals, sellers, loading, error, refresh: load }
}
