'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Route, MapPin, ArrowRight, X, Truck, User, Calendar, Package, Send, Copy, Check, Building2, Phone, Mail, Plus, Search, ChevronDown } from 'lucide-react'

interface RouteData {
  id: string
  freightId: number
  driver: string
  driverCNH: string
  driverPhone: string
  origin: string
  originState: string
  originAddress?: string
  destination: string
  destinationState: string
  destinationAddress?: string
  vehicle: string
  plate: string
  weight: string
  estimatedDelivery: string
  pickupDate: string
  status: 'pending' | 'inTransit' | 'pickedUp' | 'delivered'
  companyName: string
  companyResponsible: string
  companyPhone: string
  companyEmail: string
  companyAddress: string
  companyCity: string
  companyState: string
}

const MOCK_ROUTES: RouteData[] = [
  {
    id: '1',
    freightId: 875412903,
    driver: 'José Silva',
    driverCNH: 'CNH: 12345678901',
    driverPhone: '11999991111',
    origin: 'São Paulo',
    originState: 'SP',
    originAddress: 'Rua das Flores, 123 - Centro',
    destination: 'Curitiba',
    destinationState: 'PR',
    destinationAddress: 'Av. Principal, 456 - Batel',
    vehicle: 'Volvo FH16',
    plate: 'ABC-1234',
    weight: '15.500 kg',
    estimatedDelivery: '05 Out, 2025',
    pickupDate: '03 Out, 2025',
    status: 'inTransit',
    companyName: 'Transportes ABC Ltda',
    companyResponsible: 'João da Silva',
    companyPhone: '(11) 3333-4444',
    companyEmail: 'contato@transportesabc.com.br',
    companyAddress: 'Rua Comercial, 789',
    companyCity: 'São Paulo',
    companyState: 'SP'
  },
  {
    id: '2',
    freightId: 458729654,
    driver: 'Antônio Santos',
    driverCNH: 'CNH: 98765432109',
    driverPhone: '11999992222',
    origin: 'Rio de Janeiro',
    originState: 'RJ',
    originAddress: 'Av. Atlântica, 1000 - Copacabana',
    destination: 'Belo Horizonte',
    destinationState: 'MG',
    destinationAddress: 'Rua da Bahia, 2000 - Centro',
    vehicle: 'Mercedes Actros',
    plate: 'DEF-5678',
    weight: '22.300 kg',
    estimatedDelivery: '05 Out, 2025',
    pickupDate: '04 Out, 2025',
    status: 'delivered',
    companyName: 'Logística XYZ S.A.',
    companyResponsible: 'Maria Santos',
    companyPhone: '(21) 2222-3333',
    companyEmail: 'vendas@logisticaxyz.com.br',
    companyAddress: 'Av. Brasil, 500',
    companyCity: 'Rio de Janeiro',
    companyState: 'RJ'
  },
  {
    id: '3',
    freightId: 913562478,
    driver: 'Roberto Costa',
    driverCNH: 'CNH: 11223344556',
    driverPhone: '11999993333',
    origin: 'Porto Alegre',
    originState: 'RS',
    originAddress: 'Rua dos Andradas, 300 - Centro Histórico',
    destination: 'Florianópolis',
    destinationState: 'SC',
    destinationAddress: 'Av. Beira Mar, 1500 - Centro',
    vehicle: 'MAN TGX',
    plate: 'GHI-9012',
    weight: '18.750 kg',
    estimatedDelivery: '05 Out, 2025',
    pickupDate: '04 Out, 2025',
    status: 'pickedUp',
    companyName: 'Fretes Sul Ltda',
    companyResponsible: 'Carlos Oliveira',
    companyPhone: '(51) 3333-5555',
    companyEmail: 'fretes@fretessul.com.br',
    companyAddress: 'Rua Independência, 600',
    companyCity: 'Porto Alegre',
    companyState: 'RS'
  },
  {
    id: '4',
    freightId: 782345612,
    driver: 'Carlos Oliveira',
    driverCNH: 'CNH: 55667788990',
    driverPhone: '11999994444',
    origin: 'Brasília',
    originState: 'DF',
    originAddress: 'SQN 305, Bloco A - Asa Norte',
    destination: 'Goiânia',
    destinationState: 'GO',
    destinationAddress: 'Av. T-4, 2000 - Setor Bueno',
    vehicle: 'Scania R450',
    plate: 'JKL-3456',
    weight: '12.800 kg',
    estimatedDelivery: '06 Out, 2025',
    pickupDate: '05 Out, 2025',
    status: 'pending',
    companyName: 'Cargas Centro-Oeste',
    companyResponsible: 'Ana Paula',
    companyPhone: '(61) 3444-6666',
    companyEmail: 'contato@cargasco.com.br',
    companyAddress: 'SCS Quadra 1, Bloco A',
    companyCity: 'Brasília',
    companyState: 'DF'
  },
  {
    id: '5',
    freightId: 654123789,
    driver: 'Paulo Mendes',
    driverCNH: 'CNH: 99887766554',
    driverPhone: '11999995555',
    origin: 'Salvador',
    originState: 'BA',
    originAddress: 'Av. Sete de Setembro, 1000 - Centro',
    destination: 'Recife',
    destinationState: 'PE',
    destinationAddress: 'Rua da Aurora, 500 - Boa Vista',
    vehicle: 'Iveco Stralis',
    plate: 'MNO-7890',
    weight: '20.100 kg',
    estimatedDelivery: '06 Out, 2025',
    pickupDate: '05 Out, 2025',
    status: 'inTransit',
    companyName: 'Transportes Nordeste',
    companyResponsible: 'Roberto Alves',
    companyPhone: '(71) 3555-7777',
    companyEmail: 'vendas@transnordeste.com.br',
    companyAddress: 'Av. ACM, 2000',
    companyCity: 'Salvador',
    companyState: 'BA'
  },
  {
    id: '6',
    freightId: 987654321,
    driver: 'Fernando Lima',
    driverCNH: 'CNH: 44332211000',
    driverPhone: '11999996666',
    origin: 'Fortaleza',
    originState: 'CE',
    originAddress: 'Av. Beira Mar, 2000 - Meireles',
    destination: 'Natal',
    destinationState: 'RN',
    destinationAddress: 'Av. Eng. Roberto Freire, 3000 - Ponta Negra',
    vehicle: 'Volvo FH',
    plate: 'PQR-2468',
    weight: '16.900 kg',
    estimatedDelivery: '05 Out, 2025',
    pickupDate: '03 Out, 2025',
    status: 'delivered',
    companyName: 'Fretes Ceará Express',
    companyResponsible: 'Fernanda Costa',
    companyPhone: '(85) 3666-8888',
    companyEmail: 'contato@fretesceara.com.br',
    companyAddress: 'Rua Ildefonso Albano, 1000',
    companyCity: 'Fortaleza',
    companyState: 'CE'
  }
]

