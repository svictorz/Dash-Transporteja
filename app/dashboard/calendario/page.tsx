'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { CalendarDays, Clock3, Plus, Truck, Users, BellRing } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

type TipoCompromisso = 'entrega' | 'recebimento' | 'reuniao' | 'outro'

interface AgendaEvento {
  id: string
  dataHora: string
  tipo: TipoCompromisso
  titulo: string
  descricao?: string | null
  origem: 'rota' | 'manual'
}

interface CompromissoForm {
  tipo: TipoCompromisso
  titulo: string
  descricao: string
  data: string
  hora: string
}

interface RouteCalendarRow {
  id: string
  pickup_date: string | null
  estimated_delivery: string | null
  origin: string | null
  destination: string | null
  freight_id: number | null
}

interface CalendarEventRow {
  id: string
  event_type: TipoCompromisso
  title: string
  description: string | null
  event_at: string
}

function toDateInputValue(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Grade do mês com semana começando na segunda-feira (padrão comum no Brasil). */
function buildMonthGrid(baseDate: Date): Date[] {
  const firstDay = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1)
  const weekdaySun0 = firstDay.getDay()
  const daysFromMonday = (weekdaySun0 + 6) % 7
  const gridStart = new Date(firstDay)
  gridStart.setDate(firstDay.getDate() - daysFromMonday)

  const days: Date[] = []
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    days.push(d)
  }
  return days
}

const WEEKDAYS_BR_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const

