'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users,
  Shield,
  Wallet,
  Briefcase,
  Search,
  Loader2,
  Check,
  AlertCircle,
  Mail,
  UserMinus,
  Percent,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import {
  dashboardRoleLabel,
  isSuperAdminEmail,
  type DashboardUserRole,
} from '@/lib/utils/roles'

type AssignableRole = 'admin' | 'comercial' | 'financeiro'

interface ManagedUser {
  id: string
  email: string
  name: string | null
  role: DashboardUserRole | null
  commission_rate: number | null
  created_at: string | null
}

const ROLE_OPTIONS: { value: AssignableRole; label: string; description: string; icon: typeof Shield }[] = [
  {
    value: 'admin',
    label: 'Administrador',
    description: 'Acesso total ao sistema, vê todos os fretes e gerencia permissões.',
    icon: Shield,
  },
  {
    value: 'financeiro',
    label: 'Financeiro',
    description: 'Visão completa: vê fretes/rotas/performance de todos os comerciais.',
    icon: Wallet,
  },
  {
    value: 'comercial',
    label: 'Comercial',
    description: 'Vê apenas os fretes, rotas e performance que ele mesmo cadastrou.',
    icon: Briefcase,
  },
]

const ROLE_BADGE: Record<AssignableRole, string> = {
  admin:
    'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-500/25 dark:text-rose-200 dark:border-rose-400/50',
  financeiro:
    'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/25 dark:text-amber-200 dark:border-amber-400/50',
  comercial:
    'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-500/25 dark:text-sky-200 dark:border-sky-400/50',
}