interface Driver {
  id: string
  name: string
  phone: string
  email: string
  vehicle: string
  plate: string
  cnh: string
}

interface Company {
  id: string
  companyName: string
  responsible: string
  phone: string
  email: string
  address: string
  city: string
  state: string
}

const MOCK_DRIVERS: Driver[] = [
  {
    id: '1',
    name: 'José Silva',
    phone: '11999991111',
    email: 'jose@transporteja.com',
    vehicle: 'Mercedes-Benz Actros',
    plate: 'ABC-1234',
    cnh: '12345678901'
  },
  {
    id: '2',
    name: 'Antônio Santos',
    phone: '11999992222',
    email: 'antonio@transporteja.com',
    vehicle: 'Volvo FH',
    plate: 'DEF-5678',
    cnh: '98765432109'
  },
  {
    id: '3',
    name: 'Roberto Costa',
    phone: '11999993333',
    email: 'roberto@transporteja.com',
    vehicle: 'Scania R450',
    plate: 'GHI-9012',
    cnh: '11223344556'
  },
  {
    id: '4',
    name: 'Carlos Oliveira',
    phone: '11999994444',
    email: 'carlos@transporteja.com',
    vehicle: 'Iveco Stralis',
    plate: 'JKL-3456',
    cnh: '55667788990'
  },
  {
    id: '5',
    name: 'Paulo Mendes',
    phone: '11999995555',
    email: 'paulo@transporteja.com',
    vehicle: 'MAN TGX',
    plate: 'MNO-7890',
    cnh: '99887766554'
  },
  {
    id: '6',
    name: 'Fernando Lima',
    phone: '11999996666',
    email: 'fernando@transporteja.com',
    vehicle: 'Volvo FH16',
    plate: 'PQR-2468',
    cnh: '44332211000'
  }
]

