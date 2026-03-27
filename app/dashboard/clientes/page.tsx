'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import FadeIn from '@/components/animations/FadeIn'
import { Users, Plus, Search, Mail, Phone, MapPin, Building2, X, Edit, Trash2, Loader2, AlertCircle } from 'lucide-react'
import { useClients } from '@/lib/hooks/useClients'
import { Client } from '@/lib/services/clients'
import { validateName, validatePhone, validateEmail, validateCNPJ, validateCompanyName } from '@/lib/utils/validation'
import CEPInput from '@/components/transporteja/CEPInput'
import { CEPData } from '@/lib/services/cep'
import { searchCNPJ } from '@/lib/services/cnpj'

export default function ClientesPage() {
  const { clients, loading, error, createClient, updateClient, deleteClient } = useClients()
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [cnpjLoading, setCnpjLoading] = useState(false)
  const [cnpjSearchError, setCnpjSearchError] = useState<string | null>(null)
  const [cep, setCep] = useState('')
  const [formData, setFormData] = useState({
    companyName: '',
    cnpj: '',
    responsible: '',
    whatsapp: '',
    email: '',
    address: '',
    extension: '',
    city: '',
    neighborhood: '',
    state: ''
  })

  // Filtrar clientes baseado na busca
  const filteredClients = useMemo(() => {
    if (!searchTerm) return clients

    const searchLower = searchTerm.toLowerCase()
    return clients.filter(client =>
      client.company_name.toLowerCase().includes(searchLower) ||
      client.responsible.toLowerCase().includes(searchLower) ||
      client.email.toLowerCase().includes(searchLower) ||
      client.whatsapp.includes(searchTerm) ||
      client.city.toLowerCase().includes(searchLower) ||
      client.state.toLowerCase().includes(searchLower)
    )
  }, [searchTerm, clients])

  const handleOpenModal = (client?: Client) => {
    if (client) {
      setEditingClient(client)
      setFormData({
        companyName: client.company_name,
        cnpj: client.cnpj || '',
        responsible: client.responsible,
        whatsapp: client.whatsapp,
        email: client.email,
        address: client.address,
        extension: client.extension || '',
        city: client.city,
        neighborhood: client.neighborhood,
        state: client.state
      })
    } else {
      setEditingClient(null)
      setFormData({
        companyName: '',
        cnpj: '',
        responsible: '',
        whatsapp: '',
        email: '',
        address: '',
        extension: '',
        city: '',
        neighborhood: '',
        state: ''
      })
    }
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingClient(null)
    setCep('')
    setValidationErrors({})
    setFormData({
      companyName: '',
      cnpj: '',
      responsible: '',
      whatsapp: '',
      email: '',
      address: '',
      extension: '',
      city: '',
      neighborhood: '',
      state: ''
    })
  }

  const handleCEPFound = (data: CEPData) => {
    setFormData({
      ...formData,
      address: data.logradouro || formData.address,
      neighborhood: data.bairro || formData.neighborhood,
      city: data.localidade || formData.city,
      state: data.uf || formData.state
    })
  }

  const handleSearchCNPJ = async () => {
    const raw = formData.cnpj.replace(/\D/g, '')
    if (raw.length !== 14) {
      setValidationErrors((e) => ({ ...e, cnpj: 'Digite um CNPJ com 14 dígitos para buscar' }))
      return
    }
    const cnpjCheck = validateCNPJ(raw)
    if (!cnpjCheck.valid) {
      setValidationErrors((e) => ({ ...e, cnpj: cnpjCheck.error ?? 'CNPJ inválido' }))
      return
    }
    setCnpjSearchError(null)
    setCnpjLoading(true)
    try {
      const result = await searchCNPJ(raw)
      if (!result.success) {
        setCnpjSearchError(result.error)
        return
      }
      const d = result.data
      setFormData({
        companyName: d.companyName,
        cnpj: d.cnpj,
        address: d.address,
        neighborhood: d.neighborhood,
        city: d.city,
        state: d.state,
        responsible: formData.responsible,
        whatsapp: d.phone ?? formData.whatsapp,
        email: d.email ?? formData.email,
        extension: formData.extension
      })
      setCep(d.cep.replace(/\D/g, ''))
      setValidationErrors((e) => {
        const next = { ...e }
        delete next.cnpj
        delete next.companyName
        return next
      })
    } finally {
      setCnpjLoading(false)
    }
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    // Validar nome da empresa
    const companyValidation = validateCompanyName(formData.companyName)
    if (!companyValidation.valid) {
      errors.companyName = companyValidation.error ?? 'Nome da empresa é obrigatório'
    }

    // Validar CNPJ
    const cnpjValidation = validateCNPJ(formData.cnpj)
    if (!cnpjValidation.valid) {
      errors.cnpj = cnpjValidation.error || 'CNPJ inválido'
    }

    // Validar responsável
    const responsibleValidation = validateName(formData.responsible)
    if (!responsibleValidation.valid) {
      errors.responsible = responsibleValidation.error || 'Nome inválido'
    }

    // Validar WhatsApp
    const whatsappValidation = validatePhone(formData.whatsapp)
    if (!whatsappValidation.valid) {
      errors.whatsapp = whatsappValidation.error || 'Telefone inválido'
    }

    // Validar email
    const emailValidation = validateEmail(formData.email)
    if (!emailValidation.valid) {
      errors.email = emailValidation.error || 'Email inválido'
    }

    // Validar CEP
    if (!cep || cep.length !== 8) {
      errors.cep = 'CEP é obrigatório e deve ter 8 dígitos'
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
      const responsibleValidation = validateName(formData.responsible)
      const whatsappValidation = validatePhone(formData.whatsapp)
      const cnpjValidation = validateCNPJ(formData.cnpj)

      const formattedData = {
        company_name: formData.companyName.trim(),
        cnpj: cnpjValidation.formatted || formData.cnpj.replace(/\D/g, ''),
        responsible: responsibleValidation.formatted || formData.responsible,
        whatsapp: whatsappValidation.formatted || formData.whatsapp,
        email: formData.email.trim().toLowerCase(),
        address: formData.address.trim(),
        extension: formData.extension.trim() || null,
        city: formData.city.trim(),
        neighborhood: formData.neighborhood.trim(),
        state: formData.state.trim().toUpperCase()
      }
      if (editingClient) {
        await updateClient(editingClient.id, formattedData)
      } else {
        await createClient({ ...formattedData, extension: formattedData.extension ?? undefined })
      }

      handleCloseModal()
      setValidationErrors({})
    } catch (err: any) {
      alert(`Erro ao ${editingClient ? 'atualizar' : 'criar'} cliente: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFieldChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value })
    
    // Limpar erro do campo quando o usuário começar a digitar
    if (validationErrors[field]) {
      setValidationErrors({ ...validationErrors, [field]: '' })
    }

    // Validação em tempo real apenas para alguns campos
    // CNPJ será validado apenas no submit para não bloquear a digitação
    if (field === 'cnpj') {
      // Não valida durante a digitação, apenas limpa o erro
      return
    }

    // Validação em tempo real para outros campos
    let validation: { valid: boolean; error?: string; formatted?: string } = { valid: true }
    
    switch (field) {
      case 'responsible':
        validation = validateName(value)
        break
      case 'whatsapp':
        validation = validatePhone(value)
        if (validation.valid && validation.formatted) {
          setFormData({ ...formData, whatsapp: validation.formatted })
        }
        break
      case 'email':
        validation = validateEmail(value)
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
    if (!confirm('Tem certeza que deseja excluir este cliente?')) return

    try {
      await deleteClient(id)
    } catch (err: any) {
      alert(`Erro ao excluir cliente: ${err.message}`)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn delay={0.1}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900">Clientes</h1>
            <span className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">
              {filteredClients.length}
            </span>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors font-medium flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Adicionar Cliente
          </motion.button>
        </div>
      </FadeIn>

      {/* Busca */}
      <FadeIn delay={0.15}>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por empresa, responsável, email ou cidade..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent"
            />
          </div>
        </div>
      </FadeIn>

      {/* Erro */}
      {error && (
        <FadeIn delay={0.15}>
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </FadeIn>
      )}

      {/* Tabela de Clientes */}
      <FadeIn delay={0.2}>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
              <p className="text-gray-500 mt-2">Carregando clientes...</p>
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="mb-2">
                {searchTerm ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
              </p>
              {!searchTerm && (
                <button
                  onClick={() => handleOpenModal()}
                  className="text-sm text-slate-800 hover:text-slate-600 font-medium"
                >
                  Adicionar primeiro cliente
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Empresa
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      CNPJ
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Responsável
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Contato
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Localização
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredClients.map((client) => (
                    <tr
                      key={client.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-900">{client.company_name}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">{client.cnpj || 'Não informado'}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-900">{client.responsible}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-900">{client.whatsapp}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-900">{client.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-900">{client.city}, {client.state}</span>
                          </div>
                          <span className="text-xs text-gray-500">{client.neighborhood}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenModal(client)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(client.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </FadeIn>

      {/* Modal de Adicionar/Editar Cliente */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingClient ? 'Editar Cliente' : 'Adicionar Novo Cliente'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* CEP - Primeiro campo para iniciar pelo endereço */}
                <div className="md:col-span-2">
                  <CEPInput
                    value={cep}
                    onChange={setCep}
                    onCEPFound={handleCEPFound}
                    error={validationErrors.cep}
                    required
                    label="CEP * (Comece digitando o CEP para preencher o endereço automaticamente)"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Endereço da Empresa *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent"
                    placeholder="Rua, número, complemento (preenchido automaticamente ao buscar CEP)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bairro *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.neighborhood}
                    onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent"
                    placeholder="Bairro (preenchido automaticamente)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cidade *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent"
                    placeholder="Cidade (preenchida automaticamente)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estado *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent"
                    placeholder="Estado (ex: SP) - preenchido automaticamente"
                    maxLength={2}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome da Empresa *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent"
                    placeholder="Nome da empresa"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CNPJ * (digite e clique em &quot;Buscar&quot; para preencher dados da empresa)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={formData.cnpj}
                      onChange={(e) => {
                        const cleanValue = e.target.value.replace(/\D/g, '').slice(0, 14)
                        handleFieldChange('cnpj', cleanValue)
                        setCnpjSearchError(null)
                      }}
                      onBlur={(e) => {
                        const cleanValue = e.target.value.replace(/\D/g, '')
                        if (cleanValue.length === 14) {
                          const validation = validateCNPJ(cleanValue)
                          if (validation.valid && validation.formatted) {
                            setFormData((prev) => ({ ...prev, cnpj: validation.formatted! }))
                          }
                        }
                      }}
                      maxLength={18}
                      placeholder="00.000.000/0000-00"
                      className={`flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                        validationErrors.cnpj
                          ? 'border-red-300 focus:ring-red-500'
                          : 'border-gray-300 focus:ring-slate-800'
                      }`}
                    />
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleSearchCNPJ}
                      disabled={cnpjLoading || formData.cnpj.replace(/\D/g, '').length !== 14}
                      className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium whitespace-nowrap flex items-center gap-2"
                    >
                      {cnpjLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Buscando...
                        </>
                      ) : (
                        'Buscar por CNPJ'
                      )}
                    </motion.button>
                  </div>
                  {cnpjSearchError && (
                    <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {cnpjSearchError}
                    </p>
                  )}
                  {validationErrors.cnpj && !cnpjSearchError && (
                    <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {validationErrors.cnpj}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Responsável *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.responsible}
                    onChange={(e) => handleFieldChange('responsible', e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      validationErrors.responsible
                        ? 'border-red-300 focus:ring-red-500'
                        : 'border-gray-300 focus:ring-slate-800'
                    }`}
                    placeholder="Nome completo do responsável"
                  />
                  {validationErrors.responsible && (
                    <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {validationErrors.responsible}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    WhatsApp *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.whatsapp}
                    onChange={(e) => handleFieldChange('whatsapp', e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      validationErrors.whatsapp
                        ? 'border-red-300 focus:ring-red-500'
                        : 'border-gray-300 focus:ring-slate-800'
                    }`}
                    placeholder="(00) 00000-0000"
                  />
                  {validationErrors.whatsapp && (
                    <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {validationErrors.whatsapp}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
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
                    placeholder="email@empresa.com"
                  />
                  {validationErrors.email && (
                    <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {validationErrors.email}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ramal
                  </label>
                  <input
                    type="text"
                    value={formData.extension}
                    onChange={(e) => setFormData({ ...formData, extension: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent"
                    placeholder="Ramal (opcional)"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {editingClient ? 'Salvando...' : 'Criando...'}
                    </>
                  ) : (
                    editingClient ? 'Salvar Alterações' : 'Adicionar Cliente'
                  )}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  )
}