export default function UsuariosPage() {
  const router = useRouter()
  const { user: me, loading: meLoading } = useCurrentUser()
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | AssignableRole>('all')
  const [commissionDraft, setCommissionDraft] = useState<Record<string, string>>({})
  const [savingCommissionId, setSavingCommissionId] = useState<string | null>(null)

  const isAuthorized = isSuperAdminEmail(me?.email)

  useEffect(() => {
    if (meLoading) return
    if (!isAuthorized) {
      router.replace('/inicio')
    }
  }, [meLoading, isAuthorized, router])

  useEffect(() => {
    if (!isAuthorized) return
    let cancelled = false

    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const { data, error: err } = await supabase
          .from('users')
          .select('id, email, name, role, commission_rate, created_at')
          .order('created_at', { ascending: false })

        if (err) throw new Error(err.message)
        if (cancelled) return
        setUsers((data as ManagedUser[]) ?? [])
      } catch (e: unknown) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Erro ao carregar usuários')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [isAuthorized])

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter((u) => {
      if (filter !== 'all') {
        const role = ((u.role as string | null) === 'operator' ? 'comercial' : u.role) ?? null
        if (role !== filter) return false
      }
      if (!q) return true
      return (
        (u.name ?? '').toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      )
    })
  }, [users, search, filter])

  const counts = useMemo(() => {
    let admin = 0
    let financeiro = 0
    let comercial = 0
    users.forEach((u) => {
      const r = (u.role as string | null) === 'operator' ? 'comercial' : u.role
      if (r === 'admin') admin += 1
      else if (r === 'financeiro') financeiro += 1
      else if (r === 'comercial') comercial += 1
    })
    return { admin, financeiro, comercial, total: users.length }
  }, [users])

  const handleChangeRole = async (target: ManagedUser, newRole: AssignableRole) => {
    if (target.role === newRole) return
    if (target.email && isSuperAdminEmail(target.email) && newRole !== 'admin') {
      alert('O proprietário do sistema não pode deixar de ser administrador.')
      return
    }

    try {
      setSavingId(target.id)
      setSavedId(null)
      setError(null)

      const { error: err } = await supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', target.id)

      if (err) throw new Error(err.message)

      setUsers((prev) =>
        prev.map((u) => (u.id === target.id ? { ...u, role: newRole } : u)),
      )
      setSavedId(target.id)
      setTimeout(() => setSavedId((curr) => (curr === target.id ? null : curr)), 2000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar permissão')
    } finally {
      setSavingId(null)
    }
  }

  const handleSaveCommissionRate = async (target: ManagedUser) => {
    const raw = commissionDraft[target.id]
    if (raw === undefined) return
    const parsed = parseFloat(raw.replace(',', '.'))
    if (isNaN(parsed) || parsed < 0 || parsed > 100) return
    const rounded = Math.round(parsed * 100) / 100
    if (rounded === (target.commission_rate ?? 30)) return

    try {
      setSavingCommissionId(target.id)
      const { error: err } = await supabase
        .from('users')
        .update({ commission_rate: rounded })
        .eq('id', target.id)
      if (err) throw new Error(err.message)
      setUsers((prev) =>
        prev.map((u) => (u.id === target.id ? { ...u, commission_rate: rounded } : u)),
      )
      setCommissionDraft((prev) => { const n = { ...prev }; delete n[target.id]; return n })
      setSavedId(target.id)
      setTimeout(() => setSavedId((curr) => (curr === target.id ? null : curr)), 2000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar comissão')
    } finally {
      setSavingCommissionId(null)
    }
  }

  const handleRevokeAccess = async (target: ManagedUser) => {
    if (target.email && isSuperAdminEmail(target.email)) {
      alert('O proprietário do sistema não pode ter o acesso revogado.')
      return
    }
    if (me?.id === target.id) {
      alert('Você não pode revogar o próprio acesso. Peça a outro administrador.')
      return
    }

    const confirmation = confirm(
      `Remover o acesso de ${target.name || target.email}?\n\n` +
        'A conta e os dados do usuário serão apagados permanentemente. Rotas e clientes ' +
        'criados por ele continuam no sistema, apenas sem dono. Essa ação não pode ser desfeita.',
    )
    if (!confirmation) return

    try {
      setSavingId(target.id)
      setSavedId(null)
      setError(null)

      const res = await fetch('/api/usuarios/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: target.id }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Erro ao remover acesso')

      setUsers((prev) => prev.filter((u) => u.id !== target.id))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao remover acesso')
    } finally {
      setSavingId(null)
    }
  }

  if (meLoading || (!isAuthorized && !meLoading)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
      </div>
    )
  }

  return (
    <div className="max-w-[1280px] mx-auto space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-slate-700" aria-hidden />
            Permissões de usuários
          </h1>
          <p className="text-sm text-gray-600 mt-1 max-w-2xl">
            Defina o nível de acesso de cada conta. <strong>Comercial</strong> vê apenas os
            próprios fretes, rotas e performance. <strong>Financeiro</strong> e
            <strong> Administrador</strong> veem tudo.
          </p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 max-w-md">
          Apenas administradores podem alterar permissões. As mudanças entram em vigor no
          próximo carregamento da página do usuário afetado.
        </div>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="Total" value={counts.total} icon={Users} tone="slate" />
        <SummaryCard label="Administradores" value={counts.admin} icon={Shield} tone="rose" />
        <SummaryCard label="Financeiro" value={counts.financeiro} icon={Wallet} tone="amber" />
        <SummaryCard label="Comerciais" value={counts.comercial} icon={Briefcase} tone="sky" />
      </div>

      <section className="grid sm:grid-cols-3 gap-3">
        {ROLE_OPTIONS.map((opt) => {
          const Icon = opt.icon
          return (
            <div
              key={opt.value}
              className="rounded-2xl border border-gray-200 bg-white p-4 flex gap-3"
            >
              <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5" aria-hidden />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">{opt.label}</h3>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">{opt.description}</p>
              </div>
            </div>
          )
        })}
      </section>

      <div className="glass-card rounded-2xl border border-white/40 p-4 md:p-5 shadow-lg backdrop-blur-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou e-mail"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-800/40"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(['all', 'admin', 'financeiro', 'comercial'] as const).map((key) => {
              const active = filter === key
              const label =
                key === 'all'
                  ? 'Todos'
                  : key === 'admin'
                  ? 'Admin'
                  : key === 'financeiro'
                  ? 'Financeiro'
                  : 'Comercial'
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
                    active
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" aria-hidden />
            {error}
          </div>
        )}

        <div className="rounded-2xl border border-gray-200 bg-white dark:bg-slate-900 dark:border-slate-500 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 dark:bg-slate-800 dark:text-slate-200 text-left">
                <tr>
                  <th className="px-4 py-3 font-semibold">Usuário</th>
                  <th className="px-4 py-3 font-semibold">Função atual</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">% Comissão</th>
                  <th className="px-4 py-3 font-semibold">Alterar permissão</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-gray-500">
                      <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
                      Carregando usuários...
                    </td>
                  </tr>
                )}

                {!loading && filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-gray-500">
                      Nenhum usuário encontrado.
                    </td>
                  </tr>
                )}

                {!loading &&
                  filteredUsers.map((u) => {
                    const currentRole: AssignableRole | 'driver' | null =
                      (u.role as string | null) === 'operator' ? 'comercial' : (u.role as AssignableRole | 'driver' | null)
                    const isOwner = isSuperAdminEmail(u.email)
                    const badge = currentRole && currentRole !== 'driver'
                      ? ROLE_BADGE[currentRole]
                      : 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-500'

                    return (
                      <tr key={u.id} className="border-t border-gray-100 dark:border-slate-500">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-slate-800 text-white flex items-center justify-center text-sm font-semibold uppercase flex-shrink-0">
                              {(u.name?.trim().charAt(0) || u.email.charAt(0)).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900 dark:text-slate-100 truncate">
                                {u.name || '—'}
                                {isOwner && (
                                  <span className="ml-2 inline-flex items-center text-[10px] uppercase tracking-wide text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded">
                                    Proprietário
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-slate-300 truncate flex items-center gap-1">
                                <Mail className="w-3 h-3" aria-hidden />
                                {u.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${badge}`}
                          >
                            {dashboardRoleLabel(u.role)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {currentRole === 'comercial' ? (
                            <div className="flex items-center gap-1.5">
                              <div className="relative w-20">
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step={0.5}
                                  value={commissionDraft[u.id] ?? String(u.commission_rate ?? 30)}
                                  onChange={(e) =>
                                    setCommissionDraft((prev) => ({ ...prev, [u.id]: e.target.value }))
                                  }
                                  onBlur={() => void handleSaveCommissionRate(u)}
                                  onKeyDown={(e) => { if (e.key === 'Enter') void handleSaveCommissionRate(u) }}
                                  className="w-full pr-5 pl-2 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800/40 text-right"
                                />
                                <Percent className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                              </div>
                              {savingCommissionId === u.id && (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400 flex-shrink-0" />
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="inline-flex rounded-xl border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-900 overflow-hidden">
                              {(['admin', 'financeiro', 'comercial'] as AssignableRole[]).map(
                                (roleKey) => {
                                  const isActive =
                                    ((currentRole as string | null) === 'operator' ? 'comercial' : currentRole) ===
                                    roleKey
                                  const disabled =
                                    savingId === u.id ||
                                    (isOwner && roleKey !== 'admin')
                                  return (
                                    <button
                                      key={roleKey}
                                      type="button"
                                      disabled={disabled}
                                      onClick={() => handleChangeRole(u, roleKey)}
                                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                                        isActive
                                          ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                                          : 'text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800'
                                      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                      aria-pressed={isActive}
                                    >
                                      {roleKey === 'admin'
                                        ? 'Admin'
                                        : roleKey === 'financeiro'
                                        ? 'Financeiro'
                                        : 'Comercial'}
                                    </button>
                                  )
                                },
                              )}
                            </div>
                            <button
                              type="button"
                              disabled={
                                savingId === u.id ||
                                isOwner ||
                                me?.id === u.id ||
                                u.role === null
                              }
                              onClick={() => handleRevokeAccess(u)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-300 bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100 transition-colors dark:border-red-400/60 dark:bg-red-500/20 dark:text-red-200 dark:hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                              title={
                                isOwner
                                  ? 'O proprietário não pode ser revogado'
                                  : me?.id === u.id
                                  ? 'Você não pode revogar o próprio acesso'
                                  : u.role === null
                                  ? 'Este usuário já está sem acesso'
                                  : 'Remover acesso ao CRM'
                              }
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                              Remover acesso
                            </button>
                            {savingId === u.id && (
                              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                            )}
                            {savedId === u.id && (
                              <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
                                <Check className="w-3.5 h-3.5" /> salvo
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

interface SummaryCardProps {
  label: string
  value: number
  icon: typeof Shield
  tone: 'slate' | 'rose' | 'amber' | 'sky'
}

function SummaryCard({ label, value, icon: Icon, tone }: SummaryCardProps) {
  const tones: Record<SummaryCardProps['tone'], string> = {
    slate: 'bg-slate-100 text-slate-700',
    rose: 'bg-rose-100 text-rose-700',
    amber: 'bg-amber-100 text-amber-700',
    sky: 'bg-sky-100 text-sky-700',
  }
  return (
    <div className="rounded-2xl bg-white border border-gray-200 p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${tones[tone]}`}>
        <Icon className="w-5 h-5" aria-hidden />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  )
}
