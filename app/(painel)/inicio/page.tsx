'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRoutes } from '@/lib/hooks/useRoutes'
import { useAuthState } from '@/lib/hooks/useAuthState'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import { buildDashboardMetrics, dashboardPeriodRange, DASHBOARD_PERIODS, type DashboardCustomRange, type DashboardPeriod } from '@/lib/utils/dashboard-metrics'
import BrandLoading from '@/components/transporteja/BrandLoading'
import { DashboardOverview } from '@/components/dashboard/DashboardOverview'
import { MonthlyGoalCard } from '@/components/dashboard/MonthlyGoalCard'
import type { Route } from '@/lib/services/routes'

const inputDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const initialCustomRange = (): DashboardCustomRange => {
  const today = new Date()
  return { start: inputDate(new Date(today.getFullYear(), today.getMonth(), 1)), end: inputDate(today) }
}

export default function InicioPage() {
  const { routes, loading, error, loadRoutes, updateRoute } = useRoutes()
  const { session, loading: authLoading } = useAuthState()
  const { user } = useCurrentUser()
  const [mounted, setMounted] = useState(false)
  const [showValues, setShowValues] = useState(false)
  const [period, setPeriod] = useState<DashboardPeriod>('month')
  const [customRange, setCustomRange] = useState<DashboardCustomRange>(initialCustomRange)
  const [customDraft, setCustomDraft] = useState<DashboardCustomRange>(initialCustomRange)
  const [customError, setCustomError] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())
  const [savingCommissionId, setSavingCommissionId] = useState<string | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const userId = session?.user?.id ?? null
  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    setMounted(true)
    try { setShowValues(localStorage.getItem('dashboard:showValues') !== 'false') }
    catch { setShowValues(true) }
    try {
      const saved = localStorage.getItem('dashboard:period')
      if (DASHBOARD_PERIODS.some(option => option.value === saved)) setPeriod(saved as DashboardPeriod)
    } catch {}
    try {
      const saved = localStorage.getItem('dashboard:customRange')
      if (saved) {
        const range = JSON.parse(saved) as DashboardCustomRange
        dashboardPeriodRange('custom', new Date(), range)
        setCustomRange(range)
        setCustomDraft(range)
      }
    } catch {}
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    if (mounted) { try { localStorage.setItem('dashboard:period', period) } catch {} }
  }, [mounted, period])
  const metrics = useMemo(() => buildDashboardMetrics(routes, userId, period, now, user?.commission_rate, customRange), [routes, userId, period, now, user?.commission_rate, customRange])
  function applyCustomRange() {
    try {
      dashboardPeriodRange('custom', now, customDraft)
      setCustomRange(customDraft)
      setCustomError(null)
      try { localStorage.setItem('dashboard:customRange', JSON.stringify(customDraft)) } catch {}
    } catch (err) {
      setCustomError(err instanceof Error ? err.message : 'Informe um intervalo válido.')
    }
  }
  function toggleValues() {
    const next = !showValues
    setShowValues(next)
    try { localStorage.setItem('dashboard:showValues', String(next)) } catch {}
  }
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
    <DashboardOverview metrics={metrics} showValues={showValues} onToggleValues={toggleValues} commissionRate={user?.commission_rate} period={period} onPeriodChange={setPeriod} customRange={customRange} customDraft={customDraft} customError={customError} onCustomDraftChange={(field, value) => { setCustomDraft(previous => ({ ...previous, [field]: value })); setCustomError(null) }} onApplyCustomRange={applyCustomRange} refreshing={loading} onRefresh={() => { setNow(new Date()); void loadRoutes() }} isAdmin={isAdmin} savingCommissionId={savingCommissionId} onToggleCommission={route => void toggleCommission(route)} goal={<MonthlyGoalCard userId={userId} now={now} revenue={metrics.monthlyRevenue} netRevenue={metrics.monthlyNet} showValues={showValues} />} />
  </>
}
