'use client'

import { useState, FormEvent, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { validateEmail } from '@/lib/utils/validation'
import { useAuthState } from '@/lib/hooks/useAuthState'
import { BRAND_NAME } from '@/lib/constants/brand'
import BrandLoading from '@/components/transporteja/BrandLoading'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const senhaRedefinida = searchParams.get('senha_redefinida') === '1'
  const { session, loading: authLoading } = useAuthState()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const redirectAttemptedRef = useRef(false)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => setShowForm(true), 1500)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    if (authLoading || !session) return
    if (redirectAttemptedRef.current) return
    redirectAttemptedRef.current = true
    router.replace('/inicio')
  }, [authLoading, session, router])

  /**
   * Mensagem genérica para qualquer falha de credencial.
   * Não revelar a mensagem exata do Supabase ao usuário (evita enumeração
   * de e-mails / leak de detalhes internos do Auth). O motivo real fica só
   * no console do desenvolvedor.
   */
  const GENERIC_AUTH_ERROR = 'E-mail ou senha incorretos. Verifique e tente novamente.'

  const RATE_KEY = 'login:attempts'
  const RATE_LIMIT = 8
  const RATE_WINDOW_MS = 15 * 60 * 1000 // 15 minutos
  const RATE_BLOCK_MS = 5 * 60 * 1000 // bloqueio de 5 min após exceder

  type RateState = { count: number; firstAt: number; blockedUntil?: number }

  const readRate = (): RateState => {
    if (typeof window === 'undefined') return { count: 0, firstAt: Date.now() }
    try {
      const raw = window.localStorage.getItem(RATE_KEY)
      if (!raw) return { count: 0, firstAt: Date.now() }
      const parsed = JSON.parse(raw) as RateState
      if (Date.now() - parsed.firstAt > RATE_WINDOW_MS) {
        return { count: 0, firstAt: Date.now() }
      }
      return parsed
    } catch {
      return { count: 0, firstAt: Date.now() }
    }
  }

  const writeRate = (next: RateState) => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(RATE_KEY, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }

  const clearRate = () => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.removeItem(RATE_KEY)
    } catch {
      /* ignore */
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    // Rate limit local (anti brute-force casual). Para força total, use
    // Vercel Firewall + rate limit nativo do Supabase.
    const rate = readRate()
    if (rate.blockedUntil && Date.now() < rate.blockedUntil) {
      const secs = Math.ceil((rate.blockedUntil - Date.now()) / 1000)
      setError(`Muitas tentativas. Tente novamente em ${Math.ceil(secs / 60)} min.`)
      return
    }

    if (!email || !password) {
      setError('Por favor, preencha todos os campos')
      return
    }

    const normalizedEmail = email.trim().toLowerCase()
    const emailCheck = validateEmail(normalizedEmail)
    if (!emailCheck.valid) {
      setError(emailCheck.error ?? 'E-mail inválido')
      return
    }

    setIsLoading(true)

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      })

      if (authError) {
        // Log apenas o código/metadados, NÃO o objeto inteiro
        console.error('login_failed', { code: authError.code ?? authError.status })
        const next: RateState = {
          count: rate.count + 1,
          firstAt: rate.firstAt || Date.now(),
        }
        if (next.count >= RATE_LIMIT) {
          next.blockedUntil = Date.now() + RATE_BLOCK_MS
        }
        writeRate(next)
        setError(GENERIC_AUTH_ERROR)
        setIsLoading(false)
        return
      }

      if (data.user) {
        // Sucesso: zera o contador local
        clearRate()

        // Importante: NÃO criamos automaticamente um registro em
        // public.users com role='comercial'. Acesso ao CRM só com
        // permissão liberada manualmente pelo admin em /usuarios.
        await new Promise((resolve) => setTimeout(resolve, 100))
        router.replace('/inicio')
      }
    } catch (err: unknown) {
      console.error('login_unexpected_error', err instanceof Error ? err.name : 'unknown')
      setError(GENERIC_AUTH_ERROR)
      setIsLoading(false)
    }
  }

  // Mostrar formulário após 1,5s ou quando a sessão terminar de carregar (evita travar em "Verificando sessão...")
  if (authLoading && !showForm) {
    return <BrandLoading message="Verificando sessão…" />
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-950 relative overflow-hidden">
      {/* Background Pattern - Textura sutil */}
      <div 
        className="absolute inset-0 opacity-30 dark:hidden"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255, 255, 255, 0.8) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.8) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px'
        }}
      />
      <div
        className="absolute inset-0 hidden dark:block opacity-25"
        style={{
          backgroundImage: `
            linear-gradient(rgba(148, 163, 184, 0.15) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148, 163, 184, 0.15) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Main Content */}
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="bg-white rounded-lg shadow-lg p-6 md:p-8">
            {/* Logo and Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center mb-4">
                <img
                  src="/logo-jcn-preto.png"
                  alt={BRAND_NAME}
                  className="h-16 w-48 object-contain"
                />
              </div>
              <h2 className="text-lg font-bold text-gray-800 mb-1">
                Bem-vindo
              </h2>
              <p className="text-xs text-gray-500">
                Acesse seu painel
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                  required
                />
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Senha
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Forgot Password Link */}
              <div className="text-right">
                <Link
                  href="/login/recuperar-senha"
                  className="text-sm text-gray-600 hover:text-gray-800"
                >
                  Esqueceu a Senha?
                </Link>
              </div>

              {/* Success: senha redefinida */}
              {senhaRedefinida && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg dark:bg-green-950/35 dark:border-green-800">
                  <p className="text-sm text-green-700 dark:text-green-400">Senha redefinida com sucesso. Faça login com sua nova senha.</p>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg dark:bg-red-950/35 dark:border-red-900">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              {/* Login Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gray-900 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white dark:focus:ring-slate-400 dark:focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-900 dark:disabled:hover:bg-slate-100"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden />
                    Entrando…
                  </span>
                ) : (
                  'Login'
                )}
              </button>
            </form>

          </div>
        </div>
      </div>
    </div>
  )
}
