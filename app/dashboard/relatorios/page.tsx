'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import FadeIn from '@/components/animations/FadeIn'
import { FileText, Calendar, Download, Building2, Plus, X, ChevronDown } from 'lucide-react'
import { useClients } from '@/lib/hooks/useClients'

export default function RelatoriosPage() {
  const { clients } = useClients()
  
  const [reportType, setReportType] = useState<'general' | 'company' | null>(null)
  const [showTypeOptions, setShowTypeOptions] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedCompany, setSelectedCompany] = useState<string>('')
  const [quickPeriod, setQuickPeriod] = useState<string>('')
  const [showPeriodOptions, setShowPeriodOptions] = useState(false)

  const companies = clients.map(client => ({
    id: client.id,
    name: client.company_name
  }))

  const getQuickPeriodDates = (period: string) => {
    const today = new Date()
    const start = new Date()
    const end = new Date(today)

    switch (period) {
      case '7':
        start.setDate(today.getDate() - 7)
        break
      case '15':
        start.setDate(today.getDate() - 15)
        break
      case '30':
        start.setDate(today.getDate() - 30)
        break
      case 'thisMonth':
        start.setDate(1)
        break
      case 'all':
        start.setFullYear(2020, 0, 1) // Data inicial do sistema
        break
      default:
        return { start: '', end: '' }
    }

    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    }
  }

  const handleQuickPeriod = (period: string) => {
    setQuickPeriod(period)
    if (period === 'custom') {
      setStartDate('')
      setEndDate('')
    } else {
      const dates = getQuickPeriodDates(period)
      setStartDate(dates.start)
      setEndDate(dates.end)
    }
  }

  const handleGenerateReport = () => {
    if (!reportType) {
      alert('Por favor, selecione um tipo de relatório')
      return
    }

    if (quickPeriod !== 'custom' && !startDate && !endDate) {
      alert('Por favor, selecione um período')
      return
    }

    if (quickPeriod === 'custom' && (!startDate || !endDate)) {
      alert('Por favor, selecione o período personalizado')
      return
    }

    if (reportType === 'company' && !selectedCompany) {
      alert('Por favor, selecione uma empresa')
      return
    }

    // Simular geração de relatório
    const report = {
      type: reportType,
      period: quickPeriod === 'custom' ? `${startDate} até ${endDate}` : getPeriodLabel(quickPeriod),
      company: reportType === 'company' ? companies.find(c => c.id === selectedCompany)?.name : null,
      data: {
        totalRoutes: 45,
        completedRoutes: 42,
        pendingRoutes: 3,
        averageDeliveryTime: '4h 32m',
        successRate: '93.3%'
      }
    }

    // Simular download do relatório
    handleDownloadReport(report)
  }

  const getPeriodLabel = (period: string) => {
    switch (period) {
      case '7': return 'Últimos 7 dias'
      case '15': return 'Últimos 15 dias'
      case '30': return 'Últimos 30 dias'
      case 'thisMonth': return 'Este Mês'
      case 'all': return 'Todo o Período'
      default: return 'Período Personalizado'
    }
  }

  const handleDownloadReport = (report?: any) => {
    const reportData = report || {
      type: reportType,
      period: quickPeriod === 'custom' ? `${startDate} até ${endDate}` : getPeriodLabel(quickPeriod),
      company: reportType === 'company' ? companies.find(c => c.id === selectedCompany)?.name : null,
      data: {
        totalRoutes: 45,
        completedRoutes: 42,
        pendingRoutes: 3,
        averageDeliveryTime: '4h 32m',
        successRate: '93.3%'
      }
    }
    
    const reportContent = `
RELATÓRIO DE ${reportData.type === 'company' ? 'EMPRESA' : 'GERAL'}

Período: ${reportData.period}
${reportData.company ? `Empresa: ${reportData.company}` : ''}

Total de Rotas: ${reportData.data.totalRoutes}
Rotas Concluídas: ${reportData.data.completedRoutes}
Rotas Pendentes: ${reportData.data.pendingRoutes}
Tempo Médio de Entrega: ${reportData.data.averageDeliveryTime}
Taxa de Sucesso: ${reportData.data.successRate}
    `
    
    const blob = new Blob([reportContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `relatorio-${reportData.type}-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleClearFilters = () => {
    setStartDate('')
    setEndDate('')
    setSelectedCompany('')
    setReportType(null)
    setQuickPeriod('')
    setShowTypeOptions(false)
    setShowPeriodOptions(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowTypeOptions(!showTypeOptions)}
              className={`w-14 h-14 rounded-xl border-2 transition-all flex items-center justify-center ${
                reportType
                  ? 'border-slate-800 bg-slate-800 text-white'
                  : 'border-gray-200 bg-white/50 text-gray-700 hover:border-gray-300'
              }`}
            >
              {reportType === 'general' && <FileText className="w-6 h-6" />}
              {reportType === 'company' && <Building2 className="w-6 h-6" />}
              {!reportType && <Plus className="w-6 h-6" />}
            </motion.button>

            <AnimatePresence>
              {showTypeOptions && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute z-10 left-0 w-64 mt-2 glass-card rounded-xl border border-white/30 shadow-lg overflow-hidden"
                >
                  <div className="p-2 space-y-1">
                    <button
                      onClick={() => {
                        setReportType('general')
                        setShowTypeOptions(false)
                        setSelectedCompany('')
                      }}
                      className="w-full p-3 rounded-lg hover:bg-white/50 transition-colors flex items-center gap-3 text-left"
                    >
                      <FileText className="w-5 h-5 text-gray-600" />
                      <span className="font-medium text-gray-900">Relatório Geral</span>
                    </button>
                    <button
                      onClick={() => {
                        setReportType('company')
                        setShowTypeOptions(false)
                      }}
                      className="w-full p-3 rounded-lg hover:bg-white/50 transition-colors flex items-center gap-3 text-left"
                    >
                      <Building2 className="w-5 h-5 text-blue-600" />
                      <span className="font-medium text-gray-900">Relatório por Empresa</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
        </div>

        {/* Dropdown de Período - Minimalista - Lado Direito */}
        <div className="relative">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setShowPeriodOptions(!showPeriodOptions)
              setShowTypeOptions(false)
            }}
            className={`px-3 py-2 rounded-lg border transition-all flex items-center gap-2 text-xs font-medium ${
              quickPeriod
                ? 'border-slate-800 bg-slate-800 text-white'
                : 'border-gray-200 bg-white/50 text-gray-700 hover:border-gray-300'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span className="whitespace-nowrap">
              {quickPeriod ? getPeriodLabel(quickPeriod) : 'Período'}
            </span>
            <ChevronDown className={`w-3 h-3 transition-transform ${showPeriodOptions ? 'rotate-180' : ''}`} />
          </motion.button>

          <AnimatePresence>
            {showPeriodOptions && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute z-10 right-0 w-48 mt-2 glass-card rounded-lg border border-white/30 shadow-lg overflow-hidden"
              >
                <div className="p-1 space-y-0.5">
                  {[
                    { value: '7', label: '7 dias' },
                    { value: '15', label: '15 dias' },
                    { value: '30', label: '30 dias' },
                    { value: 'thisMonth', label: 'Este Mês' },
                    { value: 'custom', label: 'Personalizado' },
                    { value: 'all', label: 'Todo Período' }
                  ].map((period) => (
                    <button
                      key={period.value}
                      onClick={() => {
                        handleQuickPeriod(period.value)
                        setShowPeriodOptions(false)
                      }}
                      className={`w-full px-3 py-2 rounded-md hover:bg-white/50 transition-colors text-left text-xs ${
                        quickPeriod === period.value ? 'bg-slate-100 font-medium' : 'text-gray-700'
                      }`}
                    >
                      {period.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        <FadeIn delay={0.1}>
          <div className="glass-card rounded-2xl p-8 border border-white/30 space-y-8">
            {/* Campos de Data Personalizada */}
              {quickPeriod === 'custom' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4"
                >
                  <div>
                    <label className="block text-xs text-gray-600 mb-2">Data Inicial</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 glass-card border border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-800"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-2">Data Final</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        min={startDate}
                        className="w-full pl-10 pr-4 py-3 glass-card border border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-800"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

            {/* Mostrar período selecionado */}
            {quickPeriod && quickPeriod !== 'custom' && startDate && endDate && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 glass-card rounded-xl border border-white/30"
              >
                <p className="text-xs text-gray-500">
                  {getPeriodLabel(quickPeriod)}
                </p>
                <p className="text-sm font-semibold text-gray-900 mt-1">
                  {new Date(startDate).toLocaleDateString('pt-BR')} até {new Date(endDate).toLocaleDateString('pt-BR')}
                </p>
              </motion.div>
            )}

            {/* Filtro de Empresa */}
            {reportType === 'company' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  Empresa
                </label>
                <select
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  className="w-full px-4 py-3 glass-card border border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-800"
                >
                  <option value="">Selecione uma empresa</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </motion.div>
            )}

            {/* Botões de Ação */}
            <div className="flex items-center gap-3 pt-4 border-t border-white/20">
              {(reportType || quickPeriod || selectedCompany) && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleClearFilters}
                  className="px-6 py-3 glass-card text-gray-700 rounded-xl hover:bg-white/70 transition-colors font-medium flex items-center gap-2 border border-white/30"
                >
                  <X className="w-4 h-4" />
                  Limpar
                </motion.button>
              )}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleGenerateReport}
                className="flex-1 bg-slate-800 text-white py-3 px-6 rounded-xl hover:bg-slate-900 transition-colors font-bold flex items-center justify-center gap-2 shadow-lg"
              >
                <Download className="w-5 h-5" />
                Gerar e Baixar Relatório
              </motion.button>
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  )
}
