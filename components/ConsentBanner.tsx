'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Cookie, X, Settings, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

const CONSENT_KEY = 'lgpd-consent-cookies'
const CONSENT_VERSION = 1

type StoredConsent = {
  v: number
  granted: boolean
  /** decisão "fechei sem decidir" — não pergunta de novo nesse navegador. */
  dismissed?: boolean
  timestamp: string
}

function readStoredConsent(): StoredConsent | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CONSENT_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as Partial<StoredConsent>
    if (
      data &&
      typeof data.granted === 'boolean' &&
      (data.v === undefined || data.v === CONSENT_VERSION)
    ) {
      return {
        v: CONSENT_VERSION,
        granted: data.granted,
        dismissed: data.dismissed === true,
        timestamp: data.timestamp ?? new Date().toISOString(),
      }
    }
  } catch {
    // ignore JSON inválido
  }
  return null
}

function writeStoredConsent(payload: Omit<StoredConsent, 'v' | 'timestamp'>) {
  if (typeof window === 'undefined') return
  const full: StoredConsent = {
    v: CONSENT_VERSION,
    timestamp: new Date().toISOString(),
    ...payload,
  }
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(full))
  } catch {
    // localStorage cheio ou bloqueado — tudo bem, próxima visita pergunta
  }
}

export default function ConsentBanner() {
  const [showBanner, setShowBanner] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  /**
   * Verifica o consentimento.
   * Ordem de prioridade:
   * 1. localStorage (decisão local — true, false ou dismissed) → nunca pergunta
   *    de novo no mesmo navegador.
   * 2. Se logado e localStorage vazio: lê do banco. Qualquer registro
   *    encontrado (granted true OU false) é considerado decisão final;
   *    sincroniza pro localStorage.
   * 3. Sem registro nem local nem remoto → mostra o banner.
   *
   * Erros de rede/RLS NÃO reabrem o banner se já houver decisão local.
   */
  const checkConsent = useCallback(async () => {
    setIsLoading(true)

    const stored = readStoredConsent()
    if (stored !== null) {
      setShowBanner(false)
      setIsLoading(false)
      return
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        setShowBanner(true)
        setIsLoading(false)
        return
      }

      const { data: consent, error } = await supabase
        .from('user_consents')
        .select('granted')
        .eq('user_id', session.user.id)
        .eq('consent_type', 'cookies')
        .maybeSingle()

      if (error) {
        // Falha silenciosa (RLS, tabela ausente, etc.). Não mostramos o
        // banner se o usuário já decidiu localmente; aqui sabemos que não
        // decidiu, então mostramos como último recurso.
        setShowBanner(true)
        setIsLoading(false)
        return
      }

      if (consent && typeof consent.granted === 'boolean') {
        writeStoredConsent({ granted: consent.granted })
        setShowBanner(false)
      } else {
        setShowBanner(true)
      }
    } catch {
      setShowBanner(true)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    checkConsent()

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        // Após login, há chance de o consentimento estar no banco em outro
        // dispositivo. Se já decidiu local, readStoredConsent corta cedo.
        checkConsent()
      }
      if (event === 'SIGNED_OUT') {
        // Não removemos a decisão local — a preferência é por navegador,
        // não por usuário. Mantém UX consistente entre logins.
      }
    })

    return () => {
      data.subscription.unsubscribe()
    }
  }, [checkConsent])

  const persistRemote = useCallback(async (granted: boolean) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) return
      await supabase.from('user_consents').upsert(
        {
          user_id: session.user.id,
          consent_type: 'cookies',
          granted,
          user_agent:
            typeof window !== 'undefined' ? navigator.userAgent : null,
        },
        { onConflict: 'user_id,consent_type' },
      )
    } catch (error) {
      console.error(
        'consent_remote_save_failed',
        error instanceof Error ? error.name : 'unknown',
      )
    }
  }, [])

  const handleAccept = async () => {
    writeStoredConsent({ granted: true })
    setShowBanner(false)
    await persistRemote(true)
  }

  const handleReject = async () => {
    writeStoredConsent({ granted: false })
    setShowBanner(false)
    await persistRemote(false)
  }

  /**
   * Botão X: tratamos como "fechar sem decidir, mas não me pergunte mais
   * neste navegador". Persistimos `dismissed: true` (granted: false por
   * default). Não envia ao banco — é uma escolha local de UX.
   */
  const handleDismiss = () => {
    writeStoredConsent({ granted: false, dismissed: true })
    setShowBanner(false)
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
                      href="/configuracoes"
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
                  onClick={handleDismiss}
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
