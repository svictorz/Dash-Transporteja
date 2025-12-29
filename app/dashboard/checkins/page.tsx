'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, MapPin, Download, ExternalLink, Search, Filter, Calendar } from 'lucide-react'

interface CheckInRecord {
  id: string
  type: 'pickup' | 'delivery'
  timestamp: string
  photo: string
  coords: { lat: number; lng: number }
  address?: string
  freightId?: number
}

export default function CheckInsPage() {
  const [checkIns, setCheckIns] = useState<CheckInRecord[]>([])
  const [filteredCheckIns, setFilteredCheckIns] = useState<CheckInRecord[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'pickup' | 'delivery'>('all')

  useEffect(() => {
    if (typeof window === 'undefined') return

    const stored = localStorage.getItem('checkin-history')
    if (stored) {
      try {
        const history = JSON.parse(stored)
        setCheckIns(history)
        setFilteredCheckIns(history)
      } catch (error) {
        console.error('Erro ao carregar check-ins:', error)
      }
    }
  }, [])

  useEffect(() => {
    let filtered = checkIns

    // Filtrar por tipo
    if (filterType !== 'all') {
      filtered = filtered.filter(ci => ci.type === filterType)
    }

    // Filtrar por busca
    if (searchTerm) {
      filtered = filtered.filter(ci => {
        const searchLower = searchTerm.toLowerCase()
        return (
          ci.address?.toLowerCase().includes(searchLower) ||
          ci.freightId?.toString().includes(searchLower) ||
          ci.id.includes(searchLower)
        )
      })
    }

    setFilteredCheckIns(filtered)
  }, [searchTerm, filterType, checkIns])

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp)
    return {
      date: date.toLocaleDateString('pt-BR'),
      time: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }
  }

  const openInGoogleMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank')
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Check-ins</h1>
          <p className="text-gray-600 mt-1">Histórico completo de check-ins realizados</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            Total: {filteredCheckIns.length} check-ins
          </span>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por endereço, frete ou ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent"
            />
          </div>
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
              onClick={() => setFilterType('pickup')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterType === 'pickup'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Coletas
            </button>
            <button
              onClick={() => setFilterType('delivery')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterType === 'delivery'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Entregas
            </button>
          </div>
        </div>
      </div>

      {/* Lista de Check-ins */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {filteredCheckIns.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <CheckCircle2 className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>Nenhum check-in encontrado</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredCheckIns.map((checkIn) => {
              const { date, time } = formatDate(checkIn.timestamp)
              return (
                <div
                  key={checkIn.id}
                  className="p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    {/* Foto */}
                    <div className="flex-shrink-0">
                      <img
                        src={checkIn.photo}
                        alt={checkIn.type}
                        className="w-24 h-24 object-cover rounded-lg"
                      />
                    </div>

                    {/* Informações */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            checkIn.type === 'pickup'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {checkIn.type === 'pickup' ? 'Coleta' : 'Entrega'}
                          </span>
                          {checkIn.freightId && (
                            <span className="text-sm text-gray-600">
                              Frete #{checkIn.freightId}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          {date} às {time}
                        </div>
                      </div>

                      {checkIn.address && (
                        <div className="text-sm text-gray-700 mb-2 flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                          <span>{checkIn.address}</span>
                        </div>
                      )}

                      <div className="text-xs text-gray-500 mb-3">
                        Coordenadas: {checkIn.coords.lat.toFixed(6)}, {checkIn.coords.lng.toFixed(6)}
                      </div>

                      {/* Ações */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => openInGoogleMaps(checkIn.coords.lat, checkIn.coords.lng)}
                          className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Ver no Mapa
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

