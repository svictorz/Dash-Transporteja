'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import FadeIn from '@/components/animations/FadeIn'
import { Truck, Smartphone, ArrowRight } from 'lucide-react'

export default function RastreioDriverPage() {
  const searchParams = useSearchParams()
  const freightId = searchParams.get('freightId')

  useEffect(() => {
    // Futuro: aqui podemos integrar com o app do motorista (JaAPP) se necessário.
  }, [])

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="max-w-xl w-full">
        <FadeIn>
          <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 border border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                <Truck className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-gray-900">
                  Rastreio do motorista
                </h1>
                {freightId && (
                  <p className="text-sm text-gray-600">
                    Frete <span className="font-semibold">#{freightId}</span>
                  </p>
                )}
              </div>
            </div>

            <p className="text-sm text-gray-700 mb-4">
              O acompanhamento detalhado do frete pelo motorista é feito pelo{' '}
              <span className="font-semibold">app exclusivo TransporteJá</span>. A partir do app, o
              motorista registra coleta, entrega, fotos e localização em tempo real, que aparecem
              automaticamente no seu dashboard.
            </p>

            <div className="flex items-start gap-3 mb-4">
              <Smartphone className="w-5 h-5 text-blue-600 mt-0.5" />
              <p className="text-sm text-gray-600">
                Para operar em produção, basta instalar o app em seus motoristas e informar a placa
                + código do frete. Este link web de motorista é opcional e pode ser personalizado
                futuramente.
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs text-gray-500 border-t border-gray-200 pt-3">
              <span>TransporteJá • App exclusivo + Dashboard em tempo real</span>
              <span className="inline-flex items-center gap-1">
                Ver no dashboard
                <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  )
}

