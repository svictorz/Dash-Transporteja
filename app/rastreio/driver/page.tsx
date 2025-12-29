'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Camera, MapPin, CheckCircle2, Truck, History, Download, ExternalLink, X, AlertCircle, Package, ArrowRight } from 'lucide-react'

interface CheckInRecord {
  id: string
  type: 'pickup' | 'delivery'
  timestamp: string
  photo: string
  coords: { lat: number; lng: number }
  address?: string
  distance?: number
  freightId?: number
}

export default function RastreioDriverPage() {
  const [currentCheckIn, setCurrentCheckIn] = useState<CheckInRecord | null>(null)
  const [checkInHistory, setCheckInHistory] = useState<CheckInRecord[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState<'pickup' | 'delivery'>('pickup')
  const [tripInfo, setTripInfo] = useState({
    origin: 'São Paulo - SP',
    destination: 'Av. Industrial, 500 - Curitiba/PR',
    freightId: 1029
  })
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    
    // Solicitar permissão de notificações
    if (Notification.permission === 'default') {
      Notification.requestPermission()
    }
    
    const urlParams = new URLSearchParams(window.location.search)
    const freightId = urlParams.get('freightId')
    
    if (freightId) {
      setTripInfo(prev => ({ ...prev, freightId: parseInt(freightId) }))
    }

    // Carregar histórico (últimos 50)
    const stored = localStorage.getItem('checkin-history')
    if (stored) {
      try {
        const history = JSON.parse(stored)
        // Filtrar histórico do frete atual
        const freightHistory = history.filter((h: CheckInRecord) => h.freightId === tripInfo.freightId)
        const limitedHistory = freightHistory.slice(0, 50)
        setCheckInHistory(limitedHistory)
        
        // Determinar etapa atual baseado no último check-in
        if (limitedHistory.length > 0) {
          const lastCheckIn = limitedHistory[0]
          if (lastCheckIn.type === 'pickup') {
            setCurrentStep('delivery')
          } else {
            setCurrentStep('pickup') // Se já entregou, volta para coleta (novo frete)
          }
        } else {
          setCurrentStep('pickup') // Sem histórico, começa com coleta
        }
      } catch (error) {
        console.error('Erro ao carregar histórico:', error)
      }
    }
  }, [tripInfo.freightId])

  // Geocodificação reversa usando OpenStreetMap
  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'TransporteJA/1.0'
          }
        }
      )
      const data = await response.json()
      
      if (data.address) {
        const addr = data.address
        const parts = []
        if (addr.road) parts.push(addr.road)
        if (addr.house_number) parts.push(addr.house_number)
        if (addr.neighbourhood || addr.suburb) parts.push(addr.neighbourhood || addr.suburb)
        if (addr.city || addr.town || addr.village) parts.push(addr.city || addr.town || addr.village)
        if (addr.state) parts.push(addr.state)
        if (addr.postcode) parts.push(`CEP ${addr.postcode}`)
        
        return parts.length > 0 ? parts.join(', ') : `${lat.toFixed(6)}, ${lng.toFixed(6)}`
      }
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
    } catch (error) {
      console.error('Erro na geocodificação:', error)
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
    }
  }

  // Calcular distância entre duas coordenadas (Haversine)
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371 // Raio da Terra em km
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  // Validar tamanho da foto
  const validatePhoto = (dataUrl: string): { valid: boolean; error?: string } => {
    // Converter data URL para tamanho em bytes
    const base64 = dataUrl.split(',')[1]
    const binaryString = atob(base64)
    const bytes = binaryString.length
    
    const minSize = 50 * 1024 // 50KB
    const maxSize = 5 * 1024 * 1024 // 5MB
    
    if (bytes < minSize) {
      return { valid: false, error: 'Foto muito pequena. Tamanho mínimo: 50KB' }
    }
    if (bytes > maxSize) {
      return { valid: false, error: 'Foto muito grande. Tamanho máximo: 5MB' }
    }
    return { valid: true }
  }

  const handleCheckIn = async (type: 'pickup' | 'delivery') => {
    if (!navigator.geolocation) {
      alert('Geolocalização não disponível')
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      alert('Câmera não disponível')
      return
    }

    setIsLoading(true)

    try {
      // Obter localização
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000
        })
      })

      // Capturar foto
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      streamRef.current = stream
      
      const video = document.createElement('video')
      video.srcObject = stream
      video.play()
      
      await new Promise(resolve => setTimeout(resolve, 500))

      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      ctx?.drawImage(video, 0, 0)
      const photo = canvas.toDataURL('image/jpeg', 0.8)

      stream.getTracks().forEach(track => track.stop())
      streamRef.current = null

      // Validar foto
      const validation = validatePhoto(photo)
      if (!validation.valid) {
        alert(validation.error)
        setIsLoading(false)
        return
      }

      // Geocodificação reversa
      const address = await reverseGeocode(position.coords.latitude, position.coords.longitude)

      // Calcular distância (se houver destino conhecido)
      let distance: number | undefined
      // Aqui você pode adicionar lógica para calcular distância até o destino esperado

      const checkIn: CheckInRecord = {
        id: Date.now().toString(),
        type,
        timestamp: new Date().toISOString(),
        photo,
        coords: {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        },
        address,
        distance,
        freightId: tripInfo.freightId
      }

      setCurrentCheckIn(checkIn)
      
      // Atualizar etapa após check-in
      if (type === 'pickup') {
        setCurrentStep('delivery')
      } else {
        setCurrentStep('pickup') // Após entrega, volta para coleta
      }
      
      // Adicionar ao histórico (limitar a 50)
      const updated = [checkIn, ...checkInHistory].slice(0, 50)
      setCheckInHistory(updated)
      localStorage.setItem('checkin-history', JSON.stringify(updated))

      // Notificação do navegador
      if (Notification.permission === 'granted') {
        new Notification('Check-in realizado!', {
          body: `Check-in de ${type === 'pickup' ? 'coleta' : 'entrega'} registrado em ${address}`,
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png'
        })
      }

      setIsLoading(false)
    } catch (error) {
      console.error('Erro ao fazer check-in:', error)
      alert('Erro ao fazer check-in. Verifique as permissões de câmera e localização.')
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
      setIsLoading(false)
    }
  }

  // Gerar PDF do comprovante
  const generatePDF = async (record: CheckInRecord) => {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF()
    
    // Título
    doc.setFontSize(18)
    doc.text('Comprovante de Check-in', 105, 20, { align: 'center' })
    
    // Informações do frete
    doc.setFontSize(12)
    doc.text(`Frete: #${record.freightId || tripInfo.freightId}`, 20, 35)
    doc.text(`Tipo: ${record.type === 'pickup' ? 'Coleta' : 'Entrega'}`, 20, 42)
    
    // Data e hora
    const date = new Date(record.timestamp)
    doc.text(`Data: ${date.toLocaleDateString('pt-BR')}`, 20, 49)
    doc.text(`Hora: ${date.toLocaleTimeString('pt-BR')}`, 20, 56)
    
    // Endereço
    doc.text(`Endereço: ${record.address || 'Não disponível'}`, 20, 63)
    
    // Coordenadas
    doc.text(`Coordenadas: ${record.coords.lat.toFixed(6)}, ${record.coords.lng.toFixed(6)}`, 20, 70)
    
    // Foto (redimensionada)
    const img = new Image()
    img.src = record.photo
    img.onload = () => {
      const maxWidth = 170
      const maxHeight = 100
      let width = img.width
      let height = img.height
      
      if (width > maxWidth) {
        height = (height * maxWidth) / width
        width = maxWidth
      }
      if (height > maxHeight) {
        width = (width * maxHeight) / height
        height = maxHeight
      }
      
      doc.addImage(record.photo, 'JPEG', 20, 80, width, height)
      
      // Rodapé
      doc.setFontSize(10)
      doc.text('Powered by Vics Soluções - TransporteJÁ', 105, 200, { align: 'center' })
      
      // Salvar
      doc.save(`comprovante-${record.type}-${record.id}.pdf`)
    }
  }

  // Abrir no Google Maps
  const openInGoogleMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank')
  }

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp)
    return {
      date: date.toLocaleDateString('pt-BR'),
      time: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md glass-card rounded-xl md:rounded-2xl shadow-2xl border border-white/30 overflow-hidden backdrop-blur-xl">
        {/* Header */}
        <header className="glass border-b border-white/20 px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <motion.div
              whileHover={{ scale: 1.1, rotate: 5 }}
              className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center shadow-lg"
            >
              <Truck className="w-5 h-5 text-white" />
            </motion.div>
            <span className="font-bold text-gray-900">TransporteJÁ</span>
          </div>
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowHistory(true)}
              className="p-2 hover:bg-white/50 rounded-lg transition-colors text-gray-700"
              title="Histórico"
            >
              <History className="w-5 h-5" />
            </motion.button>
            <div className="text-sm font-semibold text-gray-900 px-3 py-1.5 bg-white/50 rounded-lg">
              #{tripInfo.freightId}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="px-4 py-8 bg-gradient-to-br from-white/50 to-white/30">
          {currentCheckIn ? (
            // Tela de comprovante
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="text-center mb-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200 }}
                >
                  <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-3" />
                </motion.div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Check-in Realizado!
                </h2>
                <p className="text-gray-600">
                  {currentCheckIn.type === 'pickup' ? 'Coleta' : 'Entrega'} confirmada
                </p>
              </div>

              {/* Foto */}
              <div className="glass-card rounded-xl p-2 border border-white/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentCheckIn.photo}
                  alt="Check-in"
                  className="w-full rounded-lg"
                />
              </div>

              {/* Informações */}
              <div className="space-y-3">
                <div className="glass-card rounded-xl p-3 border border-white/30">
                  <div className="text-xs text-gray-500 mb-1">Data e Hora</div>
                  <div className="font-semibold text-gray-900">
                    {formatDate(currentCheckIn.timestamp).date} às {formatDate(currentCheckIn.timestamp).time}
                  </div>
                </div>

                <div className="glass-card rounded-xl p-3 border border-white/30">
                  <div className="text-xs text-gray-500 mb-1">Endereço</div>
                  <div className="font-semibold text-gray-900 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-green-600" />
                    {currentCheckIn.address || 'Carregando...'}
                  </div>
                </div>

                <div className="glass-card rounded-xl p-3 border border-white/30">
                  <div className="text-xs text-gray-500 mb-1">Coordenadas GPS</div>
                  <div className="font-semibold text-gray-900">
                    {currentCheckIn.coords.lat.toFixed(6)}, {currentCheckIn.coords.lng.toFixed(6)}
                  </div>
                </div>
              </div>

              {/* Ações */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => generatePDF(currentCheckIn)}
                  className="flex-1 bg-slate-800 text-white py-3 px-4 rounded-xl hover:bg-slate-900 transition-colors font-semibold flex items-center justify-center gap-2 shadow-lg"
                >
                  <Download className="w-5 h-5" />
                  <span className="hidden sm:inline">Baixar PDF</span>
                  <span className="sm:hidden">PDF</span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => openInGoogleMaps(currentCheckIn.coords.lat, currentCheckIn.coords.lng)}
                  className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-xl hover:bg-blue-700 transition-colors font-semibold flex items-center justify-center gap-2 shadow-lg"
                >
                  <ExternalLink className="w-5 h-5" />
                  Ver no Mapa
                </motion.button>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setCurrentCheckIn(null)}
                className="w-full glass-card text-gray-700 py-3 px-4 rounded-xl hover:bg-white/70 transition-colors font-semibold border border-white/30"
              >
                Fazer Novo Check-in
              </motion.button>
            </motion.div>
          ) : (
            // Tela principal
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  Olá, Motorista!
                </h1>
                <p className="text-gray-600 text-base">
                  {currentStep === 'pickup' ? 'Confirme a coleta' : 'Confirme a entrega'}
                </p>
              </div>

              {/* Informações da Rota */}
              <div className="space-y-3 mb-6">
                <div className={`glass-card rounded-xl p-4 border-4 ${
                  currentStep === 'pickup' ? 'border-blue-500 bg-blue-50/50' : 'border-blue-300'
                }`}>
                  <div className="flex items-start gap-3">
                    <MapPin className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                      currentStep === 'pickup' ? 'text-blue-600' : 'text-gray-400'
                    }`} />
                    <div className="flex-1">
                      <p className={`text-xs mb-1 uppercase tracking-wide font-medium ${
                        currentStep === 'pickup' ? 'text-blue-600' : 'text-gray-500'
                      }`}>
                        ORIGEM / COLETA
                      </p>
                      <p className="text-base font-bold text-gray-900">
                        {tripInfo.origin}
                      </p>
                    </div>
                  </div>
                </div>

                <div className={`glass-card rounded-xl p-4 border-4 ${
                  currentStep === 'delivery' ? 'border-green-500 bg-green-50/50' : 'border-green-300'
                }`}>
                  <div className="flex items-start gap-3">
                    <MapPin className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                      currentStep === 'delivery' ? 'text-green-600' : 'text-gray-400'
                    }`} />
                    <div className="flex-1">
                      <p className={`text-xs mb-1 uppercase tracking-wide font-medium ${
                        currentStep === 'delivery' ? 'text-green-600' : 'text-gray-500'
                      }`}>
                        DESTINO / ENTREGA
                      </p>
                      <p className="text-base font-bold text-gray-900">
                        {tripInfo.destination}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Botões de Check-in - Mudam conforme a etapa */}
              <div className="space-y-3 mb-4">
                {currentStep === 'pickup' ? (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleCheckIn('pickup')}
                    disabled={isLoading}
                    className="w-full bg-blue-600 text-white py-4 px-6 rounded-xl hover:bg-blue-700 transition-colors font-bold flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Processando...</span>
                      </>
                    ) : (
                      <>
                        <div className="w-7 h-7 bg-white rounded-full flex items-center justify-center">
                          <Package className="w-4 h-4 text-blue-600" />
                        </div>
                        <span>Confirmar Coleta</span>
                      </>
                    )}
                  </motion.button>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleCheckIn('delivery')}
                    disabled={isLoading}
                    className="w-full bg-green-600 text-white py-4 px-6 rounded-xl hover:bg-green-700 transition-colors font-bold flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Processando...</span>
                      </>
                    ) : (
                      <>
                        <div className="w-7 h-7 bg-white rounded-full flex items-center justify-center">
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        </div>
                        <span>Confirmar Entrega</span>
                      </>
                    )}
                  </motion.button>
                )}
              </div>

              {currentStep === 'pickup' ? (
                <div className="space-y-2 mb-8">
                  <p className="text-sm text-gray-700 text-center font-medium">
                    ⚠️ Importante para a Coleta:
                  </p>
                  <div className="glass-card rounded-xl p-4 border border-white/30 space-y-2">
                    <p className="text-xs text-gray-700">
                      • <strong>Ative o GPS/localização</strong> do seu celular antes de clicar
                    </p>
                    <p className="text-xs text-gray-700">
                      • <strong>Tire uma foto da carga coletada</strong> para registro
                    </p>
                    <p className="text-xs text-gray-700">
                      • <strong>Mantenha o GPS ativo</strong> durante todo o percurso até a entrega
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 mb-8">
                  <p className="text-sm text-gray-700 text-center font-medium">
                    ⚠️ Importante para a Entrega:
                  </p>
                  <div className="glass-card rounded-xl p-4 border border-white/30">
                    <p className="text-xs text-gray-700 text-center">
                      A foto capturada será usada para <strong>liberar o processamento do pagamento</strong>. Certifique-se de que o GPS está ativo.
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          <div className="pt-8">
            <p className="text-xs text-gray-400 text-center">
              Powered by Vics Soluções
            </p>
          </div>
        </main>
      </div>

      {/* Modal de Histórico */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-white/30 backdrop-blur-xl"
          >
            <div className="glass border-b border-white/20 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <History className="w-5 h-5" />
                Histórico de Check-ins
              </h2>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowHistory(false)}
                className="p-2 hover:bg-white/50 rounded-lg transition-colors text-gray-700"
              >
                <X className="w-5 h-5" />
              </motion.button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              {checkInHistory.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <History className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>Nenhum check-in registrado ainda</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {checkInHistory.map((record) => {
                    const { date, time } = formatDate(record.timestamp)
                    return (
                      <motion.div
                        key={record.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-card border border-white/30 rounded-xl p-4 hover:shadow-lg transition-all"
                      >
                        <div className="flex items-start gap-4">
                          {/* Foto */}
                          <div className="flex-shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={record.photo}
                              alt={record.type}
                              className="w-20 h-20 object-cover rounded-lg"
                            />
                          </div>
                          
                          {/* Informações */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-2">
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                record.type === 'pickup' 
                                  ? 'bg-blue-100 text-blue-700' 
                                  : 'bg-green-100 text-green-700'
                              }`}>
                                {record.type === 'pickup' ? 'Coleta' : 'Entrega'}
                              </span>
                              <span className="text-xs text-gray-500">
                                {date} {time}
                              </span>
                            </div>
                            
                            {record.address && (
                              <div className="text-sm text-gray-700 mb-2 flex items-start gap-2">
                                <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                                <span className="line-clamp-2">{record.address}</span>
                              </div>
                            )}
                            
                            <div className="text-xs text-gray-500 mb-3">
                              {record.coords.lat.toFixed(6)}, {record.coords.lng.toFixed(6)}
                            </div>
                            
                            <div className="flex gap-2">
                              <button
                                onClick={() => generatePDF(record)}
                                className="px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-1"
                              >
                                <Download className="w-3 h-3" />
                                PDF
                              </button>
                              <button
                                onClick={() => openInGoogleMaps(record.coords.lat, record.coords.lng)}
                                className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Mapa
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