export default function RotasPage() {
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'inTransit' | 'pickedUp' | 'delivered'>('all')
  const [routes, setRoutes] = useState<RouteData[]>(MOCK_ROUTES)
  const [selectedRoute, setSelectedRoute] = useState<RouteData | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [companies, setCompanies] = useState<Company[]>([])
  
  // Estados para seleção de motorista e empresa
  const [driverSearch, setDriverSearch] = useState('')
  const [companySearch, setCompanySearch] = useState('')
  const [showDriverDropdown, setShowDriverDropdown] = useState(false)
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false)
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null)
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  
  // Estado do formulário
  const [formData, setFormData] = useState({
    origin: '',
    originState: '',
    originAddress: '',
    destination: '',
    destinationState: '',
    destinationAddress: '',
    weight: '',
    estimatedDelivery: '',
    pickupDate: ''
  })

  // Carregar empresas do localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const stored = localStorage.getItem('transporteja-clients')
    if (stored) {
      try {
        const clientsData = JSON.parse(stored)
        const companiesData: Company[] = clientsData.map((client: any) => ({
          id: client.id,
          companyName: client.companyName,
          responsible: client.responsible,
          phone: client.whatsapp || '',
          email: client.email,
          address: client.address,
          city: client.city,
          state: client.state
        }))
        setCompanies(companiesData)
      } catch (error) {
        console.error('Erro ao carregar empresas:', error)
      }
    }
  }, [])

  // Fechar dropdowns ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.dropdown-container')) {
        setShowDriverDropdown(false)
        setShowCompanyDropdown(false)
      }
    }

    if (showDriverDropdown || showCompanyDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDriverDropdown, showCompanyDropdown])

  const filteredRoutes = routes.filter(route => {
    return filterStatus === 'all' || route.status === filterStatus
  })

  const statusCounts = {
    all: routes.length,
    pending: routes.filter(r => r.status === 'pending').length,
    inTransit: routes.filter(r => r.status === 'inTransit').length,
    pickedUp: routes.filter(r => r.status === 'pickedUp').length,
    delivered: routes.filter(r => r.status === 'delivered').length
  }

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'inTransit':
        return {
          label: 'Em Trânsito',
          dotColor: 'bg-orange-500',
          bgColor: 'bg-orange-100',
          textColor: 'text-orange-700'
        }
      case 'delivered':
        return {
          label: 'Entregue',
          dotColor: 'bg-green-500',
          bgColor: 'bg-green-100',
          textColor: 'text-green-700'
        }
      case 'pickedUp':
        return {
          label: 'Coletado',
          dotColor: 'bg-gray-500',
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-700'
        }
      case 'pending':
        return {
          label: 'Pendente',
          dotColor: 'bg-yellow-500',
          bgColor: 'bg-yellow-100',
          textColor: 'text-yellow-700'
        }
      default:
        return {
          label: 'Desconhecido',
          dotColor: 'bg-gray-500',
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-700'
        }
    }
  }

  const handleViewMore = (route: RouteData) => {
    setSelectedRoute(route)
    setLinkCopied(false)
  }

  const handleCloseModal = () => {
    setSelectedRoute(null)
    setLinkCopied(false)
  }

  const getTrackingLink = (freightId: number) => {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/rastreio/driver?freight=${freightId}`
  }

  const handleCopyLink = () => {
    if (selectedRoute) {
      const link = getTrackingLink(selectedRoute.freightId)
      navigator.clipboard.writeText(link)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    }
  }

  const handleSendLink = () => {
    if (selectedRoute) {
      const link = getTrackingLink(selectedRoute.freightId)
      const message = `Olá ${selectedRoute.driver}! Segue o link de rastreio do frete #${selectedRoute.freightId}:\n\n${link}`
      const phoneNumber = selectedRoute.driverPhone.replace(/\D/g, '')
      const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`
      window.open(whatsappUrl, '_blank')
    }
  }

  const filteredDrivers = MOCK_DRIVERS.filter(driver =>
    driver.name.toLowerCase().includes(driverSearch.toLowerCase()) ||
    driver.plate.toLowerCase().includes(driverSearch.toLowerCase()) ||
    driver.vehicle.toLowerCase().includes(driverSearch.toLowerCase())
  )

  const filteredCompanies = companies.filter(company =>
    company.companyName.toLowerCase().includes(companySearch.toLowerCase()) ||
    company.responsible.toLowerCase().includes(companySearch.toLowerCase()) ||
    company.city.toLowerCase().includes(companySearch.toLowerCase())
  )

  const formatDateBR = (dateString: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    const day = date.getDate().toString().padStart(2, '0')
    const month = months[date.getMonth()]
    const year = date.getFullYear()
    return `${day} ${month}, ${year}`
  }

  const handleCreateRoute = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedDriver || !selectedCompany) {
      alert('Por favor, selecione um motorista e uma empresa')
      return
    }

    const newRoute: RouteData = {
      id: Date.now().toString(),
      freightId: Math.floor(100000000 + Math.random() * 900000000),
      driver: selectedDriver.name,
      driverCNH: `CNH: ${selectedDriver.cnh}`,
      driverPhone: selectedDriver.phone,
      origin: formData.origin,
      originState: formData.originState,
      originAddress: formData.originAddress,
      destination: formData.destination,
      destinationState: formData.destinationState,
      destinationAddress: formData.destinationAddress,
      vehicle: selectedDriver.vehicle,
      plate: selectedDriver.plate,
      weight: formData.weight,
      estimatedDelivery: formatDateBR(formData.estimatedDelivery),
      pickupDate: formatDateBR(formData.pickupDate),
      status: 'pending', // Todos os novos fretes começam como pendentes
      companyName: selectedCompany.companyName,
      companyResponsible: selectedCompany.responsible,
      companyPhone: selectedCompany.phone,
      companyEmail: selectedCompany.email,
      companyAddress: selectedCompany.address,
      companyCity: selectedCompany.city,
      companyState: selectedCompany.state
    }

    setRoutes([...routes, newRoute])
    setShowCreateModal(false)
    setSelectedDriver(null)
    setSelectedCompany(null)
    setDriverSearch('')
    setCompanySearch('')
    setFormData({
      origin: '',
      originState: '',
      originAddress: '',
      destination: '',
      destinationState: '',
      destinationAddress: '',
      weight: '',
      estimatedDelivery: '',
      pickupDate: ''
    })
  }

  const handleCloseCreateModal = () => {
    setShowCreateModal(false)
    setSelectedDriver(null)
    setSelectedCompany(null)
    setDriverSearch('')
    setCompanySearch('')
    setShowDriverDropdown(false)
    setShowCompanyDropdown(false)
    setFormData({
      origin: '',
      originState: '',
      originAddress: '',
      destination: '',
      destinationState: '',
      destinationAddress: '',
      weight: '',
      estimatedDelivery: '',
      pickupDate: ''
    })
  }

  return (
    <div className="space-y-6">
      {/* Header - Estilo Referência */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900">Fretes</h1>
          <span className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">
            {statusCounts.all}
          </span>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors flex items-center gap-2 font-medium"
        >
          <Plus className="w-5 h-5" />
          Criar Nova Rota
        </motion.button>
      </div>

      {/* Filtros de Status - Estilo Referência */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => setFilterStatus('pending')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
            filterStatus === 'pending'
              ? 'bg-gray-800 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Pendentes {statusCounts.pending}
        </button>
        <button
          onClick={() => setFilterStatus('inTransit')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
            filterStatus === 'inTransit'
              ? 'bg-gray-800 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Em Trânsito {statusCounts.inTransit}
        </button>
        <button
          onClick={() => setFilterStatus('pickedUp')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
            filterStatus === 'pickedUp'
              ? 'bg-gray-800 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Coletados {statusCounts.pickedUp}
        </button>
        <button
          onClick={() => setFilterStatus('delivered')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
            filterStatus === 'delivered'
              ? 'bg-gray-800 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Entregues {statusCounts.delivered}
        </button>
      </div>

      {/* Tabela - Estilo Referência Limpo */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  ID do Frete
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Atribuído a
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Rota
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Veículo
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Previsão de Entrega
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRoutes.map((route) => {
                const statusDisplay = getStatusDisplay(route.status)
                return (
                  <tr
                    key={route.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">
                        #{route.freightId}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm text-gray-900">{route.driver}</span>
                        <span className="text-xs text-gray-500 mt-1">{route.driverCNH}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-gray-600" />
                            <span className="text-sm text-gray-900">
                              {route.origin}, {route.originState}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <ArrowRight className="w-4 h-4 text-gray-400" />
                            <MapPin className="w-4 h-4 text-gray-600" />
                            <span className="text-sm text-gray-900">
                              {route.destination}, {route.destinationState}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm text-gray-900">{route.vehicle}</span>
                        <span className="text-xs text-gray-500 mt-1">{route.plate} • {route.weight}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm text-gray-900">{route.estimatedDelivery}</span>
                        <span className="text-xs text-gray-500 mt-1">Coletado: {route.pickupDate}</span>
                      </div>
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
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleViewMore(route)}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                      >
                        Ver mais
                      </motion.button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {filteredRoutes.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Route className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>Nenhum frete encontrado</p>
        </div>
      )}

      {/* Modal de Detalhes da Rota */}
      {selectedRoute && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-800 rounded-lg flex items-center justify-center">
                  <Truck className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Frete #{selectedRoute.freightId}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`w-2 h-2 rounded-full ${getStatusDisplay(selectedRoute.status).dotColor}`}></div>
                    <span className="text-sm text-gray-600">{getStatusDisplay(selectedRoute.status).label}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Informações do Motorista */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Motorista
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Nome</p>
                    <p className="text-sm font-medium text-gray-900">{selectedRoute.driver}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">CNH</p>
                    <p className="text-sm font-medium text-gray-900">{selectedRoute.driverCNH}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Telefone</p>
                    <p className="text-sm font-medium text-gray-900">{selectedRoute.driverPhone}</p>
                  </div>
                </div>
              </div>

              {/* Informações da Empresa */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Empresa
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Nome da Empresa</p>
                    <p className="text-sm font-medium text-gray-900">{selectedRoute.companyName}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Responsável</p>
                    <p className="text-sm font-medium text-gray-900">{selectedRoute.companyResponsible}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      Telefone
                    </p>
                    <p className="text-sm font-medium text-gray-900">{selectedRoute.companyPhone}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      E-mail
                    </p>
                    <p className="text-sm font-medium text-gray-900">{selectedRoute.companyEmail}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 md:col-span-2">
                    <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      Endereço
                    </p>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedRoute.companyAddress}, {selectedRoute.companyCity} - {selectedRoute.companyState}
                    </p>
                  </div>
                </div>
              </div>

              {/* Informações da Rota */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Route className="w-5 h-5" />
                  Rota
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Origem - Lado Esquerdo */}
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-blue-600 font-semibold mb-2 uppercase tracking-wide">De onde foi coletado</p>
                        <p className="text-sm font-bold text-gray-900 mb-1">
                          {selectedRoute.origin}, {selectedRoute.originState}
                        </p>
                        {selectedRoute.originAddress && (
                          <p className="text-xs text-gray-600 mt-1">
                            {selectedRoute.originAddress}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Destino - Lado Direito */}
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-green-600 font-semibold mb-2 uppercase tracking-wide">Lugar de entrega</p>
                        <p className="text-sm font-bold text-gray-900 mb-1">
                          {selectedRoute.destination}, {selectedRoute.destinationState}
                        </p>
                        {selectedRoute.destinationAddress && (
                          <p className="text-xs text-gray-600 mt-1">
                            {selectedRoute.destinationAddress}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Informações do Veículo */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Truck className="w-5 h-5" />
                  Veículo
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Modelo</p>
                    <p className="text-sm font-medium text-gray-900">{selectedRoute.vehicle}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Placa</p>
                    <p className="text-sm font-medium text-gray-900">{selectedRoute.plate}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Peso</p>
                    <p className="text-sm font-medium text-gray-900">{selectedRoute.weight}</p>
                  </div>
                </div>
              </div>

              {/* Informações de Datas */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Datas
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Data de Coleta</p>
                    <p className="text-sm font-medium text-gray-900">{selectedRoute.pickupDate}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Previsão de Entrega</p>
                    <p className="text-sm font-medium text-gray-900">{selectedRoute.estimatedDelivery}</p>
                  </div>
                </div>
              </div>

              {/* Link de Rastreio */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Link de Rastreio
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={getTrackingLink(selectedRoute.freightId)}
                      className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none"
                    />
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleCopyLink}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors flex items-center gap-2"
                    >
                      {linkCopied ? (
                        <>
                          <Check className="w-4 h-4 text-green-600" />
                          <span className="text-sm">Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span className="text-sm">Copiar</span>
                        </>
                      )}
                    </motion.button>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSendLink}
                    className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <Send className="w-5 h-5" />
                    Enviar Link via WhatsApp
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal de Criar Nova Rota */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-800 rounded-lg flex items-center justify-center">
                  <Plus className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Criar Nova Rota</h2>
              </div>
              <button
                onClick={handleCloseCreateModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <form onSubmit={handleCreateRoute} className="p-6 space-y-6">
              {/* Seleção de Motorista */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Motorista <span className="text-red-500">*</span>
                </label>
                <div className="relative dropdown-container">
                  <div
                    onClick={() => {
                      setShowDriverDropdown(!showDriverDropdown)
                      setShowCompanyDropdown(false)
                    }}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg cursor-pointer flex items-center justify-between hover:border-gray-400 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {selectedDriver ? (
                        <div className="flex items-center gap-2">
                          <User className="w-5 h-5 text-gray-600" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{selectedDriver.name}</p>
                            <p className="text-xs text-gray-500">{selectedDriver.vehicle} • {selectedDriver.plate}</p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-500">Selecione um motorista</span>
                      )}
                    </div>
                    <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showDriverDropdown ? 'rotate-180' : ''}`} />
                  </div>
                  
                  {showDriverDropdown && (
                    <div className="absolute z-20 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      <div className="p-2 border-b border-gray-200 sticky top-0 bg-white">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                          <input
                            type="text"
                            placeholder="Buscar motorista..."
                            value={driverSearch}
                            onChange={(e) => setDriverSearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                          />
                        </div>
                      </div>
                      <div className="p-2">
                        {filteredDrivers.length > 0 ? (
                          filteredDrivers.map((driver) => (
                            <div
                              key={driver.id}
                              onClick={() => {
                                setSelectedDriver(driver)
                                setShowDriverDropdown(false)
                                setDriverSearch('')
                              }}
                              className="p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <User className="w-5 h-5 text-gray-600" />
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-gray-900">{driver.name}</p>
                                  <p className="text-xs text-gray-500">{driver.vehicle} • {driver.plate}</p>
                                  <p className="text-xs text-gray-400">CNH: {driver.cnh}</p>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="p-3 text-sm text-gray-500 text-center">Nenhum motorista encontrado</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Seleção de Empresa */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Empresa <span className="text-red-500">*</span>
                </label>
                <div className="relative dropdown-container">
                  <div
                    onClick={() => {
                      setShowCompanyDropdown(!showCompanyDropdown)
                      setShowDriverDropdown(false)
                    }}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg cursor-pointer flex items-center justify-between hover:border-gray-400 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {selectedCompany ? (
                        <div className="flex items-center gap-2">
                          <Building2 className="w-5 h-5 text-gray-600" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{selectedCompany.companyName}</p>
                            <p className="text-xs text-gray-500">{selectedCompany.responsible}</p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-500">Selecione uma empresa</span>
                      )}
                    </div>
                    <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showCompanyDropdown ? 'rotate-180' : ''}`} />
                  </div>
                  
                  {showCompanyDropdown && (
                    <div className="absolute z-20 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      <div className="p-2 border-b border-gray-200 sticky top-0 bg-white">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                          <input
                            type="text"
                            placeholder="Buscar empresa..."
                            value={companySearch}
                            onChange={(e) => setCompanySearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                          />
                        </div>
                      </div>
                      <div className="p-2">
                        {filteredCompanies.length > 0 ? (
                          filteredCompanies.map((company) => (
                            <div
                              key={company.id}
                              onClick={() => {
                                setSelectedCompany(company)
                                setShowCompanyDropdown(false)
                                setCompanySearch('')
                              }}
                              className="p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <Building2 className="w-5 h-5 text-gray-600" />
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-gray-900">{company.companyName}</p>
                                  <p className="text-xs text-gray-500">{company.responsible}</p>
                                  <p className="text-xs text-gray-400">{company.city} - {company.state}</p>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="p-3 text-sm text-gray-500 text-center">
                            {companies.length === 0 ? 'Nenhuma empresa cadastrada. Cadastre em "Clientes"' : 'Nenhuma empresa encontrada'}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Origem */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Cidade de Origem <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.origin}
                    onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                    placeholder="Ex: São Paulo"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Estado <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={2}
                    value={formData.originState}
                    onChange={(e) => setFormData({ ...formData, originState: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                    placeholder="SP"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Endereço de Origem
                </label>
                <input
                  type="text"
                  value={formData.originAddress}
                  onChange={(e) => setFormData({ ...formData, originAddress: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                  placeholder="Ex: Rua das Flores, 123 - Centro"
                />
              </div>

              {/* Destino */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Cidade de Destino <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.destination}
                    onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                    placeholder="Ex: Curitiba"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Estado <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={2}
                    value={formData.destinationState}
                    onChange={(e) => setFormData({ ...formData, destinationState: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                    placeholder="PR"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Endereço de Destino
                </label>
                <input
                  type="text"
                  value={formData.destinationAddress}
                  onChange={(e) => setFormData({ ...formData, destinationAddress: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                  placeholder="Ex: Av. Principal, 456 - Batel"
                />
              </div>

              {/* Outras Informações */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Peso <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                    placeholder="Ex: 15.500 kg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Data de Coleta <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.pickupDate}
                    onChange={(e) => setFormData({ ...formData, pickupDate: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Previsão de Entrega <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.estimatedDelivery}
                    onChange={(e) => setFormData({ ...formData, estimatedDelivery: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                  />
                </div>
              </div>

              {/* Botões */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleCloseCreateModal}
                  className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors font-medium"
                >
                  Criar Rota
                </motion.button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  )
}
