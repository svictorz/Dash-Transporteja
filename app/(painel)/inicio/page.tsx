'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRoutes } from '@/lib/hooks/useRoutes'
import { useAuthState } from '@/lib/hooks/useAuthState'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import { buildDashboardMetrics, DASHBOARD_PERIODS, type DashboardPeriod } from '@/lib/utils/dashboard-metrics'
import BrandLoading from '@/components/transporteja/BrandLoading'
import { DashboardOverview } from '@/components/dashboard/DashboardOverview'
import { MonthlyGoalCard } from '@/components/dashboard/MonthlyGoalCard'
import type { Route } from '@/lib/services/routes'

export default function InicioPage() {
  const { routes, loading, error, loadRoutes, updateRoute } = useRoutes()
  const { session, loading: authLoading } = useAuthState()
  const { user } = useCurrentUser()
  const [mounted, setMounted] = useState(false)
  const [period, setPeriod] = useState<DashboardPeriod>('month')
  const [now, setNow] = useState(() => new Date())
  const [savingCommissionId, setSavingCommissionId] = useState<string | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const userId = session?.user?.id ?? null
  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    setMounted(true)
    try {
      const saved = localStorage.getItem('dashboard:period')
      if (DASHBOARD_PERIODS.some(option => option.value === saved)) setPeriod(saved as DashboardPeriod)
    } catch {}
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    if (mounted) { try { localStorage.setItem('dashboard:period', period) } catch {} }
  }, [mounted, period])
  const metrics = useMemo(() => buildDashboardMetrics(routes, userId, period, now, user?.commission_rate), [routes, userId, period, now, user?.commission_rate])
  async function toggleCommission(route: Route) {
    if (!isAdmin || savingCommissionId) return
    setSavingCommissionId(route.id)
    setUpdateError(null)
    try { await updateRoute(route.id, { commission_paid: !route.commission_paid }) }
    catch (err) { setUpdateError(err instanceof Error ? err.message : 'Não foi possível atualizar a comissão.') }
    finally { setSavingCommissionId(null) }
  }
  if (!mounted || authLoading || (loading && routes.length === 0)) return <BrandLoading fullScreen={false} />
  return <>
    {(error || updateError) && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200">{error || updateError}</div>}
    <DashboardOverview metrics={metrics} period={period} onPeriodChange={setPeriod} refreshing={loading} onRefresh={() => { setNow(new Date()); void loadRoutes() }} isAdmin={isAdmin} savingCommissionId={savingCommissionId} onToggleCommission={route => void toggleCommission(route)} goal={<MonthlyGoalCard userId={userId} now={now} revenue={metrics.monthlyRevenue} />} />
  </>
}
