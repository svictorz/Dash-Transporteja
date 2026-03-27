'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Truck, Phone, Mail, MapPin, Search, Clock, Plus, Edit, Trash2, Loader2, X, AlertCircle } from 'lucide-react'
import { useDrivers } from '@/lib/hooks/useDrivers'
import { Driver, CreateDriverData, UpdateDriverData } from '@/lib/services/drivers'
import { validateName, validatePhone, validateEmail, validateCNH, validatePlate } from '@/lib/utils/validation'
import { supabase } from '@/lib/supabase/client'
import { canAccessMotoristasPage } from '@/lib/utils/roles'

export default function MotoristasPage() {
  const router = useRouter()
  const { drivers, loading, error, createDriver, updateDriver, deleteDriver } = useDrivers()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'onRoute'>('all')
  const [showModal, setShowModal] = useState(false)
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  
  const [formData, setFormData] = useState<CreateDriverData>({
    name: '',
    phone: '',
    email: '',
    cnh: '',
    vehicle: '',
    plate: '',
    status: 'active'
  })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user || cancelled) return
      const { data: row } = await supabase.from('users').select('role').eq('id', session.user.id).single()
      if (cancelled) return
      if (!canAccessMotoristasPage(row?.role as string | undefined)) {
        router.replace('/dashboard')
      }
    })()
    return () => { cancelled = true }
  }, [router])

  const filteredDrivers = useMemo(() => {
    return drivers.filter(driver => {
      const matchesSearch =
        driver.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        driver.phone.includes(searchTerm) ||
        driver.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
        driver.vehicle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        driver.email.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesFilter = filterStatus === 'all' || driver.status === filterStatus
      
      return matchesSearch && matchesFilter
    })
  }, [drivers, searchTerm, filterStatus])

  const statusCounts = useMemo(() => ({
    all: drivers.length,
    active: drivers.filter(d => d.status === 'active').length,
    inactive: drivers.filter(d => d.status === 'inactive').length,
    onRoute: drivers.filter(d => d.status === 'onRoute').length
  }), [drivers])

  const handleOpenModal = (driver?: Driver) => {
    if (driver) {
      setEditingDriver(driver)
      setFormData({
        name: driver.name,
        phone: driver.phone,
        email: driver.email,
        cnh: driver.cnh,
        vehicle: driver.vehicle,
        plate: driver.plate,
        status: driver.status
      })
    } else {
      setEditingDriver(null)
      setFormData({
        name: '',
        phone: '',
        email: '',
        cnh: '',
        vehicle: '',
        plate: '',
        status: 'active'
      })
    }
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingDriver(null)
    setFormData({
      name: '',
      phone: '',
      email: '',
      cnh: '',
      vehicle: '',
      plate: '',
      status: 'active'
    })
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    // Validar nome
    const nameValidation = validateName(formData.name)
    if (!nameValidation.valid) {
      errors.name = nameValidation.error || 'Nome inválido'
    }

    // Validar telefone
    const phoneValidation = validatePhone(formData.phone)
    if (!phoneValidation.valid) {
      errors.phone = phoneValidation.error || 'Telefone inválido'
    }

    // Validar email
    const emailValidation = validateEmail(formData.email)
    if (!emailValidation.valid) {
      errors.email = emailValidation.error || 'Email inválido'
    }

    // Validar CNH
    const cnhValidation = validateCNH(formData.cnh)
    if (!cnhValidation.valid) {
      errors.cnh = cnhValidation.error || 'CNH inválida'
    }

    // Validar placa
    const plateValidation = validatePlate(formData.plate)
    if (!plateValidation.valid) {
      errors.plate = plateValidation.error || 'Placa inválida'
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validar formulário
    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      // Aplicar formatações
      const nameValidation = validateName(formData.name)
      const phoneValidation = validatePhone(formData.phone)
      const plateValidation = validatePlate(formData.plate)

      const formattedData: CreateDriverData = {
        ...formData,
        name: nameValidation.formatted || formData.name,
        phone: phoneValidation.formatted || formData.phone,
        plate: plateValidation.formatted || formData.plate
      }

      if (editingDriver) {
        await updateDriver(editingDriver.id, formattedData)
      } else {
        await createDriver(formattedData)
      }
      handleCloseModal()
      setValidationErrors({})
    } catch (err: any) {
      alert(`Erro: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFieldChange = (field: keyof CreateDriverData, value: string) => {
    setFormData({ ...formData, [field]: value })
    
    // Limpar erro do campo quando o usuário começar a digitar
    if (validationErrors[field]) {
      setValidationErrors({ ...validationErrors, [field]: '' })
    }

    // Validação em tempo real
    let validation: { valid: boolean; error?: string; formatted?: string } = { valid: true }
    
    switch (field) {
      case 'name':
        validation = validateName(value)
        break
      case 'phone':
        validation = validatePhone(value)
        if (validation.valid && validation.formatted) {
          setFormData({ ...formData, phone: validation.formatted })
        }
        break
      case 'email':
        validation = validateEmail(value)
        break
      case 'cnh':
        validation = validateCNH(value)
        break
      case 'plate':
        validation = validatePlate(value.toUpperCase())
        if (validation.valid && validation.formatted) {
          setFormData({ ...formData, plate: validation.formatted })
        }
        break
    }

    if (!validation.valid) {
      setValidationErrors({ ...validationErrors, [field]: validation.error || '' })
    } else {
      const newErrors = { ...validationErrors }
      delete newErrors[field]
      setValidationErrors(newErrors)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este motorista?')) return
    
    try {
      await deleteDriver(id)
      setShowDeleteConfirm(null)
    } catch (err: any) {
      alert(`Erro ao excluir: ${err.message}`)
    }
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900">Motoristas</h1>
          <span className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">
            {statusCounts.all}
          </span>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors font-medium flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Novo Motorista
        </button>
      </div>

      {/* Erro */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

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

      {/* Loading */}
      {loading && (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
          <p className="text-gray-500 mt-2">Carregando motoristas...</p>
        </div>
      )}

      {/* Tabela */}
      {!loading && (
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
                    Ações
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
                          <span className="text-xs text-gray-500 mt-1">CNH: {driver.cnh || 'Não informada'}</span>
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
                        {driver.last_checkin ? (
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-900">{formatDate(driver.last_checkin)}</span>
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
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenModal(driver)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(driver.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && filteredDrivers.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Truck className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>Nenhum motorista encontrado</p>
          <button
            onClick={() => handleOpenModal()}
            className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors font-medium"
          >
            Criar primeiro motorista
          </button>
        </div>
      )}

      {/* Modal de Criar/Editar */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {editingDriver ? 'Editar Motorista' : 'Novo Motorista'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      validationErrors.name
                        ? 'border-red-300 focus:ring-red-500'
                        : 'border-gray-300 focus:ring-slate-800'
                    }`}
                  />
                  {validationErrors.name && (
                    <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {validationErrors.name}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    CNH *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.cnh}
                    onChange={(e) => handleFieldChange('cnh', e.target.value.replace(/\D/g, ''))}
                    maxLength={11}
                    placeholder="00000000000"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      validationErrors.cnh
                        ? 'border-red-300 focus:ring-red-500'
                        : 'border-gray-300 focus:ring-slate-800'
                    }`}
                  />
                  {validationErrors.cnh && (
                    <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {validationErrors.cnh}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Telefone *
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => handleFieldChange('phone', e.target.value)}
                    placeholder="(11) 99999-9999"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      validationErrors.phone
                        ? 'border-red-300 focus:ring-red-500'
                        : 'border-gray-300 focus:ring-slate-800'
                    }`}
                  />
                  {validationErrors.phone && (
                    <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {validationErrors.phone}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => handleFieldChange('email', e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      validationErrors.email
                        ? 'border-red-300 focus:ring-red-500'
                        : 'border-gray-300 focus:ring-slate-800'
                    }`}
                  />
                  {validationErrors.email && (
                    <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {validationErrors.email}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Veículo *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.vehicle}
                    onChange={(e) => setFormData({ ...formData, vehicle: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Placa *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.plate}
                    onChange={(e) => handleFieldChange('plate', e.target.value.toUpperCase())}
                    placeholder="ABC-1234 ou ABC1D23"
                    maxLength={8}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      validationErrors.plate
                        ? 'border-red-300 focus:ring-red-500'
                        : 'border-gray-300 focus:ring-slate-800'
                    }`}
                  />
                  {validationErrors.plate && (
                    <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {validationErrors.plate}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status *
                  </label>
                  <select
                    required
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                  >
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                    <option value="onRoute">Em Rota</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    editingDriver ? 'Salvar Alterações' : 'Criar Motorista'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
