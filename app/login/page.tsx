'use client'

import { useState, FormEvent, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { validateEmail } from '@/lib/utils/validation'
import { useAuthState } from '@/lib/hooks/useAuthState'
import { BRAND_NAME } from '@/lib/constants/brand'

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
    router.replace('/dashboard')
  }, [authLoading, session, router])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

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
      // Autenticação com Supabase
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password
      })

      if (authError) {
        setError(authError.message || 'Erro ao fazer login. Verifique suas credenciais.')
        setIsLoading(false)
        return
      }

      if (data.user) {
        // Buscar dados do usuário na tabela users
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .single()

        if (userError && userError.code !== 'PGRST116') {
          // PGRST116 = no rows returned, vamos criar o registro
          const { error: insertError } = await supabase
            .from('users')
            .insert({
              id: data.user.id,
              email: data.user.email!,
              name: data.user.email?.split('@')[0] || null,
              role: 'comercial'
            })

          if (insertError) {
            console.error('Erro ao criar perfil:', insertError)
          }
        }

        // Aguardar um pouco para garantir que a sessão foi estabelecida
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // Redirecionar usando replace para evitar histórico de navegação
        // Não usar window.location.href para evitar refresh completo
        router.replace('/dashboard')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer login. Tente novamente.')
      setIsLoading(false)
    }
  }

  // Mostrar formulário após 1,5s ou quando a sessão terminar de carregar (evita travar em "Verificando sessão...")
  if (authLoading && !showForm) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando sessão...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 relative overflow-hidden">
      {/* Background Pattern - Textura sutil */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255, 255, 255, 0.8) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.8) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px'
        }}
      />

      {/* Main Content */}
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="bg-white rounded-lg shadow-lg p-6 md:p-8">
            {/* Logo and Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center mb-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo-header.png"
                  alt={BRAND_NAME}
                  className="h-12 w-auto max-w-[220px] object-contain"
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
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
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
                    className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
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
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-700">Senha redefinida com sucesso. Faça login com sua nova senha.</p>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {/* Login Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gray-900 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-900"
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

            {/* Register Link */}
            <div className="mt-5 text-center">
              <p className="text-sm text-gray-600">
                Não tem uma conta?{' '}
                <Link
                  href="/register"
                  className="text-gray-900 font-medium hover:underline"
                >
                  Registrar
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

