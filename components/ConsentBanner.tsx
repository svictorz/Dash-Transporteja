'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Cookie, X, Settings, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

const CONSENT_KEY = 'lgpd-consent-cookies'

function getStoredConsent(): boolean | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CONSENT_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as { granted?: boolean }
    if (data && typeof data.granted === 'boolean') return data.granted
  } catch {
    // ignore invalid JSON
  }
  return null
}

export default function ConsentBanner() {
  const [showBanner, setShowBanner] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkConsent()
  }, [])

  const checkConsent = async () => {
    // 1) Sempre verificar localStorage primeiro — é a fonte de verdade no navegador
    const stored = getStoredConsent()
    if (stored !== null) {
      // Usuário já aceitou ou recusou; não mostrar o banner de novo
      setShowBanner(false)
      setIsLoading(false)
      return
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        // 2) Logado: se não tiver no localStorage, conferir no banco
        const { data: consent } = await supabase
          .from('user_consents')
          .select('granted')
          .eq('user_id', session.user.id)
          .eq('consent_type', 'cookies')
          .maybeSingle()

        if (consent?.granted === true) {
          // Sincronizar para o localStorage para não depender do banco na próxima visita
          localStorage.setItem(CONSENT_KEY, JSON.stringify({
            granted: true,
            timestamp: new Date().toISOString(),
          }))
          setShowBanner(false)
        } else {
          setShowBanner(true)
        }
      } else {
        setShowBanner(true)
      }
    } catch {
      // Em erro (ex.: tabela não existe), mostrar banner
      setShowBanner(true)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAccept = async () => {
    await saveConsent(true)
    setShowBanner(false)
  }

  const handleReject = async () => {
    await saveConsent(false)
    setShowBanner(false)
  }

  const saveConsent = async (granted: boolean) => {
    const payload = { granted, timestamp: new Date().toISOString() }
    // Sempre salvar no localStorage primeiro para persistir na hora
    if (typeof window !== 'undefined') {
      localStorage.setItem(CONSENT_KEY, JSON.stringify(payload))
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        await supabase.from('user_consents').upsert(
          {
            user_id: session.user.id,
            consent_type: 'cookies',
            granted,
            user_agent: typeof window !== 'undefined' ? navigator.userAgent : null,
          },
          { onConflict: 'user_id,consent_type' }
        )
      }
    } catch (error) {
      console.error('Erro ao salvar consentimento no banco:', error)
      // Consentimento já foi salvo no localStorage
    }
  }

  if (isLoading) {
    return null
  }

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white border-t border-gray-200 shadow-2xl"
        >
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="flex items-start gap-3 flex-1">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Cookie className="w-5 h-5 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">
                    Utilizamos cookies
                  </h3>
                  <p className="text-sm text-gray-600 mb-2">
                    Utilizamos cookies para melhorar sua experiência, analisar o uso do site e personalizar conteúdo. 
                    Ao continuar navegando, você concorda com nossa{' '}
                    <Link href="/legal/cookies" className="text-blue-600 hover:underline">
                      Política de Cookies
                    </Link>
                    {' '}e{' '}
                    <Link href="/legal/privacidade" className="text-blue-600 hover:underline">
                      Política de Privacidade
                    </Link>.
                  </p>
                  <div className="flex items-center gap-4 mt-2">
                    <Link 
                      href="/dashboard/configuracoes"
                      className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
                    >
                      <Settings className="w-4 h-4" />
                      Configurações
                    </Link>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleReject}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Recusar
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleAccept}
                  className="px-4 py-2 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-900 transition-colors flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Aceitar
                </motion.button>
                <button
                  onClick={() => setShowBanner(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