function formatDayHeadingBR(isoYmd: string): string {
  const parts = isoYmd.split('-').map(Number)
  const y = parts[0]
  const m = parts[1]
  const d = parts[2]
  if (!y || !m || !d) return isoYmd
  const date = new Date(y, m - 1, d)
  const s = date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function labelTipo(tipo: TipoCompromisso): string {
  switch (tipo) {
    case 'entrega':
      return 'Entrega'
    case 'recebimento':
      return 'Recebimento'
    case 'reuniao':
      return 'Reunião'
    default:
      return 'Outro'
  }
}

function iconTipo(tipo: TipoCompromisso) {
  switch (tipo) {
    case 'entrega':
      return Truck
    case 'recebimento':
      return CalendarDays
    case 'reuniao':
      return Users
    default:
      return BellRing
  }
}

export default function CalendarioPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [eventos, setEventos] = useState<AgendaEvento[]>([])
  const [selectedDate, setSelectedDate] = useState<string>(toDateInputValue(new Date()))
  const [calendarBaseDate, setCalendarBaseDate] = useState<Date>(new Date())
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<CompromissoForm>({
    tipo: 'reuniao',
    titulo: '',
    descricao: '',
    data: toDateInputValue(new Date()),
    hora: '09:00',
  })
  const [isSaving, setIsSaving] = useState(false)

  const loadAgenda = async () => {
    try {
      setLoading(true)
      setError(null)

      const {
        data: { session },
      } = await supabase.auth.getSession()
      setCurrentUserId(session?.user?.id ?? null)

      const now = new Date()
      const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0)
      const to = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59)

      const routesPromise = supabase
        .from('routes')
        .select('id, pickup_date, estimated_delivery, origin, destination, freight_id')
        .order('created_at', { ascending: false })

      const compromissosPromise = supabase
        .from('calendar_events')
        .select('id, event_type, title, description, event_at')
        .gte('event_at', from.toISOString())
        .lte('event_at', to.toISOString())
        .order('event_at', { ascending: true })

      const [routesRes, compromissosRes] = await Promise.all([routesPromise, compromissosPromise])

      if (routesRes.error) throw new Error(routesRes.error.message)
      const compromissosError = compromissosRes.error
      if (compromissosError && !compromissosError.message.includes('relation "public.calendar_events" does not exist')) {
        throw new Error(compromissosError.message)
      }

      const eventosRotas: AgendaEvento[] = ((routesRes.data as RouteCalendarRow[]) || []).flatMap((r) => {
        const list: AgendaEvento[] = []

        if (r.pickup_date) {
          list.push({
            id: `pickup-${r.id}`,
            dataHora: `${r.pickup_date}T09:00:00`,
            tipo: 'recebimento',
            titulo: `Coleta do frete #${r.freight_id}`,
            descricao: `${r.origin || '-'} -> ${r.destination || '-'}`,
            origem: 'rota',
          })
        }

        if (r.estimated_delivery) {
          list.push({
            id: `delivery-${r.id}`,
            dataHora: `${r.estimated_delivery}T14:00:00`,
            tipo: 'entrega',
            titulo: `Entrega prevista #${r.freight_id}`,
            descricao: `${r.origin || '-'} -> ${r.destination || '-'}`,
            origem: 'rota',
          })
        }

        return list
      })

      const eventosManuais: AgendaEvento[] = ((compromissosRes.data as CalendarEventRow[]) || []).map((e) => ({
        id: String(e.id),
        dataHora: String(e.event_at),
        tipo: (e.event_type as TipoCompromisso) || 'outro',
        titulo: String(e.title || 'Compromisso'),
        descricao: (e.description as string | null) ?? null,
        origem: 'manual',
      }))

      const merged = [...eventosRotas, ...eventosManuais].sort(
        (a, b) => new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime()
      )
      setEventos(merged)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar agenda')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAgenda()
  }, [])

  const eventosDoDia = useMemo(() => {
    return eventos.filter((e) => e.dataHora.slice(0, 10) === selectedDate)
  }, [eventos, selectedDate])

  const eventosDoMes = useMemo(() => {
    const month = calendarBaseDate.getMonth()
    const year = calendarBaseDate.getFullYear()
    return eventos.filter((e) => {
      const d = new Date(e.dataHora)
      return d.getMonth() === month && d.getFullYear() === year
    })
  }, [eventos, calendarBaseDate])

  const stats = useMemo(() => {
    const pendentes = eventos.filter((e) => new Date(e.dataHora).getTime() >= new Date().getTime()).length
    const concluidos = Math.max(0, eventos.length - pendentes)
    return { total: eventos.length, pendentes, concluidos }
  }, [eventos])

  const monthGrid = useMemo(() => buildMonthGrid(calendarBaseDate), [calendarBaseDate])

  const monthLabel = useMemo(() => {
    const s = calendarBaseDate.toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric',
    })
    return s.charAt(0).toUpperCase() + s.slice(1)
  }, [calendarBaseDate])

  const eventCountByDay = useMemo(() => {
    const map = new Map<string, number>()
    eventos.forEach((e) => {
      const key = e.dataHora.slice(0, 10)
      map.set(key, (map.get(key) || 0) + 1)
    })
    return map
  }, [eventos])

  const handleAddCompromisso = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.titulo.trim() || !form.data || !form.hora) return

    try {
      setIsSaving(true)
      const eventAt = new Date(`${form.data}T${form.hora}:00`).toISOString()
      const { error: insertError } = await supabase.from('calendar_events').insert({
        event_type: form.tipo,
        title: form.titulo.trim(),
        description: form.descricao.trim() || null,
        event_at: eventAt,
        created_by_user_id: currentUserId,
      })
      if (insertError) throw new Error(insertError.message)

      setShowModal(false)
      setForm({
        tipo: 'reuniao',
        titulo: '',
        descricao: '',
        data: selectedDate,
        hora: '09:00',
      })
      await loadAgenda()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao adicionar compromisso')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div lang="pt-BR" className="max-w-[1400px] mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Agenda</h1>
          <p className="text-sm text-gray-600 mt-1">Gerencie seus compromissos e eventos.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 text-white text-sm font-medium hover:bg-slate-900"
        >
          <Plus className="w-4 h-4" aria-hidden />
          Adicionar compromisso
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Total</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{stats.total}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Pendentes</p>
          <p className="text-3xl font-bold text-amber-600 mt-1">{stats.pendentes}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Concluídos</p>
          <p className="text-3xl font-bold text-emerald-600 mt-1">{stats.concluidos}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[280px_minmax(0,1fr)] gap-4">
        <aside className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => setCalendarBaseDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              className="px-2 py-1 rounded-lg text-gray-600 hover:bg-gray-100"
            >
              ←
            </button>
            <p className="text-sm font-semibold text-gray-900">{monthLabel}</p>
            <button
              type="button"
              onClick={() => setCalendarBaseDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              className="px-2 py-1 rounded-lg text-gray-600 hover:bg-gray-100"
            >
              →
            </button>
          </div>

          <div className="grid grid-cols-7 text-[10px] text-gray-500 mb-1 font-medium">
            {WEEKDAYS_BR_SHORT.map((w) => (
              <div key={w} className="text-center py-1">
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {monthGrid.map((d) => {
              const dayKey = toDateInputValue(d)
              const isCurrentMonth = d.getMonth() === calendarBaseDate.getMonth()
              const isSelected = dayKey === selectedDate
              const count = eventCountByDay.get(dayKey) || 0
              return (
                <button
                  key={dayKey}
                  type="button"
                  onClick={() => setSelectedDate(dayKey)}
                  className={`h-8 rounded-lg text-xs font-medium relative ${
                    isSelected
                      ? 'bg-slate-900 text-white'
                      : isCurrentMonth
                        ? 'text-gray-800 hover:bg-gray-100'
                        : 'text-gray-300'
                  }`}
                >
                  {d.getDate()}
                  {count > 0 && (
                    <span
                      className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${
                        isSelected ? 'bg-white/90' : 'bg-emerald-500'
                      }`}
                    />
                  )}
                </button>
              )
            })}
          </div>

          <div className="mt-4 border-t border-gray-100 pt-3">
            <p className="text-xs text-gray-500">Eventos no mês: {eventosDoMes.length}</p>
            <p className="text-xs text-gray-500">Eventos no dia: {eventosDoDia.length}</p>
          </div>
        </aside>

        <section className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-800">
              Compromissos de {formatDayHeadingBR(selectedDate)}
            </h2>
          </div>
          <div className="p-4 space-y-3">
            {loading && <p className="text-sm text-gray-500">Carregando agenda...</p>}
            {error && <p className="text-sm text-red-600">Erro: {error}</p>}
            {!loading && eventosDoDia.length === 0 && (
              <p className="text-sm text-gray-500">Sem compromissos para este dia.</p>
            )}
            {eventosDoDia.map((evento) => {
              const Icon = iconTipo(evento.tipo)
              const dataEvento = new Date(evento.dataHora)
              const hora = dataEvento.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              })
              return (
                <article key={evento.id} className="rounded-xl border border-gray-200 bg-white p-4 hover:shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-slate-700" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900">{evento.titulo}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" aria-hidden />
                          {dataEvento.toLocaleDateString('pt-BR')}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="w-3 h-3" aria-hidden />
                          {hora}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                          {labelTipo(evento.tipo)}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          {evento.origem === 'rota' ? 'Automático' : 'Manual'}
                        </span>
                      </div>
                      {evento.descricao ? <p className="text-sm text-gray-600 mt-2">{evento.descricao}</p> : null}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-gray-200 shadow-xl">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Novo compromisso</h3>
            </div>
            <form onSubmit={handleAddCompromisso} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipo</label>
                <select
                  value={form.tipo}
                  onChange={(e) => setForm((prev) => ({ ...prev, tipo: e.target.value as TipoCompromisso }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300"
                >
                  <option value="entrega">Entrega</option>
                  <option value="recebimento">Recebimento</option>
                  <option value="reuniao">Reunião</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Título</label>
                <input
                  required
                  value={form.titulo}
                  onChange={(e) => setForm((prev) => ({ ...prev, titulo: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300"
                  placeholder="Ex: Reunião com cliente XPTO"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Descrição (opcional)</label>
                <textarea
                  rows={3}
                  value={form.descricao}
                  onChange={(e) => setForm((prev) => ({ ...prev, descricao: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 resize-y"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Data</label>
                  <input
                    type="date"
                    required
                    value={form.data}
                    onChange={(e) => setForm((prev) => ({ ...prev, data: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Hora</label>
                  <input
                    type="time"
                    required
                    value={form.hora}
                    onChange={(e) => setForm((prev) => ({ ...prev, hora: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-white text-sm font-medium hover:bg-slate-900 disabled:opacity-60"
                >
                  {isSaving ? 'Salvando...' : 'Salvar compromisso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

