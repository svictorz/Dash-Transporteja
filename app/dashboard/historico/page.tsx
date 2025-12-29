'use client'

import { useState, useEffect } from 'react'
import { History, Calendar, Filter, Download } from 'lucide-react'

interface HistoryRecord {
  id: string
  type: 'checkin' | 'route' | 'system'
  title: string
  description: string
  timestamp: string
}

export default function HistoricoPage() {
  const [history, setHistory] = useState<HistoryRecord[]>([])
  const [filterType, setFilterType] = useState<'all' | 'checkin' | 'route' | 'system'>('all')

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Carregar histórico de check-ins
    const stored = localStorage.getItem('checkin-history')
    const historyRecords: HistoryRecord[] = []

    if (stored) {
      try {
        const checkIns = JSON.parse(stored)
        checkIns.forEach((checkIn: any) => {
          historyRecords.push({
            id: checkIn.id,
            type: 'checkin',
            title: `Check-in de ${checkIn.type === 'pickup' ? 'Coleta' : 'Entrega'}`,
            description: checkIn.address || `Frete #${checkIn.freightId || 'N/A'}`,
            timestamp: checkIn.timestamp
          })
        })
      } catch (error) {
        console.error('Erro ao carregar histórico:', error)
      }
    }

    // Adicionar registros de sistema (mock)
    historyRecords.push(
      {
        id: 'sys-1',
        type: 'system',
        title: 'Sistema iniciado',
        description: 'Sistema TransporteJá foi iniciado',
        timestamp: new Date().toISOString()
      }
    )

    // Ordenar por data (mais recente primeiro)
    historyRecords.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )

    setHistory(historyRecords)
  }, [])

  const filteredHistory = filterType === 'all' 
    ? history 
    : history.filter(h => h.type === filterType)

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleString('pt-BR')
  }

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'checkin':
        return (
          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
            Check-in
          </span>
        )
      case 'route':
        return (
          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
            Rota
          </span>
        )
      case 'system':
        return (
          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold">
            Sistema
          </span>
        )
      default:
        return null
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Histórico</h1>
          <p className="text-gray-600 mt-1">Registro completo de atividades do sistema</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            Total: {filteredHistory.length} registros
          </span>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
        <div className="flex gap-2">
          <button
            onClick={() => setFilterType('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterType === 'all'
                ? 'bg-slate-800 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setFilterType('checkin')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterType === 'checkin'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Check-ins
          </button>
          <button
            onClick={() => setFilterType('route')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterType === 'route'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Rotas
          </button>
          <button
            onClick={() => setFilterType('system')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterType === 'system'
                ? 'bg-gray-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Sistema
          </button>
        </div>
      </div>

      {/* Lista de Histórico */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {filteredHistory.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <History className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>Nenhum registro encontrado</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredHistory.map((record) => (
              <div
                key={record.id}
                className="p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center flex-shrink-0">
                      <History className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {getTypeBadge(record.type)}
                        <h3 className="font-semibold text-gray-900">{record.title}</h3>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{record.description}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDate(record.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

