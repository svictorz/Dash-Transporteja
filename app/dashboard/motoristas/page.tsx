'use client'

import { useState } from 'react'
import { Truck, Phone, Mail, MapPin, CheckCircle2, XCircle, Search, Clock } from 'lucide-react'

interface Driver {
  id: string
  name: string
  phone: string
  email: string
  vehicle: string
  plate: string
  status: 'active' | 'inactive' | 'onRoute'
  location?: string
  lastCheckIn?: string
  cnh?: string
}

const MOCK_DRIVERS: Driver[] = [
  {
    id: '1',
    name: 'José Silva',
    phone: '(11) 99999-1111',
    email: 'jose@transporteja.com',
    vehicle: 'Mercedes-Benz Actros',
    plate: 'ABC-1234',
    status: 'onRoute',
    location: 'Rodovia BR-116, km 245',
    lastCheckIn: '2025-01-28T10:30:00Z',
    cnh: 'CNH: 12345678901'
  },
  {
    id: '2',
    name: 'Antônio Santos',
    phone: '(11) 99999-2222',
    email: 'antonio@transporteja.com',
    vehicle: 'Volvo FH',
    plate: 'DEF-5678',
    status: 'active',
    location: 'São Paulo - SP',
    lastCheckIn: '2025-01-28T08:15:00Z',
    cnh: 'CNH: 98765432109'
  },
  {
    id: '3',
    name: 'Roberto Costa',
    phone: '(11) 99999-3333',
    email: 'roberto@transporteja.com',
    vehicle: 'Scania R450',
    plate: 'GHI-9012',
    status: 'onRoute',
    location: 'Curitiba - PR',
    lastCheckIn: '2025-01-28T11:00:00Z',
    cnh: 'CNH: 11223344556'
  },
  {
    id: '4',
    name: 'Carlos Oliveira',
    phone: '(11) 99999-4444',
    email: 'carlos@transporteja.com',
    vehicle: 'Iveco Stralis',
    plate: 'JKL-3456',
    status: 'inactive',
    lastCheckIn: '2025-01-27T18:00:00Z',
    cnh: 'CNH: 55667788990'
  },
  {
    id: '5',
    name: 'Paulo Mendes',
    phone: '(11) 99999-5555',
    email: 'paulo@transporteja.com',
    vehicle: 'MAN TGX',
    plate: 'MNO-7890',
    status: 'active',
    location: 'Rio de Janeiro - RJ',
    lastCheckIn: '2025-01-28T09:00:00Z',
    cnh: 'CNH: 99887766554'
  },
  {
    id: '6',
    name: 'Fernando Lima',
    phone: '(11) 99999-6666',
    email: 'fernando@transporteja.com',
    vehicle: 'Volvo FH16',
    plate: 'PQR-2468',
    status: 'onRoute',
    location: 'Belo Horizonte - MG',
    lastCheckIn: '2025-01-28T12:00:00Z',
    cnh: 'CNH: 44332211000'
  }
]

export default function MotoristasPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'onRoute'>('all')
  const [drivers] = useState<Driver[]>(MOCK_DRIVERS)

  const filteredDrivers = drivers.filter(driver => {
    const matchesSearch =
      driver.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      driver.phone.includes(searchTerm) ||
      driver.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      driver.vehicle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      driver.email.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesFilter = filterStatus === 'all' || driver.status === filterStatus
    
    return matchesSearch && matchesFilter
  })

  const statusCounts = {
    all: drivers.length,
    active: drivers.filter(d => d.status === 'active').length,
    inactive: drivers.filter(d => d.status === 'inactive').length,
    onRoute: drivers.filter(d => d.status === 'onRoute').length
  }

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'onRoute':
        return {
          label: 'Em Rota',
          dotColor: 'bg-blue-500'
        }
      case 'active':
        return {
          label: 'Ativo',
          dotColor: 'bg-green-500'
        }
      case 'inactive':
        return {
          label: 'Inativo',
          dotColor: 'bg-gray-500'
        }
      default:
        return {
          label: 'Desconhecido',
          dotColor: 'bg-gray-500'
        }
    }
  }

  const formatDate = (timestamp?: string) => {
    if (!timestamp) return 'N/A'
    const date = new Date(timestamp)
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div className="space-y-6">
      {/* Header - Estilo Referência */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900">Motoristas</h1>
          <span className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">
            {statusCounts.all}
          </span>
        </div>
      </div>

      {/* Filtros de Status */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => setFilterStatus('all')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
            filterStatus === 'all'
              ? 'bg-gray-800 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Todos {statusCounts.all}
        </button>
        <button
          onClick={() => setFilterStatus('active')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
            filterStatus === 'active'
              ? 'bg-gray-800 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Ativos {statusCounts.active}
        </button>
        <button
          onClick={() => setFilterStatus('onRoute')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
            filterStatus === 'onRoute'
              ? 'bg-gray-800 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Em Rota {statusCounts.onRoute}
        </button>
        <button
          onClick={() => setFilterStatus('inactive')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
            filterStatus === 'inactive'
              ? 'bg-gray-800 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Inativos {statusCounts.inactive}
        </button>
      </div>

      {/* Busca */}
      <div className="bg-white rounded-xl p-4 border border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por nome, telefone, placa, veículo ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent"
          />
        </div>
      </div>

      {/* Tabela - Estilo Referência Limpo */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Motorista
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Contato
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Veículo
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Localização
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Último Check-in
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredDrivers.map((driver) => {
                const statusDisplay = getStatusDisplay(driver.status)
                return (
                  <tr
                    key={driver.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900">{driver.name}</span>
                        <span className="text-xs text-gray-500 mt-1">{driver.cnh || 'CNH não informada'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-900">{driver.phone}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-900">{driver.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm text-gray-900">{driver.vehicle}</span>
                        <span className="text-xs text-gray-500 mt-1">{driver.plate}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {driver.location ? (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-900">{driver.location}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Não disponível</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {driver.lastCheckIn ? (
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-900">{formatDate(driver.lastCheckIn)}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${statusDisplay.dotColor}`}></div>
                        <span className="text-sm text-gray-900">
                          {statusDisplay.label}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                      >
                        Ver mais
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {filteredDrivers.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Truck className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>Nenhum motorista encontrado</p>
        </div>
      )}
    </div>
  )
}
